import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  CURRENT_SEASON,
  fetchLeague,
  fetchPlayerNames,
  buildTeamMap,
  POSITIONS,
  PRO_TEAMS,
} from './espn-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const FIRST_SEASON = 2016;

const warnings = [];
const warn = (msg) => {
  warnings.push(msg);
  console.warn(`  ! ${msg}`);
};

const readJson = (name, fallback) => {
  const path = join(DATA_DIR, name);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback;
};

const writeJson = (name, data) => {
  writeFileSync(join(DATA_DIR, name), JSON.stringify(data, null, 2));
  console.log(`  wrote ${name}`);
};

const describePlayer = (info, id) => ({
  nfl_player_id: id,
  nfl_player_name: info?.fullName ?? `Unknown (${id})`,
  position: POSITIONS[info?.defaultPositionId] ?? 'UNK',
  pro_team: PRO_TEAMS[info?.proTeamId] ?? 'FA',
});

// ─── Drafts (every season, 2016 → current) ───────────────────────────────────
async function fetchDrafts() {
  const allPicks = [];
  const teamNames = [];

  for (let year = FIRST_SEASON; year <= CURRENT_SEASON; year++) {
    const league = await fetchLeague(year, ['mDraftDetail', 'mTeam']);
    const picks = league.draftDetail?.picks ?? [];
    if (!picks.length) {
      warn(`${year}: no draft picks returned`);
      continue;
    }

    const teamMap = buildTeamMap(league, year, warn);
    const names = await fetchPlayerNames(year, picks.map((p) => p.playerId));

    for (const [teamId, team] of teamMap) {
      teamNames.push({
        season_id: year,
        player_id: team.playerId,
        espn_team_id: teamId,
        team_name: team.teamName,
        abbrev: team.abbrev,
      });
    }

    for (const pick of picks) {
      const team = teamMap.get(pick.teamId);
      if (!team) {
        warn(`${year}: pick ${pick.overallPickNumber} has unmapped team ${pick.teamId}`);
        continue;
      }
      allPicks.push({
        season_id: year,
        overall_pick: pick.overallPickNumber,
        round: pick.roundId,
        round_pick: pick.roundPickNumber,
        player_id: team.playerId,
        ...describePlayer(names.get(pick.playerId), pick.playerId),
        keeper: Boolean(pick.keeper),
      });
    }

    console.log(`  ${year}: ${picks.length} picks`);
  }

  allPicks.sort((a, b) => a.season_id - b.season_id || a.overall_pick - b.overall_pick);
  return { picks: allPicks, teamNames };
}

// ─── Transactions (current season only — ESPN drops the feed after rollover) ──
async function fetchTransactions() {
  const league = await fetchLeague(CURRENT_SEASON, ['mTransactions2', 'mTeam'], {
    transactions: { filterType: { value: ['WAIVER', 'FREEAGENT', 'TRADE_ACCEPT'] } },
  });

  const teamMap = buildTeamMap(league, CURRENT_SEASON, warn);
  const raw = (league.transactions ?? []).filter(
    (t) => t.type !== 'ROSTER' && t.status === 'EXECUTED' && !t.isPending
  );

  const playerIds = raw.flatMap((t) => (t.items ?? []).map((i) => i.playerId));
  const names = await fetchPlayerNames(CURRENT_SEASON, playerIds);

  const TYPES = { FREEAGENT: 'free_agent', WAIVER: 'waiver', TRADE_ACCEPT: 'trade' };

  const parsed = raw.map((t) => {
    const team = teamMap.get(t.teamId);
    const items = t.items ?? [];
    return {
      transaction_id: t.id,
      season_id: CURRENT_SEASON,
      week: t.scoringPeriodId,
      date: new Date(t.proposedDate).toISOString(),
      player_id: team?.playerId ?? null,
      type: TYPES[t.type] ?? t.type.toLowerCase(),
      bid_amount: t.bidAmount ?? 0,
      adds: items.filter((i) => i.type === 'ADD').map((i) => describePlayer(names.get(i.playerId), i.playerId)),
      drops: items.filter((i) => i.type === 'DROP').map((i) => describePlayer(names.get(i.playerId), i.playerId)),
    };
  });

  // ESPN only exposes the live season, so the committed file is the archive:
  // merge rather than overwrite so prior seasons' moves survive the rollover.
  const existing = readJson('transactions.json', []);
  const byId = new Map(existing.map((t) => [t.transaction_id, t]));
  let added = 0;
  for (const t of parsed) {
    if (!byId.has(t.transaction_id)) added++;
    byId.set(t.transaction_id, t);
  }

  const merged = [...byId.values()].sort(
    (a, b) => a.season_id - b.season_id || new Date(a.date) - new Date(b.date)
  );
  console.log(`  ${CURRENT_SEASON}: ${parsed.length} transactions (${added} new, ${merged.length} archived)`);
  return merged;
}

// ─── Rosters ─────────────────────────────────────────────────────────────────
// ESPN keeps exactly one roster per finished season — the end-of-season squad —
// and ignores scoringPeriodId when asked for an older year, so week-by-week
// history isn't available. For the season in progress this is the live roster.
const LINEUP_SLOTS = { 20: 'bench', 21: 'ir' };

async function fetchRosters(draftPicks) {
  const rosters = [];

  for (let year = FIRST_SEASON; year <= CURRENT_SEASON; year++) {
    const league = await fetchLeague(year, ['mRoster', 'mTeam']);
    const teamMap = buildTeamMap(league, year, warn);

    // Who each manager drafted that year, to flag players they've held all season.
    const draftedBy = new Map();
    for (const pick of draftPicks) {
      if (pick.season_id !== year) continue;
      if (!draftedBy.has(pick.player_id)) draftedBy.set(pick.player_id, new Set());
      draftedBy.get(pick.player_id).add(pick.nfl_player_id);
    }

    let count = 0;
    for (const team of league.teams ?? []) {
      const mapped = teamMap.get(team.id);
      if (!mapped) continue;

      for (const entry of team.roster?.entries ?? []) {
        const player = entry.playerPoolEntry?.player;
        rosters.push({
          season_id: year,
          player_id: mapped.playerId,
          nfl_player_id: entry.playerId,
          nfl_player_name: player?.fullName ?? `Unknown (${entry.playerId})`,
          position: POSITIONS[player?.defaultPositionId] ?? 'UNK',
          pro_team: PRO_TEAMS[player?.proTeamId] ?? 'FA',
          slot: LINEUP_SLOTS[entry.lineupSlotId] ?? 'starter',
          drafted: draftedBy.get(mapped.playerId)?.has(entry.playerId) ?? false,
        });
        count++;
      }
    }
    console.log(`  ${year}: ${count} roster spots`);
  }

  return rosters;
}

// ─── Weekly lineups (current season only) ────────────────────────────────────
// Who was actually started each week and what they scored. ESPN serves this
// only while the season is live — boxscore rosters come back empty for finished
// years — so each run appends completed weeks to a permanent archive.
const LINEUP_SLOT_NAMES = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K', 20: 'BE', 21: 'IR', 23: 'FLEX',
};

async function fetchWeeklyLineups() {
  const existing = readJson('weekly-lineups.json', []);
  const byKey = new Map(
    existing.map((r) => [`${r.season_id}:${r.week}:${r.player_id}:${r.nfl_player_id}`, r])
  );

  const league = await fetchLeague(CURRENT_SEASON, ['mTeam', 'mMatchupScore']);
  const teamMap = buildTeamMap(league, CURRENT_SEASON, warn);

  // Only weeks that have finished; a live week's points are still moving.
  const finishedWeeks = [
    ...new Set(
      (league.schedule ?? [])
        .filter((g) => g.winner && g.winner !== 'UNDECIDED')
        .map((g) => g.matchupPeriodId)
    ),
  ].sort((a, b) => a - b);

  let captured = 0;
  for (const week of finishedWeeks) {
    const box = await fetchLeague(CURRENT_SEASON, ['mBoxscore', 'mMatchupScore'], undefined, week);
    const games = (box.schedule ?? []).filter((g) => g.matchupPeriodId === week);

    for (const game of games) {
      for (const side of ['home', 'away']) {
        const team = teamMap.get(game[side]?.teamId);
        const entries = game[side]?.rosterForCurrentScoringPeriod?.entries ?? [];
        if (!team || !entries.length) continue;

        for (const entry of entries) {
          const player = entry.playerPoolEntry?.player;
          const slotName = LINEUP_SLOT_NAMES[entry.lineupSlotId] ?? String(entry.lineupSlotId);
          const row = {
            season_id: CURRENT_SEASON,
            week,
            player_id: team.playerId,
            nfl_player_id: entry.playerId,
            nfl_player_name: player?.fullName ?? `Unknown (${entry.playerId})`,
            position: POSITIONS[player?.defaultPositionId] ?? 'UNK',
            pro_team: PRO_TEAMS[player?.proTeamId] ?? 'FA',
            lineup_slot: slotName,
            started: entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21,
            points: Number((entry.playerPoolEntry?.appliedStatTotal ?? 0).toFixed(2)),
          };
          byKey.set(`${row.season_id}:${row.week}:${row.player_id}:${row.nfl_player_id}`, row);
          captured++;
        }
      }
    }
    console.log(`  week ${week}: ${games.length} games captured`);
  }

  const merged = [...byKey.values()].sort(
    (a, b) => a.season_id - b.season_id || a.week - b.week || a.player_id - b.player_id
  );
  console.log(`  ${captured} rows this run, ${merged.length} archived`);
  return merged;
}

// ─── Consolation ladder games ────────────────────────────────────────────────
// ESPN counts these toward its own final rankings; the league doesn't. Only the
// playoff bracket and the 9th/10th toilet bowl are real, and those already live
// in matchups.json via the SQL source. Everything else is stored here so the
// games are viewable without leaking into records, career stats, or head-to-head.
async function fetchConsolationGames() {
  const known = readJson('matchups.json', []);
  const near = (a, b) => Math.abs(a - b) <= 0.05;
  const games = [];

  for (let year = FIRST_SEASON; year <= CURRENT_SEASON; year++) {
    const league = await fetchLeague(year, ['mTeam', 'mMatchupScore']);
    const teamMap = buildTeamMap(league, year, warn);
    const seasonKnown = known.filter((m) => m.season_id === year && m.game_type !== 'regular');

    const postseason = (league.schedule ?? [])
      .map((g) => ({
        week: g.matchupPeriodId,
        home: teamMap.get(g.home?.teamId)?.playerId,
        away: teamMap.get(g.away?.teamId)?.playerId,
        home_score: Number((g.home?.totalPoints ?? 0).toFixed(2)),
        away_score: Number((g.away?.totalPoints ?? 0).toFixed(2)),
        tier: g.playoffTierType,
      }))
      .filter((g) => g.home && g.away && g.tier !== 'NONE');

    const extras = postseason.filter(
      (g) =>
        !seasonKnown.some((m) => {
          const samePair =
            (m.player1_id === g.home && m.player2_id === g.away) ||
            (m.player1_id === g.away && m.player2_id === g.home);
          if (!samePair) return false;
          const s1 = m.player1_id === g.home ? g.home_score : g.away_score;
          const s2 = m.player1_id === g.home ? g.away_score : g.home_score;
          return near(m.player1_score, s1) && near(m.player2_score, s2);
        })
    );

    for (const g of extras) {
      games.push({
        season_id: year,
        week: g.week,
        home_player_id: g.home,
        away_player_id: g.away,
        home_score: g.home_score,
        away_score: g.away_score,
        tier: g.tier,
      });
    }
    if (extras.length) console.log(`  ${year}: ${extras.length} consolation games`);
  }

  return games.sort((a, b) => a.season_id - b.season_id || a.week - b.week);
}

// ─── Live standings + schedule for the season in progress ────────────────────
async function fetchCurrentSeason() {
  const league = await fetchLeague(CURRENT_SEASON, ['mTeam', 'mMatchupScore', 'mSettings']);
  const teamMap = buildTeamMap(league, CURRENT_SEASON, warn);

  const standings = (league.teams ?? [])
    .map((team) => {
      const mapped = teamMap.get(team.id);
      const overall = team.record?.overall ?? {};
      return {
        player_id: mapped?.playerId ?? null,
        team_name: mapped?.teamName ?? team.name?.trim(),
        abbrev: team.abbrev,
        wins: overall.wins ?? 0,
        losses: overall.losses ?? 0,
        ties: overall.ties ?? 0,
        points_for: Number((overall.pointsFor ?? 0).toFixed(2)),
        points_against: Number((overall.pointsAgainst ?? 0).toFixed(2)),
        rank: team.playoffSeed ?? null,
      };
    })
    .filter((t) => t.player_id !== null)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const schedule = (league.schedule ?? [])
    .map((game) => ({
      week: game.matchupPeriodId,
      home_player_id: teamMap.get(game.home?.teamId)?.playerId ?? null,
      away_player_id: teamMap.get(game.away?.teamId)?.playerId ?? null,
      home_score: Number((game.home?.totalPoints ?? 0).toFixed(2)),
      away_score: Number((game.away?.totalPoints ?? 0).toFixed(2)),
      winner: game.winner === 'UNDECIDED' ? null : game.winner?.toLowerCase() ?? null,
      playoff_tier: game.playoffTierType === 'NONE' ? null : game.playoffTierType,
    }))
    .filter((g) => g.home_player_id !== null && g.away_player_id !== null)
    .sort((a, b) => a.week - b.week);

  const status = league.status ?? {};
  return {
    season_id: CURRENT_SEASON,
    league_name: league.settings?.name ?? null,
    current_week: status.latestScoringPeriod ?? null,
    current_matchup_period: status.currentMatchupPeriod ?? null,
    regular_season_weeks: league.settings?.scheduleSettings?.matchupPeriodCount ?? null,
    playoff_team_count: league.settings?.scheduleSettings?.playoffTeamCount ?? null,
    is_active: Boolean(status.isActive),
    last_updated: new Date().toISOString(),
    standings,
    schedule,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log(`Fetching ESPN data (${FIRST_SEASON}–${CURRENT_SEASON})...`);

console.log('\nDrafts:');
const { picks, teamNames } = await fetchDrafts();

console.log('\nRosters:');
const rosters = await fetchRosters(picks);

console.log('\nWeekly lineups:');
const weeklyLineups = await fetchWeeklyLineups();

console.log('\nConsolation games:');
const consolationGames = await fetchConsolationGames();

console.log('\nTransactions:');
const transactions = await fetchTransactions();

console.log('\nCurrent season:');
const currentSeason = await fetchCurrentSeason();
console.log(
  `  ${currentSeason.season_id}: week ${currentSeason.current_week}, ${currentSeason.standings.length} teams, ${currentSeason.schedule.length} games`
);

console.log('\nWriting:');
writeJson('drafts.json', picks);
writeJson('team-names.json', teamNames);
writeJson('rosters.json', rosters);
writeJson('weekly-lineups.json', weeklyLineups);
writeJson('consolation-games.json', consolationGames);
writeJson('transactions.json', transactions);
writeJson('current-season.json', currentSeason);

console.log(
  `\nDone. ${picks.length} picks, ${rosters.length} roster spots, ${consolationGames.length} consolation games, ${transactions.length} transactions.`
);
if (warnings.length) console.log(`${warnings.length} warning(s) above.`);

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  CURRENT_SEASON,
  fetchLeague,
  fetchSeasonPath,
  fetchPlayerNames,
  buildTeamMap,
  POSITIONS,
  PRO_TEAMS,
} from './espn-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const LINEUP_DIR = join(DATA_DIR, 'lineups');
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

// ─── Weekly lineups ──────────────────────────────────────────────────────────
// Who started each week, what they scored, and what they were projected to
// score. Only reachable through the /seasons/ path — leagueHistory returns the
// same shape with rosters stripped. 2018 is the earliest season ESPN still has
// this for; 2016-2017 return no boxscore rosters at all.
const FIRST_LINEUP_SEASON = 2018;
const LINEUP_SLOT_NAMES = {
  0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE', 16: 'D/ST', 17: 'K', 20: 'BE', 21: 'IR', 23: 'FLEX',
};
const BENCH_SLOTS = new Set([20, 21]);

async function fetchWeeklyLineups() {
  mkdirSync(LINEUP_DIR, { recursive: true });

  const byKey = new Map();
  for (let year = FIRST_LINEUP_SEASON; year <= CURRENT_SEASON; year++) {
    const path = join(LINEUP_DIR, `${year}.json`);
    if (!existsSync(path)) continue;
    for (const r of JSON.parse(readFileSync(path, 'utf-8'))) {
      byKey.set(`${r.season_id}:${r.week}:${r.player_id}:${r.nfl_player_id}`, r);
    }
  }

  let captured = 0;
  let mismatches = 0;

  for (let year = FIRST_LINEUP_SEASON; year <= CURRENT_SEASON; year++) {
    const league = await fetchLeague(year, ['mTeam', 'mMatchupScore']);
    const teamMap = buildTeamMap(league, year, warn);

    // Settled weeks only — a live week's points are still moving.
    const weeks = [
      ...new Set(
        (league.schedule ?? [])
          .filter((g) => g.winner && g.winner !== 'UNDECIDED')
          .map((g) => g.matchupPeriodId)
      ),
    ].sort((a, b) => a - b);

    let yearRows = 0;
    for (const week of weeks) {
      const box = await fetchSeasonPath(year, ['mBoxscore', 'mMatchupScore'], week);
      const games = (box.schedule ?? []).filter((g) => g.matchupPeriodId === week);

      for (const game of games) {
        for (const side of ['home', 'away']) {
          const team = teamMap.get(game[side]?.teamId);
          const entries = game[side]?.rosterForCurrentScoringPeriod?.entries ?? [];
          if (!team || !entries.length) continue;

          // Guard the import: starters plus any scoring adjustment must
          // reconstruct the official total. (The league has docked teams 100
          // points before, e.g. three teams in 2020 week 15.)
          const adjustment = game[side]?.adjustment ?? 0;
          const starterSum = entries
            .filter((e) => !BENCH_SLOTS.has(e.lineupSlotId))
            .reduce((sum, e) => sum + (e.playerPoolEntry?.appliedStatTotal ?? 0), 0);
          if (Math.abs(starterSum + adjustment - (game[side]?.totalPoints ?? 0)) > 0.05) {
            warn(
              `${year} wk${week} ${team.abbrev}: starters ${starterSum.toFixed(2)} + adj ${adjustment} != ${game[side]?.totalPoints}`
            );
            mismatches++;
          }

          for (const entry of entries) {
            const player = entry.playerPoolEntry?.player;
            const stats = player?.stats ?? [];
            const projected = stats.find(
              (s) => s.scoringPeriodId === week && s.statSourceId === 1
            )?.appliedTotal;

            const row = {
              season_id: year,
              week,
              player_id: team.playerId,
              nfl_player_id: entry.playerId,
              nfl_player_name: player?.fullName ?? `Unknown (${entry.playerId})`,
              position: POSITIONS[player?.defaultPositionId] ?? 'UNK',
              pro_team: PRO_TEAMS[player?.proTeamId] ?? 'FA',
              lineup_slot: LINEUP_SLOT_NAMES[entry.lineupSlotId] ?? String(entry.lineupSlotId),
              started: !BENCH_SLOTS.has(entry.lineupSlotId),
              points: Number((entry.playerPoolEntry?.appliedStatTotal ?? 0).toFixed(2)),
              projected: projected == null ? null : Number(projected.toFixed(2)),
            };
            byKey.set(`${row.season_id}:${row.week}:${row.player_id}:${row.nfl_player_id}`, row);
            captured++;
            yearRows++;
          }
        }
      }
    }
    // One file per season, written as we go. The full archive is ~21k rows /
    // 5MB, far too big to bundle, so the app lazy-loads only the year on screen
    // — and a long backfill survives a failure part-way through.
    const seasonRows = [...byKey.values()]
      .filter((r) => r.season_id === year)
      .sort((a, b) => a.week - b.week || a.player_id - b.player_id);
    writeFileSync(
      join(LINEUP_DIR, `${year}.json`),
      JSON.stringify(seasonRows, null, 2)
    );
    console.log(`  ${year}: ${weeks.length} weeks, ${yearRows} rows (saved)`);
  }

  const all = [...byKey.values()];
  console.log(`  ${captured} rows this run, ${all.length} archived${mismatches ? `, ${mismatches} score mismatches` : ''}`);

  // Small index the app can import eagerly to know what exists.
  const bySeason = new Map();
  for (const r of all) {
    if (!bySeason.has(r.season_id)) bySeason.set(r.season_id, new Set());
    bySeason.get(r.season_id).add(r.week);
  }
  const index = [...bySeason.entries()]
    .map(([season_id, weeks]) => ({
      season_id,
      weeks: [...weeks].sort((a, b) => a - b),
      rows: all.filter((r) => r.season_id === season_id).length,
    }))
    .sort((a, b) => a.season_id - b.season_id);

  return { index, rows: all };
}

// ─── Reconstructed roster moves (2018 → last completed season) ───────────────
// ESPN discards the transaction feed at rollover, but weekly rosters survive,
// so every add and drop can be recovered by diffing consecutive weeks against
// the draft as a baseline. Validated against ESPN's own per-team counters:
// 2,227 reconstructed acquisitions vs 2,214 recorded (101%), and 60 distinct
// trades vs 60 (ESPN counts a trade once per team, hence 120 in its data).
//
// Two things this cannot know, by construction:
//   - Exact dates. A move is dated to the gap between two weeks.
//   - A player dropped and re-claimed inside one gap is invisible, and a swap
//     that happens to cross between two managers can look like a trade.
function reconstructMoves(lineupRows, draftPicks) {
  const moves = [];
  // The live season has an exact transaction feed, so inferring it would be
  // both redundant and worse.
  const seasons = [...new Set(lineupRows.map((r) => r.season_id))]
    .filter((y) => y < CURRENT_SEASON)
    .sort((a, b) => a - b);

  for (const year of seasons) {
    const byWeek = new Map();
    for (const r of lineupRows) {
      if (r.season_id !== year) continue;
      if (!byWeek.has(r.week)) byWeek.set(r.week, new Map());
      const wk = byWeek.get(r.week);
      if (!wk.has(r.player_id)) wk.set(r.player_id, new Map());
      wk.get(r.player_id).set(r.nfl_player_id, r);
    }

    // Draft-day rosters are the baseline, so preseason moves show up in week 1.
    const draftRosters = new Map();
    for (const pick of draftPicks) {
      if (pick.season_id !== year) continue;
      if (!draftRosters.has(pick.player_id)) draftRosters.set(pick.player_id, new Map());
      draftRosters.get(pick.player_id).set(pick.nfl_player_id, pick);
    }

    let prev = draftRosters;
    let prevWeek = 0;

    for (const week of [...byWeek.keys()].sort((a, b) => a - b)) {
      const cur = byWeek.get(week);
      const gained = new Map();
      const lost = new Map();

      for (const [manager, roster] of cur) {
        const before = prev.get(manager) ?? new Map();
        for (const id of roster.keys()) if (!before.has(id)) gained.set(id, manager);
        for (const id of before.keys()) if (!roster.has(id)) lost.set(id, manager);
      }

      // Players that changed hands, grouped by the pair involved. A pair that
      // moved players both ways inside one gap is treated as a trade.
      const pairs = new Map();
      for (const [nflId, to] of gained) {
        const from = lost.get(nflId);
        if (!from || from === to) continue;
        const key = [from, to].sort((a, b) => a - b).join('-');
        if (!pairs.has(key)) pairs.set(key, { forward: [], backward: [] });
        const entry = pairs.get(key);
        (from < to ? entry.forward : entry.backward).push(nflId);
      }
      const tradedIds = new Set();
      for (const { forward, backward } of pairs.values()) {
        if (forward.length && backward.length) {
          for (const id of [...forward, ...backward]) tradedIds.add(id);
        }
      }

      const describe = (info, nflId) => ({
        nfl_player_id: nflId,
        nfl_player_name: info?.nfl_player_name ?? `Unknown (${nflId})`,
        position: info?.position ?? 'UNK',
        pro_team: info?.pro_team ?? 'FA',
      });

      for (const [nflId, manager] of gained) {
        const from = lost.get(nflId);
        const fromOther = from && from !== manager ? from : null;
        moves.push({
          season_id: year,
          week,
          after_week: prevWeek,
          player_id: manager,
          ...describe(cur.get(manager)?.get(nflId), nflId),
          kind: tradedIds.has(nflId) && fromOther ? 'trade_in' : fromOther ? 'claimed' : 'add',
          counterparty: fromOther,
        });
      }

      for (const [nflId, manager] of lost) {
        const to = gained.get(nflId);
        const toOther = to && to !== manager ? to : null;
        moves.push({
          season_id: year,
          week,
          after_week: prevWeek,
          player_id: manager,
          ...describe(prev.get(manager)?.get(nflId), nflId),
          kind: tradedIds.has(nflId) && toOther ? 'trade_out' : toOther ? 'released' : 'drop',
          counterparty: toOther,
        });
      }

      prev = cur;
      prevWeek = week;
    }
  }

  const counts = {};
  for (const m of moves) counts[m.kind] = (counts[m.kind] ?? 0) + 1;
  console.log(`  ${moves.length} moves reconstructed: ${JSON.stringify(counts)}`);
  return moves.sort(
    (a, b) => a.season_id - b.season_id || a.week - b.week || a.player_id - b.player_id
  );
}

// ─── Valuing moves: what each pickup and trade actually returned ─────────────
// A move is judged on points the player went on to score *in the lineup* of
// whoever acquired him, from that week forward. Bench points are tracked
// separately: a pickup that rode the bench all year returned nothing, however
// well the player did.
function valueMoves(moves, lineupRows) {
  // season -> manager -> nflPlayer -> [{ week, started, points }]
  const byManagerPlayer = new Map();
  for (const r of lineupRows) {
    const key = `${r.season_id}:${r.player_id}:${r.nfl_player_id}`;
    if (!byManagerPlayer.has(key)) byManagerPlayer.set(key, []);
    byManagerPlayer.get(key).push(r);
  }

  const pointsAfter = (seasonId, managerId, nflPlayerId, fromWeek) => {
    const rows = byManagerPlayer.get(`${seasonId}:${managerId}:${nflPlayerId}`) ?? [];
    let started = 0;
    let benched = 0;
    let weeksStarted = 0;
    for (const r of rows) {
      if (r.week < fromWeek) continue;
      if (r.started) {
        started += r.points;
        weeksStarted++;
      } else {
        benched += r.points;
      }
    }
    return {
      started_points: Number(started.toFixed(2)),
      bench_points: Number(benched.toFixed(2)),
      weeks_started: weeksStarted,
    };
  };

  const valued = moves.map((m) => {
    const incoming = m.kind === 'add' || m.kind === 'claimed' || m.kind === 'trade_in';
    if (!incoming) return m;
    return { ...m, ...pointsAfter(m.season_id, m.player_id, m.nfl_player_id, m.week) };
  });

  // Group the two halves of each trade so both sides can be scored.
  const trades = new Map();
  for (const m of moves) {
    if (m.kind !== 'trade_in' && m.kind !== 'trade_out') continue;
    if (m.counterparty === null) continue;
    const pair = [m.player_id, m.counterparty].sort((a, b) => a - b);
    const key = `${m.season_id}:${m.week}:${pair[0]}-${pair[1]}`;
    if (!trades.has(key)) {
      trades.set(key, {
        season_id: m.season_id,
        week: m.week,
        manager_a: pair[0],
        manager_b: pair[1],
        a_received: [],
        b_received: [],
      });
    }
    if (m.kind !== 'trade_in') continue;
    const entry = trades.get(key);
    const side = m.player_id === pair[0] ? entry.a_received : entry.b_received;
    side.push({
      nfl_player_id: m.nfl_player_id,
      nfl_player_name: m.nfl_player_name,
      position: m.position,
      ...pointsAfter(m.season_id, m.player_id, m.nfl_player_id, m.week),
    });
  }

  const tradeList = [...trades.values()]
    .filter((t) => t.a_received.length && t.b_received.length)
    .map((t) => {
      const sum = (side) => Number(side.reduce((n, p) => n + p.started_points, 0).toFixed(2));
      const aPoints = sum(t.a_received);
      const bPoints = sum(t.b_received);
      return {
        ...t,
        a_points: aPoints,
        b_points: bPoints,
        margin: Number(Math.abs(aPoints - bPoints).toFixed(2)),
        winner: aPoints === bPoints ? null : aPoints > bPoints ? t.manager_a : t.manager_b,
      };
    })
    .sort((a, b) => a.season_id - b.season_id || a.week - b.week);

  console.log(`  valued ${valued.filter((m) => m.started_points !== undefined).length} acquisitions, ${tradeList.length} trades`);
  return { valued, trades: tradeList };
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
const { index: lineupIndex, rows: lineupRows } = await fetchWeeklyLineups();

console.log('\nReconstructed moves:');
const reconstructedMoves = reconstructMoves(lineupRows, picks);
const { valued: valuedMoves, trades: tradeSummaries } = valueMoves(reconstructedMoves, lineupRows);

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
writeJson('lineup-index.json', lineupIndex);
writeJson('reconstructed-moves.json', valuedMoves);
writeJson('trades.json', tradeSummaries);
writeJson('consolation-games.json', consolationGames);
writeJson('transactions.json', transactions);
writeJson('current-season.json', currentSeason);

console.log(
  `\nDone. ${picks.length} picks, ${rosters.length} roster spots, ${consolationGames.length} consolation games, ${transactions.length} transactions.`
);
if (warnings.length) console.log(`${warnings.length} warning(s) above.`);

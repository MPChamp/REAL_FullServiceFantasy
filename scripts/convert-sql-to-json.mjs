import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SQL_PATH = join(ROOT, '..', 'FF_2025_Updated.sql');
const DATA_DIR = join(ROOT, 'src', 'data');

// Ensure output dirs exist
mkdirSync(DATA_DIR, { recursive: true });

const sql = readFileSync(SQL_PATH, 'utf-8');

// ─── Parse Players ───────────────────────────────────────────────────────────
function parsePlayers(sql) {
  const players = [];
  // Match the INSERT INTO players block
  const block = sql.match(/INSERT INTO players[^;]+;/s);
  if (!block) throw new Error('Could not find players INSERT');
  const rows = [...block[0].matchAll(/\('([^']+)'\)/g)];
  rows.forEach((m, i) => {
    players.push({ player_id: i + 1, name: m[1] });
  });
  return players;
}

// ─── Parse Seasons ───────────────────────────────────────────────────────────
function parseSeasons(sql) {
  const seasons = [];
  const block = sql.match(/INSERT INTO seasons[^;]+;/s);
  if (!block) throw new Error('Could not find seasons INSERT');
  const rows = [...block[0].matchAll(/\((\d+),\s*(\d+),\s*(\d+),\s*'([^']+)'\)/g)];
  for (const m of rows) {
    seasons.push({
      season_id: parseInt(m[1]),
      year: parseInt(m[2]),
      regular_season_end_week: parseInt(m[3]),
      playoff_format: m[4],
    });
  }
  return seasons;
}

// ─── Parse Championships ─────────────────────────────────────────────────────
function parseChampionships(sql) {
  const champs = [];
  const block = sql.match(/INSERT INTO championships[^;]+;/s);
  if (!block) throw new Error('Could not find championships INSERT');
  const rows = [...block[0].matchAll(/\((\d+),\s*(\d+),\s*(\d+)\)/g)];
  rows.forEach((m, i) => {
    champs.push({
      championship_id: i + 1,
      season_id: parseInt(m[1]),
      winner_id: parseInt(m[2]),
      runner_up_id: parseInt(m[3]),
    });
  });
  return champs;
}

// ─── Parse Season Results ────────────────────────────────────────────────────
function parseSeasonResults(sql) {
  const results = [];
  // Find all INSERT INTO season_results blocks
  const blocks = [...sql.matchAll(/INSERT INTO season_results[^;]+;/gs)];
  let id = 1;
  for (const block of blocks) {
    const text = block[0];
    // Match each row - handle both TRUE/FALSE and 0/1
    const rows = [...text.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*(\d+)\s*,\s*(TRUE|FALSE|0|1)\s*\)/gi)];
    for (const m of rows) {
      const madePlayoffs = m[13] === 'TRUE' || m[13] === '1';
      results.push({
        result_id: id++,
        player_id: parseInt(m[1]),
        season_id: parseInt(m[2]),
        rank: parseInt(m[3]),
        regular_season_record: m[4],
        wins: parseInt(m[5]),
        losses: parseInt(m[6]),
        ties: parseInt(m[7]),
        points_for: parseFloat(m[8]),
        points_against: parseFloat(m[9]),
        points_per_game: parseFloat(m[10]),
        points_against_per_game: parseFloat(m[11]),
        total_moves: parseInt(m[12]),
        made_playoffs: madePlayoffs,
      });
    }
  }
  return results;
}

// ─── Parse Weekly Matchups ───────────────────────────────────────────────────
function parseMatchups(sql) {
  const matchups = [];
  const blocks = [...sql.matchAll(/INSERT INTO weekly_matchups[^;]+;/gs)];
  let id = 1;
  for (const block of blocks) {
    const text = block[0];
    // Check if this block includes weeks_included (has 4th positional param before player IDs)
    const hasWeeksIncluded = text.includes('weeks_included');

    if (hasWeeksIncluded) {
      // Format: (season_id, week_start, week_end, 'weeks_included', p1, p2, s1, s2, 'type', 'notes')
      const rows = [...text.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+|NULL)\s*,\s*(?:'([^']*)'|NULL)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*'([^']*)'\s*,\s*(?:'([^']*)'|NULL)\s*\)/gi)];
      for (const m of rows) {
        matchups.push({
          matchup_id: id++,
          season_id: parseInt(m[1]),
          week_start: parseInt(m[2]),
          week_end: m[3] === 'NULL' ? null : parseInt(m[3]),
          weeks_included: m[4] || null,
          player1_id: parseInt(m[5]),
          player2_id: parseInt(m[6]),
          player1_score: parseFloat(m[7]),
          player2_score: parseFloat(m[8]),
          game_type: m[9],
          notes: m[10] || null,
        });
      }
    } else {
      // Format: (season_id, week_start, week_end, p1, p2, s1, s2, 'type', 'notes')
      const rows = [...text.matchAll(/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(?:NULL|(\d+))\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*'([^']*)'\s*,\s*(?:'([^']*)'|NULL)\s*\)/gi)];
      for (const m of rows) {
        matchups.push({
          matchup_id: id++,
          season_id: parseInt(m[1]),
          week_start: parseInt(m[2]),
          week_end: m[3] ? parseInt(m[3]) : null,
          weeks_included: null,
          player1_id: parseInt(m[4]),
          player2_id: parseInt(m[5]),
          player1_score: parseFloat(m[6]),
          player2_score: parseFloat(m[7]),
          game_type: m[8],
          notes: m[9] || null,
        });
      }
    }
  }
  return matchups;
}

// ─── Compute Toilet Bowls ───────────────────────────────────────────────────
function computeToiletBowls(matchups, seasons) {
  const tbGames = matchups.filter(m => m.game_type === 'toilet_bowl');
  return tbGames.map(m => {
    const p1Won = m.player1_score > m.player2_score;
    const season = seasons.find(s => s.season_id === m.season_id);
    return {
      season_id: m.season_id,
      year: season ? season.year : m.season_id + 2015,
      winner_id: p1Won ? m.player1_id : m.player2_id,
      loser_id: p1Won ? m.player2_id : m.player1_id,
      winner_score: p1Won ? m.player1_score : m.player2_score,
      loser_score: p1Won ? m.player2_score : m.player1_score,
    };
  });
}

// ─── Compute Head-to-Head Records ────────────────────────────────────────────
function computeHeadToHead(matchups) {
  const h2h = {};

  for (const m of matchups) {
    const key = m.player1_id < m.player2_id
      ? `${m.player1_id}_${m.player2_id}`
      : `${m.player2_id}_${m.player1_id}`;

    if (!h2h[key]) {
      const [lo, hi] = key.split('_').map(Number);
      h2h[key] = {
        player1_id: lo,
        player2_id: hi,
        player1_wins: 0,
        player2_wins: 0,
        ties: 0,
        total_matchups: 0,
        player1_total_points: 0,
        player2_total_points: 0,
        matchups: [],
      };
    }

    const rec = h2h[key];
    const [lo] = key.split('_').map(Number);
    const p1Score = m.player1_id === lo ? m.player1_score : m.player2_score;
    const p2Score = m.player1_id === lo ? m.player2_score : m.player1_score;

    rec.total_matchups++;
    rec.player1_total_points += p1Score;
    rec.player2_total_points += p2Score;

    if (p1Score > p2Score) rec.player1_wins++;
    else if (p2Score > p1Score) rec.player2_wins++;
    else rec.ties++;

    rec.matchups.push({
      season_id: m.season_id,
      week_start: m.week_start,
      player1_score: p1Score,
      player2_score: p2Score,
      game_type: m.game_type,
    });
  }

  return h2h;
}

// ─── Compute All-Time Records ────────────────────────────────────────────────
function computeAllTimeRecords(players, seasonResults, championships, toiletBowls) {
  return players.map(p => {
    const seasons = seasonResults.filter(sr => sr.player_id === p.player_id);
    const totalWins = seasons.reduce((s, r) => s + r.wins, 0);
    const totalLosses = seasons.reduce((s, r) => s + r.losses, 0);
    const totalTies = seasons.reduce((s, r) => s + r.ties, 0);
    const totalGames = totalWins + totalLosses + totalTies;
    const totalPF = seasons.reduce((s, r) => s + r.points_for, 0);
    const totalPA = seasons.reduce((s, r) => s + r.points_against, 0);
    const titles = championships.filter(c => c.winner_id === p.player_id).length;
    const runnerUps = championships.filter(c => c.runner_up_id === p.player_id).length;
    const playoffApps = seasons.filter(s => s.made_playoffs).length;
    const avgRank = seasons.reduce((s, r) => s + r.rank, 0) / seasons.length;
    const tbWins = toiletBowls.filter(tb => tb.winner_id === p.player_id).length;
    const tbLosses = toiletBowls.filter(tb => tb.loser_id === p.player_id).length;

    return {
      player_id: p.player_id,
      name: p.name,
      total_wins: totalWins,
      total_losses: totalLosses,
      total_ties: totalTies,
      total_games: totalGames,
      win_percentage: totalGames > 0 ? parseFloat(((totalWins + totalTies * 0.5) / totalGames).toFixed(4)) : 0,
      total_points_for: parseFloat(totalPF.toFixed(2)),
      total_points_against: parseFloat(totalPA.toFixed(2)),
      career_ppg: totalGames > 0 ? parseFloat((totalPF / totalGames).toFixed(1)) : 0,
      playoff_appearances: playoffApps,
      championships: titles,
      runner_ups: runnerUps,
      toilet_bowl_wins: tbWins,
      toilet_bowl_losses: tbLosses,
      average_rank: parseFloat(avgRank.toFixed(1)),
      seasons_played: seasons.length,
    };
  });
}

// ─── Compute Records & Superlatives ──────────────────────────────────────────
function computeRecords(players, seasonResults, matchups) {
  const playerName = id => players.find(p => p.player_id === id)?.name || 'Unknown';
  const records = {};

  // Single-week records (include all game types for matchup records)
  const allGames = matchups;
  const regularGames = matchups.filter(m => m.game_type === 'regular');
  const playoffGames = matchups.filter(m => ['semifinal', 'championship', '3rd_place', 'toilet_bowl'].includes(m.game_type));

  // Normalize 2016 combined-week playoff scores to per-week averages
  const combinedPlayoffTypes = ['semifinal', 'championship', '3rd_place'];
  const normalizeMatchup = (m) => {
    if (m.season_id === 2016 && combinedPlayoffTypes.includes(m.game_type)) {
      return {
        ...m,
        player1_score: parseFloat((m.player1_score / 2).toFixed(2)),
        player2_score: parseFloat((m.player2_score / 2).toFixed(2)),
      };
    }
    return m;
  };
  const normalizedAllGames = allGames.map(normalizeMatchup);

  // Flatten all individual scores (using normalized scores for fair comparison)
  const allScores = [];
  for (const m of normalizedAllGames) {
    allScores.push({ player_id: m.player1_id, score: m.player1_score, season_id: m.season_id, week: m.week_start, opponent_id: m.player2_id, game_type: m.game_type });
    allScores.push({ player_id: m.player2_id, score: m.player2_score, season_id: m.season_id, week: m.week_start, opponent_id: m.player1_id, game_type: m.game_type });
  }

  // Highest single-week score (regular season)
  const regScores = allScores.filter(s => s.game_type === 'regular');
  regScores.sort((a, b) => b.score - a.score);
  records.highest_regular_score = regScores.slice(0, 10).map(s => ({
    player_id: s.player_id, player_name: playerName(s.player_id),
    value: s.score, season_id: s.season_id, week: s.week,
    opponent: playerName(s.opponent_id),
  }));

  // Lowest single-week score (regular)
  const regScoresAsc = [...regScores].reverse();
  records.lowest_regular_score = regScoresAsc.slice(0, 10).map(s => ({
    player_id: s.player_id, player_name: playerName(s.player_id),
    value: s.score, season_id: s.season_id, week: s.week,
    opponent: playerName(s.opponent_id),
  }));

  // Highest postseason score (includes playoffs + toilet bowl)
  const playoffScores = allScores.filter(s => ['semifinal', 'championship', '3rd_place', 'toilet_bowl'].includes(s.game_type));
  playoffScores.sort((a, b) => b.score - a.score);
  records.highest_playoff_score = playoffScores.slice(0, 10).map(s => ({
    player_id: s.player_id, player_name: playerName(s.player_id),
    value: s.score, season_id: s.season_id, week: s.week,
    opponent: playerName(s.opponent_id), game_type: s.game_type,
  }));

  // Biggest blowout (using normalized scores)
  const margins = normalizedAllGames.map(m => ({
    margin: parseFloat(Math.abs(m.player1_score - m.player2_score).toFixed(2)),
    winner_id: m.player1_score > m.player2_score ? m.player1_id : m.player2_id,
    loser_id: m.player1_score > m.player2_score ? m.player2_id : m.player1_id,
    winner_score: Math.max(m.player1_score, m.player2_score),
    loser_score: Math.min(m.player1_score, m.player2_score),
    season_id: m.season_id, week: m.week_start, game_type: m.game_type,
  }));
  margins.sort((a, b) => b.margin - a.margin);
  records.biggest_blowouts = margins.slice(0, 10).map(m => ({
    ...m,
    winner_name: playerName(m.winner_id),
    loser_name: playerName(m.loser_id),
  }));

  // Closest games
  const closestMargins = [...margins].filter(m => m.margin > 0).sort((a, b) => a.margin - b.margin);
  records.closest_games = closestMargins.slice(0, 10).map(m => ({
    ...m,
    winner_name: playerName(m.winner_id),
    loser_name: playerName(m.loser_id),
  }));

  // Highest-scoring matchup (combined, using normalized scores)
  const combinedScores = normalizedAllGames.map(m => ({
    combined: parseFloat((m.player1_score + m.player2_score).toFixed(2)),
    player1_id: m.player1_id, player2_id: m.player2_id,
    player1_score: m.player1_score, player2_score: m.player2_score,
    season_id: m.season_id, week: m.week_start, game_type: m.game_type,
  }));
  combinedScores.sort((a, b) => b.combined - a.combined);
  records.highest_combined_scores = combinedScores.slice(0, 10).map(m => ({
    ...m,
    player1_name: playerName(m.player1_id),
    player2_name: playerName(m.player2_id),
  }));

  // Season records
  const srCopy = [...seasonResults];
  srCopy.sort((a, b) => b.wins - a.wins);
  records.most_wins_season = srCopy.slice(0, 10).map(r => ({
    player_id: r.player_id, player_name: playerName(r.player_id),
    value: r.wins, record: r.regular_season_record, season_id: r.season_id,
  }));

  const srByPPG = [...seasonResults].sort((a, b) => b.points_per_game - a.points_per_game);
  records.highest_ppg_season = srByPPG.slice(0, 10).map(r => ({
    player_id: r.player_id, player_name: playerName(r.player_id),
    value: r.points_per_game, season_id: r.season_id,
  }));

  const srByPF = [...seasonResults].sort((a, b) => b.points_for - a.points_for);
  records.most_points_season = srByPF.slice(0, 10).map(r => ({
    player_id: r.player_id, player_name: playerName(r.player_id),
    value: r.points_for, season_id: r.season_id,
  }));

  const srByMoves = [...seasonResults].sort((a, b) => b.total_moves - a.total_moves);
  records.most_moves_season = srByMoves.slice(0, 10).map(r => ({
    player_id: r.player_id, player_name: playerName(r.player_id),
    value: r.total_moves, season_id: r.season_id,
  }));

  // Worst records
  const srByLosses = [...seasonResults].sort((a, b) => b.losses - a.losses);
  records.most_losses_season = srByLosses.slice(0, 10).map(r => ({
    player_id: r.player_id, player_name: playerName(r.player_id),
    value: r.losses, record: r.regular_season_record, season_id: r.season_id,
  }));

  // Last place finishes
  records.last_place_counts = players.map(p => ({
    player_id: p.player_id, player_name: p.name,
    value: seasonResults.filter(sr => sr.player_id === p.player_id && sr.rank === 10).length,
  })).sort((a, b) => b.value - a.value);

  // Toilet bowl appearances
  const tbGames = matchups.filter(m => m.game_type === 'toilet_bowl');
  const tbCounts = {};
  for (const m of tbGames) {
    tbCounts[m.player1_id] = (tbCounts[m.player1_id] || 0) + 1;
    tbCounts[m.player2_id] = (tbCounts[m.player2_id] || 0) + 1;
  }
  records.toilet_bowl_appearances = players.map(p => ({
    player_id: p.player_id, player_name: p.name,
    value: tbCounts[p.player_id] || 0,
  })).sort((a, b) => b.value - a.value);

  // Toilet bowl wins (escaped last place)
  const tbWinCounts = {};
  const tbLossCounts = {};
  for (const m of tbGames) {
    const winnerId = m.player1_score > m.player2_score ? m.player1_id : m.player2_id;
    const loserId = m.player1_score > m.player2_score ? m.player2_id : m.player1_id;
    tbWinCounts[winnerId] = (tbWinCounts[winnerId] || 0) + 1;
    tbLossCounts[loserId] = (tbLossCounts[loserId] || 0) + 1;
  }
  records.toilet_bowl_wins = players.map(p => ({
    player_id: p.player_id, player_name: p.name,
    value: tbWinCounts[p.player_id] || 0,
  })).sort((a, b) => b.value - a.value);

  records.toilet_bowl_losses = players.map(p => ({
    player_id: p.player_id, player_name: p.name,
    value: tbLossCounts[p.player_id] || 0,
  })).sort((a, b) => b.value - a.value);

  return records;
}

// ─── Main ────────────────────────────────────────────────────────────────────
console.log('Parsing SQL file...');

const players = parsePlayers(sql);
console.log(`  Players: ${players.length}`);

const seasons = parseSeasons(sql);
console.log(`  Seasons: ${seasons.length}`);

const championships = parseChampionships(sql);
console.log(`  Championships: ${championships.length}`);

const seasonResults = parseSeasonResults(sql);
console.log(`  Season Results: ${seasonResults.length}`);

const matchups = parseMatchups(sql);
console.log(`  Matchups: ${matchups.length}`);

// Compute derived data
console.log('Computing derived data...');
const toiletBowls = computeToiletBowls(matchups, seasons);
console.log(`  Toilet Bowls: ${toiletBowls.length}`);

const headToHead = computeHeadToHead(matchups);
console.log(`  Head-to-Head pairs: ${Object.keys(headToHead).length}`);

const allTimeRecords = computeAllTimeRecords(players, seasonResults, championships, toiletBowls);
console.log(`  All-Time Records: ${allTimeRecords.length}`);

const records = computeRecords(players, seasonResults, matchups);
console.log(`  Record categories: ${Object.keys(records).length}`);

// Write files
const write = (name, data) => {
  const path = join(DATA_DIR, name);
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`  Wrote ${name}`);
};

write('players.json', players);
write('seasons.json', seasons);
write('championships.json', championships);
write('toilet-bowls.json', toiletBowls);
write('season-results.json', seasonResults);
write('matchups.json', matchups);
write('head-to-head.json', headToHead);
write('all-time-records.json', allTimeRecords);
write('records.json', records);

console.log('Done! All data files generated.');

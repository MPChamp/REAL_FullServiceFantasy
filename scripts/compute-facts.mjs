/**
 * Derives per-game and per-season talking points from the weekly lineup
 * archive: what a manager actually scored against the best they could have
 * scored, the single substitution that would have cost or won them the game,
 * and the week's booms and busts against ESPN's projections.
 *
 * Reads only committed data — no network — so it's safe to re-run any time.
 *
 *   node scripts/compute-facts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src', 'data');
const FACTS_DIR = join(DATA_DIR, 'facts');
const read = (name) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf-8'));

const lineupIndex = read('lineup-index.json');
const matchups = read('matchups.json');
const currentSeason = read('current-season.json');

/** Which positions may fill a given lineup slot. */
const SLOT_ELIGIBILITY = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
  K: ['K'],
  'D/ST': ['D/ST'],
};

/**
 * Best possible score from this roster under the slots the manager actually
 * used. Filling the flex from whatever is left after the fixed slots is
 * optimal for this lineup shape, so a greedy pass is exact, not an estimate.
 */
function optimalLineup(roster, slotCounts) {
  const pool = [...roster].sort((a, b) => b.points - a.points);
  const used = new Set();
  const picks = [];

  const take = (slot) => {
    const eligible = SLOT_ELIGIBILITY[slot] ?? [];
    const found = pool.find((p) => !used.has(p.nfl_player_id) && eligible.includes(p.position));
    if (found) {
      used.add(found.nfl_player_id);
      picks.push({ slot, player: found });
    }
  };

  // Fixed slots first; FLEX last so it absorbs the best remaining flex-eligible.
  for (const [slot, count] of Object.entries(slotCounts)) {
    if (slot === 'FLEX') continue;
    for (let i = 0; i < count; i++) take(slot);
  }
  for (let i = 0; i < (slotCounts.FLEX ?? 0); i++) take('FLEX');

  return {
    points: Number(picks.reduce((s, p) => s + p.player.points, 0).toFixed(2)),
    picks,
  };
}

/** The single swap that would have gained the most, and what it was worth. */
function bestMissedSwap(starters, bench) {
  let best = null;
  for (const b of bench) {
    for (const s of starters) {
      const eligible = SLOT_ELIGIBILITY[s.lineup_slot] ?? [];
      if (!eligible.includes(b.position)) continue;
      const gain = b.points - s.points;
      if (gain > 0 && (!best || gain > best.gain)) {
        best = { benched: b, started: s, gain: Number(gain.toFixed(2)) };
      }
    }
  }
  return best;
}

const gameFacts = [];

for (const entry of lineupIndex) {
  const year = entry.season_id;
  const rows = read(`lineups/${year}.json`);

  const byWeekManager = new Map();
  for (const r of rows) {
    const key = `${r.week}:${r.player_id}`;
    if (!byWeekManager.has(key)) byWeekManager.set(key, []);
    byWeekManager.get(key).push(r);
  }

  for (const [key, roster] of byWeekManager) {
    const [week, playerId] = key.split(':').map(Number);
    const starters = roster.filter((r) => r.started);
    const bench = roster.filter((r) => !r.started);
    if (!starters.length) continue;

    const slotCounts = {};
    for (const s of starters) slotCounts[s.lineup_slot] = (slotCounts[s.lineup_slot] ?? 0) + 1;

    const actual = Number(starters.reduce((s, r) => s + r.points, 0).toFixed(2));
    const optimal = optimalLineup(roster, slotCounts);
    const swap = bestMissedSwap(starters, bench);

    // Opponent and result, so a missed swap can be judged against the margin.
    const game =
      matchups.find(
        (m) =>
          m.season_id === year &&
          m.week_start === week &&
          (m.player1_id === playerId || m.player2_id === playerId)
      ) ??
      (year === currentSeason.season_id
        ? currentSeason.schedule.find(
            (g) =>
              g.week === week && (g.home_player_id === playerId || g.away_player_id === playerId)
          )
        : undefined);

    let opponentId = null;
    let opponentPoints = null;
    if (game) {
      if ('player1_id' in game) {
        const isP1 = game.player1_id === playerId;
        opponentId = isP1 ? game.player2_id : game.player1_id;
        opponentPoints = isP1 ? game.player2_score : game.player1_score;
      } else {
        const isHome = game.home_player_id === playerId;
        opponentId = isHome ? game.away_player_id : game.home_player_id;
        opponentPoints = isHome ? game.away_score : game.home_score;
      }
    }

    // A projection of exactly 0 means ESPN didn't record one (1.3% of rows,
    // mostly 2023) — treating it as a real forecast invents huge fake booms.
    const withProjection = starters.filter((r) => r.projected != null && r.projected > 0);
    const boom = withProjection
      .map((r) => ({ r, diff: r.points - r.projected }))
      .sort((a, b) => b.diff - a.diff)[0];
    const bust = withProjection
      .map((r) => ({ r, diff: r.points - r.projected }))
      .sort((a, b) => a.diff - b.diff)[0];
    const topStarter = [...starters].sort((a, b) => b.points - a.points)[0];

    const lost = opponentPoints != null && actual < opponentPoints;
    const slim = (p) => ({
      name: p.nfl_player_name,
      position: p.position,
      points: p.points,
      projected: p.projected,
      slot: p.lineup_slot,
    });

    gameFacts.push({
      season_id: year,
      week,
      player_id: playerId,
      opponent_id: opponentId,
      points: actual,
      opponent_points: opponentPoints,
      optimal_points: optimal.points,
      // Share of the best available score the manager actually captured.
      efficiency: optimal.points > 0 ? Number((actual / optimal.points).toFixed(4)) : null,
      bench_points: Number(bench.reduce((s, r) => s + r.points, 0).toFixed(2)),
      missed_swap: swap
        ? { benched: slim(swap.benched), started: slim(swap.started), gain: swap.gain }
        : null,
      // The swap alone would have flipped the result.
      swap_would_have_won: Boolean(
        lost && swap && actual + swap.gain > opponentPoints
      ),
      // Even a perfect lineup wasn't enough.
      optimal_would_have_won: Boolean(lost && optimal.points > opponentPoints),
      top_starter: slim(topStarter),
      boom: boom && boom.diff > 0 ? { ...slim(boom.r), over: Number(boom.diff.toFixed(2)) } : null,
      bust: bust && bust.diff < 0 ? { ...slim(bust.r), under: Number(Math.abs(bust.diff).toFixed(2)) } : null,
    });
  }
  console.log(`  ${year}: ${byWeekManager.size} manager-weeks`);
}

gameFacts.sort(
  (a, b) => a.season_id - b.season_id || a.week - b.week || a.player_id - b.player_id
);

// ─── Season-level highlights ─────────────────────────────────────────────────
const seasons = [...new Set(gameFacts.map((f) => f.season_id))].sort((a, b) => a - b);
const seasonFacts = seasons.map((year) => {
  const facts = gameFacts.filter((f) => f.season_id === year);
  const withSwap = facts.filter((f) => f.missed_swap);

  const byManager = new Map();
  for (const f of facts) {
    if (!byManager.has(f.player_id)) {
      byManager.set(f.player_id, { bench: 0, actual: 0, optimal: 0, games: 0, blownGames: 0 });
    }
    const m = byManager.get(f.player_id);
    m.bench += f.bench_points;
    m.actual += f.points;
    m.optimal += f.optimal_points;
    m.games++;
    if (f.swap_would_have_won) m.blownGames++;
  }

  const managers = [...byManager.entries()].map(([player_id, m]) => ({
    player_id,
    bench_points: Number(m.bench.toFixed(2)),
    efficiency: m.optimal > 0 ? Number((m.actual / m.optimal).toFixed(4)) : null,
    games_lost_by_lineup: m.blownGames,
  }));

  const best = [...managers].sort((a, b) => (b.efficiency ?? 0) - (a.efficiency ?? 0))[0];
  const worst = [...managers].sort((a, b) => (a.efficiency ?? 1) - (b.efficiency ?? 1))[0];

  return {
    season_id: year,
    // The one benching that cost the most points in the whole season.
    costliest_benching: [...withSwap].sort((a, b) => b.missed_swap.gain - a.missed_swap.gain)[0] ?? null,
    // Losses where one different start would have flipped the result.
    games_lost_by_one_swap: facts.filter((f) => f.swap_would_have_won).length,
    biggest_boom: facts.filter((f) => f.boom).sort((a, b) => b.boom.over - a.boom.over)[0] ?? null,
    biggest_bust: facts.filter((f) => f.bust).sort((a, b) => b.bust.under - a.bust.under)[0] ?? null,
    best_single_start: [...facts].sort((a, b) => b.top_starter.points - a.top_starter.points)[0] ?? null,
    perfect_lineups: facts.filter((f) => f.efficiency === 1).length,
    best_manager: best ?? null,
    worst_manager: worst ?? null,
    most_bench_points: [...managers].sort((a, b) => b.bench_points - a.bench_points)[0] ?? null,
    managers,
  };
});

// Per-season game facts are ~1.3MB together, so they lazy-load a year at a
// time like the lineups; only the small season summary ships in the bundle.
mkdirSync(FACTS_DIR, { recursive: true });
for (const year of seasons) {
  const forYear = gameFacts.filter((f) => f.season_id === year);
  writeFileSync(join(FACTS_DIR, `${year}.json`), JSON.stringify(forYear, null, 2));
}
writeFileSync(join(DATA_DIR, 'season-facts.json'), JSON.stringify(seasonFacts, null, 2));
console.log(`\nWrote ${gameFacts.length} game facts across ${seasons.length} season files, plus season-facts.json.`);

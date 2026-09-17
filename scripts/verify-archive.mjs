/**
 * Re-fetches a spread of weeks straight from ESPN and compares every field
 * against the committed archive, so the data is proven rather than assumed.
 * Exits non-zero on any discrepancy.
 *
 *   node scripts/verify-archive.mjs
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchSeasonPath, fetchLeague, buildTeamMap, POSITIONS } from './espn-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = join(ROOT, 'src', 'data') + '/';
const players = JSON.parse(readFileSync(D + 'players.json', 'utf-8'));
const name = (id) => players.find((p) => p.player_id === id)?.name ?? `#${id}`;
const BENCH = new Set([20, 21]);

const SAMPLES = [
  [2018, 4], [2019, 2], [2019, 5], [2020, 15], [2021, 9],
  [2022, 5], [2023, 2], [2024, 12], [2025, 5], [2025, 17],
];

let totalRows = 0, mismatches = 0, missing = 0, extra = 0;

for (const [year, week] of SAMPLES) {
  const stored = JSON.parse(readFileSync(`${D}lineups/${year}.json`, 'utf-8')).filter((r) => r.week === week);
  const league = await fetchLeague(year, ['mTeam']);
  const teamMap = buildTeamMap(league, year, () => {});
  const box = await fetchSeasonPath(year, ['mBoxscore', 'mMatchupScore'], week);

  const live = [];
  for (const g of (box.schedule ?? []).filter((x) => x.matchupPeriodId === week)) {
    for (const side of ['home', 'away']) {
      const team = teamMap.get(g[side]?.teamId);
      for (const e of g[side]?.rosterForCurrentScoringPeriod?.entries ?? []) {
        if (!team) continue;
        live.push({
          key: `${team.playerId}:${e.playerId}`,
          manager: team.playerId,
          nflId: e.playerId,
          nflName: e.playerPoolEntry?.player?.fullName ?? '?',
          position: POSITIONS[e.playerPoolEntry?.player?.defaultPositionId] ?? 'UNK',
          started: !BENCH.has(e.lineupSlotId),
          points: Number((e.playerPoolEntry?.appliedStatTotal ?? 0).toFixed(2)),
        });
      }
    }
  }

  const storedMap = new Map(stored.map((r) => [`${r.player_id}:${r.nfl_player_id}`, r]));
  const liveMap = new Map(live.map((r) => [r.key, r]));

  const problems = [];
  for (const l of live) {
    const s = storedMap.get(l.key);
    if (!s) { missing++; problems.push(`  MISSING ${name(l.manager)} ${l.nflName}`); continue; }
    totalRows++;
    if (Math.abs(s.points - l.points) > 0.001) {
      mismatches++; problems.push(`  POINTS ${name(l.manager)} ${l.nflName}: stored ${s.points} vs espn ${l.points}`);
    }
    if (s.started !== l.started) {
      mismatches++; problems.push(`  STARTED ${name(l.manager)} ${l.nflName}: stored ${s.started} vs espn ${l.started}`);
    }
    if (s.nfl_player_name !== l.nflName) {
      mismatches++; problems.push(`  NAME ${l.nflName} vs stored ${s.nfl_player_name}`);
    }
    if (s.position !== l.position) {
      mismatches++; problems.push(`  POS ${l.nflName}: stored ${s.position} vs espn ${l.position}`);
    }
  }
  for (const k of storedMap.keys()) if (!liveMap.has(k)) extra++;

  console.log(`${year} wk${String(week).padStart(2)}: ${live.length} rows from ESPN, ${stored.length} stored — ${problems.length ? problems.length + ' PROBLEM(S)' : 'identical'}`);
  for (const p of problems.slice(0, 5)) console.log(p);
}

console.log('\n' + '='.repeat(60));
console.log(`compared ${totalRows} player-weeks against live ESPN`);
console.log(`  field mismatches: ${mismatches}`);
console.log(`  rows ESPN has that we don't: ${missing}`);
console.log(`  rows we have that ESPN doesn't: ${extra}`);
if (mismatches + missing + extra === 0) {
  console.log('\nARCHIVE MATCHES ESPN EXACTLY');
} else {
  console.error('\nDISCREPANCIES FOUND');
  process.exit(1);
}

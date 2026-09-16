/**
 * Rewrites season_results.total_moves in the SQL source using ESPN's
 * transaction counters (acquisitions + trades). Run once; re-running is a
 * no-op when the SQL already matches ESPN.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchLeague, buildTeamMap } from './espn-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = join(ROOT, '..', 'FF_2025_Updated.sql');
const DATA_DIR = join(ROOT, 'src', 'data');

const players = JSON.parse(readFileSync(join(DATA_DIR, 'players.json'), 'utf-8'));
const seasons = JSON.parse(readFileSync(join(DATA_DIR, 'seasons.json'), 'utf-8'));
const name = (id) => players.find((p) => p.player_id === id)?.name ?? `#${id}`;

console.log('Fetching ESPN transaction counters...');
const moves = new Map(); // `${playerId}:${seasonId}` -> acquisitions + trades

for (const season of seasons) {
  const league = await fetchLeague(season.year, ['mTeam']);
  const teamMap = buildTeamMap(league, season.year, (m) => console.warn(`  ! ${m}`));
  for (const team of league.teams ?? []) {
    const playerId = teamMap.get(team.id)?.playerId;
    if (!playerId) continue;
    const tc = team.transactionCounter ?? {};
    moves.set(`${playerId}:${season.year}`, (tc.acquisitions ?? 0) + (tc.trades ?? 0));
  }
  console.log(`  ${season.year}: ${league.teams?.length ?? 0} teams`);
}

// Row shape (same in both INSERT styles):
// (player_id, season_id, rank, 'record', w, l, t, pf, pa, ppg, papg, total_moves, made_playoffs)
const ROW = /\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*(\d+)\s*,\s*(TRUE|FALSE|0|1)\s*\)/gi;

const sql = readFileSync(SQL_PATH, 'utf-8');
const changes = [];
let unmatched = 0;

const MOVES_INDEX = 11; // 12th of 13 comma-separated fields

const updated = sql.replace(ROW, (full, pid, sid, ...rest) => {
  const oldMoves = rest[9];
  const key = `${Number(pid)}:${Number(sid)}`;
  if (!moves.has(key)) {
    unmatched++;
    return full;
  }
  const next = moves.get(key);
  if (Number(oldMoves) === next) return full;

  // No field in this row contains a comma, so a plain split is unambiguous and
  // preserves each field's original spacing.
  const parts = full.slice(1, -1).split(',');
  if (parts.length !== 13) {
    console.warn(`  ! skipped malformed row: ${full}`);
    return full;
  }
  parts[MOVES_INDEX] = parts[MOVES_INDEX].replace(/\d+/, String(next));

  changes.push({ season: Number(sid), player: Number(pid), from: Number(oldMoves), to: next });
  return `(${parts.join(',')})`;
});

const rowCount = (sql.match(ROW) ?? []).length;
console.log(`\nParsed ${rowCount} season_results rows (${unmatched} with no ESPN counterpart).`);

if (!changes.length) {
  console.log('No changes needed — SQL already matches ESPN.');
  process.exit(0);
}

writeFileSync(SQL_PATH, updated);
console.log(`Updated ${changes.length} rows in FF_2025_Updated.sql:\n`);
for (const c of changes.sort((a, b) => a.season - b.season || a.player - b.player)) {
  console.log(`  ${c.season} ${name(c.player).padEnd(7)} ${String(c.from).padStart(3)} -> ${c.to}`);
}
console.log('\nRun `node scripts/convert-sql-to-json.mjs` to regenerate the JSON data.');

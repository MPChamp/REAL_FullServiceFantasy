import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';

function loadEnv() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) {
    throw new Error('.env.local not found — needs ESPN_LEAGUE_ID, ESPN_S2, ESPN_SWID');
  }
  const env = {};
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const i = line.indexOf('=');
    if (i === -1 || line.trim().startsWith('#')) continue;
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ['ESPN_LEAGUE_ID', 'ESPN_S2', 'ESPN_SWID']) {
    if (!env[key]) throw new Error(`.env.local is missing ${key}`);
  }
  return env;
}

const env = loadEnv();
export const LEAGUE_ID = env.ESPN_LEAGUE_ID;

// ESPN serves the in-progress season under /seasons/ and finished ones under
// /leagueHistory/, which returns a single-element array instead of an object.
export const CURRENT_SEASON = Number(env.ESPN_CURRENT_SEASON ?? new Date().getFullYear());

const cookie = `espn_s2=${env.ESPN_S2}; SWID=${env.ESPN_SWID}`;

async function request(url, filter) {
  const headers = { Cookie: cookie, Accept: 'application/json' };
  if (filter) headers['x-fantasy-filter'] = JSON.stringify(filter);

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${url.replace(LEAGUE_ID, '<league>')}`);
  }
  return res.json();
}

/** leagueHistory wraps its single league in an array; /seasons/ does not. */
async function requestLeague(url, filter) {
  const json = await request(url, filter);
  return Array.isArray(json) ? json[0] : json;
}

export function leagueUrl(year, views = []) {
  const params = views.map((v) => `view=${v}`);
  if (year >= CURRENT_SEASON) {
    return `${BASE}/seasons/${year}/segments/0/leagues/${LEAGUE_ID}${params.length ? `?${params.join('&')}` : ''}`;
  }
  return `${BASE}/leagueHistory/${LEAGUE_ID}?seasonId=${year}${params.length ? `&${params.join('&')}` : ''}`;
}

export function fetchLeague(year, views, filter) {
  return requestLeague(leagueUrl(year, views), filter);
}

export async function fetchPlayerNames(year, playerIds) {
  const unique = [...new Set(playerIds)];
  if (!unique.length) return new Map();

  const resolved = new Map();
  const BATCH = 250;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const players = await request(`${BASE}/seasons/${year}/players?scoringPeriodId=0&view=players_wl`, {
      filterIds: { value: batch },
    });
    for (const p of Array.isArray(players) ? players : []) {
      resolved.set(p.id, p);
    }
  }
  return resolved;
}

export const POSITIONS = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  7: 'P',
  9: 'DT',
  10: 'DE',
  11: 'LB',
  12: 'CB',
  13: 'S',
  16: 'D/ST',
};

export const PRO_TEAMS = {
  0: 'FA',
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'LV',
  14: 'LAR',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WSH',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU',
};

// ESPN member GUID -> the site's player_id in src/data/players.json, keyed on
// GUID because ESPN team ids get reshuffled between seasons. A manager who has
// switched ESPN accounts has one entry per account pointing at the same player.
//
// Kept in a gitignored file: an ESPN member GUID is also the SWID auth cookie,
// so these values must not reach a public repo. See espn-members.example.json.
function loadMembers() {
  const path = join(ROOT, 'scripts', 'espn-members.json');
  if (!existsSync(path)) {
    throw new Error(
      'scripts/espn-members.json not found — copy scripts/espn-members.example.json and fill it in'
    );
  }
  const raw = JSON.parse(readFileSync(path, 'utf-8'));
  const map = {};
  for (const [guid, entry] of Object.entries(raw)) {
    if (guid.startsWith('_')) continue;
    map[guid] = entry.player_id;
  }
  return map;
}

export const MEMBER_TO_PLAYER_ID = loadMembers();

/** Maps that season's ESPN team ids onto site player ids via each team's owner. */
export function buildTeamMap(league, year, warn) {
  const map = new Map();
  for (const team of league.teams ?? []) {
    const owner = team.owners?.[0];
    const playerId = MEMBER_TO_PLAYER_ID[owner];
    if (!playerId) {
      warn?.(`${year}: unknown owner ${owner} for team ${team.id} "${team.name}"`);
      continue;
    }
    map.set(team.id, { playerId, teamName: team.name?.trim(), abbrev: team.abbrev });
  }
  return map;
}

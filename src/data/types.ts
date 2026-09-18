// ============================================
// Fantasy Football History — TypeScript Interfaces
// ============================================

export interface Player {
  player_id: number;
  name: string;
}

export interface Season {
  season_id: number;
  year: number;
  regular_season_end_week: number;
  playoff_format: 'combined' | 'weekly';
}

export interface SeasonResult {
  result_id: number;
  player_id: number;
  season_id: number;
  rank: number;
  regular_season_record: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  points_per_game: number;
  points_against_per_game: number;
  total_moves: number;
  made_playoffs: boolean;
}

export interface Championship {
  championship_id: number;
  season_id: number;
  winner_id: number;
  runner_up_id: number;
}

export interface ToiletBowl {
  season_id: number;
  year: number;
  winner_id: number;
  loser_id: number;
  winner_score: number;
  loser_score: number;
}

export interface WeeklyMatchup {
  matchup_id: number;
  season_id: number;
  week_start: number;
  week_end: number | null;
  weeks_included: string | null;
  player1_id: number;
  player2_id: number;
  player1_score: number;
  player2_score: number;
  game_type: 'regular' | 'semifinal' | 'championship' | '3rd_place' | 'toilet_bowl';
  notes: string | null;
}

export interface AllTimeRecord {
  player_id: number;
  name: string;
  total_wins: number;
  total_losses: number;
  total_ties: number;
  total_games: number;
  win_percentage: number;
  total_points_for: number;
  total_points_against: number;
  career_ppg: number;
  playoff_appearances: number;
  championships: number;
  runner_ups: number;
  toilet_bowl_wins: number;
  toilet_bowl_losses: number;
  average_rank: number;
  seasons_played: number;
}

export interface HeadToHeadMatchup {
  season_id: number;
  week_start: number;
  player1_score: number;
  player2_score: number;
  game_type: 'regular' | 'semifinal' | 'championship' | '3rd_place' | 'toilet_bowl';
}

export interface HeadToHeadRecord {
  player1_id: number;
  player2_id: number;
  player1_wins: number;
  player2_wins: number;
  ties: number;
  total_matchups: number;
  player1_total_points: number;
  player2_total_points: number;
  matchups: HeadToHeadMatchup[];
}

// ============================================
// ESPN-sourced data (see scripts/fetch-espn.mjs)
// ============================================

export type NflPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'D/ST' | 'UNK';

export interface NflPlayer {
  nfl_player_id: number;
  nfl_player_name: string;
  position: NflPosition;
  pro_team: string;
}

export interface DraftPick extends NflPlayer {
  season_id: number;
  overall_pick: number;
  round: number;
  round_pick: number;
  player_id: number;
  keeper: boolean;
}

/**
 * One player on a manager's roster. For finished seasons this is the
 * end-of-season squad (ESPN keeps no weekly history); for the season in
 * progress it's the live roster.
 */
export interface RosterSpot extends NflPlayer {
  season_id: number;
  player_id: number;
  slot: 'starter' | 'bench' | 'ir';
  /** True when this manager drafted the player that same year. */
  drafted: boolean;
}

/**
 * One player's line in a single week's lineup. Available from 2018 — that's as
 * far back as ESPN keeps boxscore rosters, and only via the /seasons/ path
 * (leagueHistory returns the same shape with rosters stripped out).
 *
 * Lives in src/data/lineups/{year}.json rather than one file: the full archive
 * is ~21k rows, so the app lazy-loads a season at a time.
 */
export interface WeeklyLineupSpot extends NflPlayer {
  season_id: number;
  week: number;
  player_id: number;
  lineup_slot: string;
  started: boolean;
  points: number;
  /** ESPN's pre-game projection, null when it wasn't recorded. */
  projected: number | null;
}

/** Bundled summary of which seasons and weeks have lineup files. */
export interface LineupIndexEntry {
  season_id: number;
  weeks: number[];
  rows: number;
}

export interface TeamName {
  season_id: number;
  player_id: number;
  espn_team_id: number;
  team_name: string;
  abbrev: string;
}

/**
 * ESPN consolation-ladder games. Deliberately kept out of matchups.json so they
 * never reach records, career stats, or head-to-head — only the playoff bracket
 * and the 9th/10th toilet bowl count in this league.
 */
export interface ConsolationGame {
  season_id: number;
  week: number;
  home_player_id: number;
  away_player_id: number;
  home_score: number;
  away_score: number;
  tier: string;
}

/**
 * A roster move recovered by diffing consecutive weekly rosters, for the
 * seasons whose transaction feed ESPN has already discarded (2018 onward).
 *
 * Validated against ESPN's per-team counters: 2,227 reconstructed acquisitions
 * against 2,214 recorded. Two limits are inherent to the method — moves are
 * dated to the gap between two weeks rather than a timestamp, and a player
 * dropped and re-added within one gap leaves no trace.
 */
export interface ReconstructedMove extends NflPlayer {
  season_id: number;
  week: number;
  /** The move happened between this week and `week`; 0 means since the draft. */
  after_week: number;
  player_id: number;
  kind: 'add' | 'drop' | 'claimed' | 'released' | 'trade_in' | 'trade_out';
  /** The other manager, when the player changed hands directly. */
  counterparty: number | null;
  /** Points scored in this manager's starting lineup after the move. */
  started_points?: number;
  /** Points scored while sitting on their bench after the move. */
  bench_points?: number;
  /** started + bench, i.e. everything he scored while on their roster. */
  rostered_points?: number;
  weeks_started?: number;
  weeks_rostered?: number;
}

/** One side's haul in a trade, scored by what it returned afterwards. */
export interface TradePiece {
  nfl_player_id: number;
  nfl_player_name: string;
  position: NflPosition;
  /** Points scored while in the acquirer's starting lineup. */
  started_points: number;
  bench_points: number;
  /** started + bench, i.e. everything he scored while on their roster. */
  rostered_points: number;
  weeks_started: number;
  weeks_rostered: number;
}

/**
 * A detected trade, judged on points each side's incoming players went on to
 * score *in the lineup* from that week forward.
 */
export interface TradeSummary {
  season_id: number;
  week: number;
  manager_a: number;
  manager_b: number;
  a_received: TradePiece[];
  b_received: TradePiece[];
  a_points: number;
  b_points: number;
  margin: number;
  winner: number | null;
}

export interface Transaction {
  transaction_id: string;
  season_id: number;
  week: number;
  date: string;
  player_id: number;
  type: 'waiver' | 'free_agent' | 'trade';
  bid_amount: number;
  adds: NflPlayer[];
  drops: NflPlayer[];
}

export interface CurrentStanding {
  player_id: number;
  team_name: string;
  abbrev: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
  rank: number | null;
}

export interface CurrentGame {
  week: number;
  home_player_id: number;
  away_player_id: number;
  home_score: number;
  away_score: number;
  winner: 'home' | 'away' | null;
  playoff_tier: string | null;
}

export interface CurrentSeason {
  season_id: number;
  league_name: string | null;
  current_week: number | null;
  current_matchup_period: number | null;
  regular_season_weeks: number | null;
  playoff_team_count: number | null;
  is_active: boolean;
  last_updated: string;
  standings: CurrentStanding[];
  schedule: CurrentGame[];
}

// ============================================
// Derived talking points (see scripts/compute-facts.mjs)
// ============================================

/** A player line as it appears inside a fact. */
export interface FactPlayer {
  name: string;
  position: NflPosition;
  points: number;
  projected: number | null;
  slot: string;
}

/**
 * One manager's week, measured against the best lineup their roster allowed.
 * Lives in src/data/facts/{year}.json and lazy-loads a season at a time.
 */
export interface GameFact {
  season_id: number;
  week: number;
  player_id: number;
  opponent_id: number | null;
  points: number;
  opponent_points: number | null;
  /** Best score the roster could have produced under the slots actually used. */
  optimal_points: number;
  /** points / optimal_points; 1 means a perfect lineup. */
  efficiency: number | null;
  bench_points: number;
  /** The single substitution that would have gained the most. */
  missed_swap: { benched: FactPlayer; started: FactPlayer; gain: number } | null;
  /** That one swap alone would have turned the loss into a win. */
  swap_would_have_won: boolean;
  /** Even a perfect lineup would still have won it. */
  optimal_would_have_won: boolean;
  top_starter: FactPlayer;
  boom: (FactPlayer & { over: number }) | null;
  bust: (FactPlayer & { under: number }) | null;
}

export interface SeasonManagerFact {
  player_id: number;
  bench_points: number;
  efficiency: number | null;
  games_lost_by_lineup: number;
}

export interface SeasonFact {
  season_id: number;
  costliest_benching: GameFact | null;
  games_lost_by_one_swap: number;
  biggest_boom: GameFact | null;
  biggest_bust: GameFact | null;
  best_single_start: GameFact | null;
  perfect_lineups: number;
  best_manager: SeasonManagerFact | null;
  worst_manager: SeasonManagerFact | null;
  most_bench_points: SeasonManagerFact | null;
  managers: SeasonManagerFact[];
}

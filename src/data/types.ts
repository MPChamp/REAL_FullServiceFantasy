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

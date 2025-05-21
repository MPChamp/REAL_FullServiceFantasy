import sqlite3
import datetime
from flask import Flask, render_template, g, abort, request
from collections import defaultdict

# Configuration
DATABASE = 'REAL_Fantasy_Football_DB.db'

app = Flask(__name__)

# --- Database Helper Functions ---
def get_db():
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = sqlite3.connect(DATABASE)
        g.sqlite_db.row_factory = sqlite3.Row
    return g.sqlite_db

@app.teardown_appcontext
def close_db(error):
    if hasattr(g, 'sqlite_db'):
        g.sqlite_db.close()

# --- Context Processor ---
@app.context_processor
def inject_current_year():
    return {'current_year': datetime.datetime.now().year, 'float': float}

# --- Helper Function for Record Queries ---
def fetch_record(query, params=()):
    db = get_db()
    cursor = db.execute(query, params)
    row = cursor.fetchone()
    return dict(row) if row else None

def fetch_all_records(query, params=()):
    db = get_db()
    cursor = db.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


# --- Routes ---

@app.route('/')
def index():
    try:
        db = get_db()
        players = fetch_all_records("SELECT player_id, name FROM players ORDER BY name")
        
        latest_champion_data = fetch_record("""
            SELECT p.player_id as winner_id, p.name AS winner_name, s.year
            FROM championships c
            JOIN players p ON c.winner_id = p.player_id
            JOIN seasons s ON c.season_id = s.season_id
            ORDER BY s.year DESC
            LIMIT 1
        """)

        all_champions_history = fetch_all_records("""
            SELECT p.player_id as winner_id, p.name AS winner_name, s.year
            FROM championships c
            JOIN players p ON c.winner_id = p.player_id
            JOIN seasons s ON c.season_id = s.season_id
            ORDER BY s.year DESC
        """)

        # Fetch all Toilet Bowl "winners" (i.e., losers of the Toilet Bowl game)
        all_toilet_losers_history = fetch_all_records("""
            SELECT
                s.year,
                CASE
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score < wm.player2_score THEN p1.player_id
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score < wm.player1_score THEN p2.player_id
                    ELSE NULL -- Should not happen if scores are present and different
                END as loser_id,
                CASE
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score < wm.player2_score THEN p1.name
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score < wm.player1_score THEN p2.name
                    ELSE NULL
                END as loser_name
            FROM weekly_matchups wm
            JOIN seasons s ON wm.season_id = s.season_id
            JOIN players p1 ON wm.player1_id = p1.player_id
            JOIN players p2 ON wm.player2_id = p2.player_id
            WHERE wm.game_type = 'toilet_bowl'
              AND wm.player1_score IS NOT NULL
              AND wm.player2_score IS NOT NULL
              AND wm.player1_score != wm.player2_score -- Exclude ties from defining a "loser"
            ORDER BY s.year DESC
        """)
        # Filter out any null results from the CASE statement if a game didn't clearly define a loser
        all_toilet_losers_history = [loser for loser in all_toilet_losers_history if loser['loser_id'] is not None]

        return render_template('index.html', 
                               players=players, 
                               latest_champion=latest_champion_data,
                               all_champions=all_champions_history,
                               all_toilet_losers=all_toilet_losers_history)
    except sqlite3.Error as e:
        print(f"Database error on index page: {e}")
        return "An error occurred fetching data.", 500
    except Exception as e:
        print(f"Error on index page: {e}")
        import traceback
        traceback.print_exc()
        return "An unexpected error occurred.", 500

# (Keep all your other routes: seasons_list, season_detail, player_detail, head_to_head, record_book, standings, weekly_results, errorhandler, and if __name__ == '__main__': block)
# ... (The rest of your app.py)
# For brevity, I'm only showing the modified index route and its dependencies.
# The full app.py from flask_app_json_fix should be used as the base.

@app.route('/seasons')
def seasons_list():
    try:
        all_seasons = fetch_all_records("SELECT year FROM seasons ORDER BY year DESC")
        return render_template('seasons.html', seasons=all_seasons)
    except sqlite3.Error as e:
        print(f"Database error on seasons list page: {e}")
        return "An error occurred fetching season data.", 500
    except Exception as e:
        print(f"Error on seasons list page: {e}")
        return "An unexpected error occurred.", 500

@app.route('/seasons/<int:year>')
def season_detail(year):
    try:
        season = fetch_record("SELECT season_id, regular_season_end_week FROM seasons WHERE year = ?", (year,))
        if season is None: abort(404, description=f"Season {year} not found.")
        season_id = season['season_id']
        reg_season_end = season['regular_season_end_week']
        
        results = fetch_all_records("""
            SELECT sr.rank, p.player_id, p.name, sr.regular_season_record, sr.wins, sr.losses, sr.ties, sr.points_for, sr.points_against, sr.made_playoffs
            FROM season_results sr JOIN players p ON sr.player_id = p.player_id
            WHERE sr.season_id = ? ORDER BY sr.rank ASC
        """, (season_id,))
        
        championship_info = fetch_record("""
            SELECT wp.player_id as winner_id, wp.name as winner_name, rp.player_id as runner_up_id, rp.name as runner_up_name
            FROM championships ch JOIN players wp ON ch.winner_id = wp.player_id JOIN players rp ON ch.runner_up_id = rp.player_id
            WHERE ch.season_id = ?
        """, (season_id,))
        
        toilet_bowl_winner_id, toilet_bowl_loser_id = None, None
        tb_match = fetch_record("SELECT player1_id, player2_id, player1_score, player2_score FROM weekly_matchups WHERE season_id = ? AND game_type = 'toilet_bowl' LIMIT 1", (season_id,))
        if tb_match and tb_match.get('player1_score') is not None and tb_match.get('player2_score') is not None:
            if tb_match['player1_score'] > tb_match['player2_score']:
                toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player1_id'], tb_match['player2_id']
            elif tb_match['player2_score'] > tb_match['player1_score']:
                toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player2_id'], tb_match['player1_id']
        
        weeks_data = fetch_all_records("SELECT DISTINCT week_start FROM weekly_matchups WHERE season_id = ? ORDER BY week_start ASC", (season_id,))
        weeks_list = [{'week_start': w['week_start'], 'is_playoff': reg_season_end is not None and w['week_start'] > reg_season_end} for w in weeks_data] if weeks_data else []
        
        return render_template('season_detail.html', year=year, results=results,
                               championship=championship_info,
                               toilet_bowl_winner_id=toilet_bowl_winner_id,
                               toilet_bowl_loser_id=toilet_bowl_loser_id,
                               weeks=weeks_list)
    except sqlite3.Error as e: print(f"Database error on season detail page for {year}: {e}"); return f"An error occurred fetching data for the {year} season.", 500
    except Exception as e: print(f"Error on season detail page for {year}: {e}"); import traceback; traceback.print_exc(); return "An unexpected error occurred.", 500

@app.route('/players/<int:player_id>')
def player_detail(player_id):
    try:
        db = get_db()
        player = fetch_record("SELECT name FROM players WHERE player_id = ?", (player_id,))
        if player is None:
            abort(404, description=f"Player ID {player_id} not found.")
        player_name = player['name']

        history = fetch_all_records("""
            SELECT s.year, sr.rank, sr.regular_season_record, sr.wins, sr.losses, sr.ties, 
                   sr.points_for, sr.points_against, sr.made_playoffs 
            FROM season_results sr 
            JOIN seasons s ON sr.season_id = s.season_id 
            WHERE sr.player_id = ? 
            ORDER BY s.year DESC
        """, (player_id,))

        total_wins, total_losses, total_ties, total_pf, total_pa, total_rank, playoff_appearances = 0, 0, 0, 0.0, 0.0, 0, 0
        seasons_played = len(history)
        for season_dict in history: 
            total_wins += season_dict.get('wins', 0) or 0
            total_losses += season_dict.get('losses', 0) or 0
            total_ties += season_dict.get('ties', 0) or 0
            total_pf += season_dict.get('points_for', 0.0) or 0.0
            total_pa += season_dict.get('points_against', 0.0) or 0.0
            total_rank += season_dict.get('rank', 0) or 0
            if season_dict.get('made_playoffs') == 1:
                playoff_appearances += 1
        
        total_games = total_wins + total_losses + total_ties
        win_percentage = (total_wins / total_games * 100) if total_games > 0 else 0.0
        avg_rank = (total_rank / seasons_played) if seasons_played > 0 else 0.0
        avg_pf_per_season = (total_pf / seasons_played) if seasons_played > 0 else 0.0
        avg_pa_per_season = (total_pa / seasons_played) if seasons_played > 0 else 0.0

        championship_wins = fetch_all_records("SELECT s.year FROM championships c JOIN seasons s ON c.season_id = s.season_id WHERE c.winner_id = ? ORDER BY s.year DESC", (player_id,))
        runner_up_finishes = fetch_all_records("SELECT s.year FROM championships c JOIN seasons s ON c.season_id = s.season_id WHERE c.runner_up_id = ? ORDER BY s.year DESC", (player_id,))
        third_place_finishes = fetch_all_records("""SELECT s.year FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = '3rd_place' AND ((wm.player1_id = ? AND wm.player1_score > wm.player2_score) OR (wm.player2_id = ? AND wm.player2_score > wm.player1_score)) ORDER BY s.year DESC""", (player_id, player_id))
        
        toilet_bowl_history = {} 
        toilet_bowl_wins, toilet_bowl_losses = 0, 0
        tb_matchups = fetch_all_records("""SELECT s.year, wm.player1_id, wm.player2_id, wm.player1_score, wm.player2_score FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'toilet_bowl' AND (wm.player1_id = ? OR wm.player2_id = ?)""", (player_id, player_id))
        for tb_match in tb_matchups: 
            year_val, p1_score, p2_score = tb_match['year'], tb_match['player1_score'], tb_match['player2_score']
            if p1_score is not None and p2_score is not None:
                if tb_match['player1_id'] == player_id:
                    if p1_score > p2_score: toilet_bowl_history[year_val] = 'win'; toilet_bowl_wins += 1
                    elif p2_score > p1_score: toilet_bowl_history[year_val] = 'loss'; toilet_bowl_losses += 1
                elif tb_match['player2_id'] == player_id:
                    if p2_score > p1_score: toilet_bowl_history[year_val] = 'win'; toilet_bowl_wins += 1
                    elif p1_score > p2_score: toilet_bowl_history[year_val] = 'loss'; toilet_bowl_losses += 1
        
        player_records = {} 
        player_records['best_rank'] = fetch_record("SELECT MIN(rank) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.rank IS NOT NULL", (player_id,))
        player_records['worst_rank'] = fetch_record("SELECT MAX(rank) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.rank IS NOT NULL", (player_id,))
        player_records['highest_pf'] = fetch_record("SELECT MAX(points_for) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_for IS NOT NULL", (player_id,))
        player_records['highest_ppg'] = fetch_record("SELECT MAX(points_per_game) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_per_game IS NOT NULL", (player_id,))
        player_records['lowest_pf'] = fetch_record("SELECT MIN(points_for) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_for IS NOT NULL", (player_id,))
        player_records['lowest_ppg'] = fetch_record("SELECT MIN(points_per_game) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_per_game IS NOT NULL", (player_id,))

        career_stats = {
            'seasons_played': seasons_played, 'total_wins': total_wins, 'total_losses': total_losses, 
            'total_ties': total_ties, 'win_percentage': win_percentage, 'total_pf': total_pf, 
            'total_pa': total_pa, 'avg_rank': avg_rank, 'avg_pf_per_season': avg_pf_per_season, 
            'avg_pa_per_season': avg_pa_per_season, 'playoff_appearances': playoff_appearances
        }
        
        return render_template('player_detail.html', 
                               player_id=player_id, 
                               player_name=player_name, 
                               history=history, 
                               championship_wins=championship_wins, 
                               runner_up_finishes=runner_up_finishes, 
                               third_place_finishes=third_place_finishes, 
                               career_stats=career_stats, 
                               toilet_bowl_wins=toilet_bowl_wins, 
                               toilet_bowl_losses=toilet_bowl_losses, 
                               toilet_bowl_history=toilet_bowl_history, 
                               player_records=player_records)
    except sqlite3.Error as e:
        print(f"Database error on player detail page for ID {player_id}: {e}")
        return f"An error occurred fetching data for player ID {player_id}.", 500
    except Exception as e:
        print(f"Error on player detail page for ID {player_id}: {e}")
        import traceback
        traceback.print_exc()
        return f"An unexpected error occurred: {e}", 500

@app.route('/head-to-head', methods=['GET'])
def head_to_head():
    db = get_db()
    players = fetch_all_records("SELECT player_id, name FROM players ORDER BY name") 
    p1_id_str = request.args.get('player1_id')
    p2_id_str = request.args.get('player2_id')
    matchups_data, h2h_stats, player1_data, player2_data, error_message = [], None, None, None, None 
    rivalry_stats = None
    if p1_id_str and p2_id_str:
        try:
            p1_id, p2_id = int(p1_id_str), int(p2_id_str)
            if p1_id == p2_id: error_message = "Please select two different players."
            else:
                player1_data = fetch_record("SELECT player_id, name FROM players WHERE player_id = ?", (p1_id,)) 
                player2_data = fetch_record("SELECT player_id, name FROM players WHERE player_id = ?", (p2_id,)) 
                if not player1_data or not player2_data: error_message = "One or both selected players not found."
                else:
                    matchups_data = fetch_all_records("""
                        SELECT wm.matchup_id, s.year, wm.week_start, wm.week_end, wm.weeks_included,
                               p1.name as p1_name, p2.name as p2_name, wm.player1_id, wm.player2_id,
                               wm.player1_score, wm.player2_score, wm.game_type
                        FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id
                        JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id
                        WHERE (wm.player1_id = ? AND wm.player2_id = ?) OR (wm.player1_id = ? AND wm.player2_id = ?)
                        ORDER BY s.year DESC, wm.week_start DESC
                    """, (p1_id, p2_id, p2_id, p1_id)) 
                    
                    p1_wins, p2_wins, ties = 0, 0, 0
                    p1_total_score, p2_total_score = 0.0, 0.0
                    p1_max_score, p1_max_score_details = 0.0, ''
                    p2_max_score, p2_max_score_details = 0.0, ''
                    p1_min_score, p1_min_score_details = float('inf'), ''
                    p2_min_score, p2_min_score_details = float('inf'), ''
                    p1_max_mov, p1_max_mov_details = 0.0, ''
                    p2_max_mov, p2_max_mov_details = 0.0, ''
                    max_combined, max_combined_details = 0.0, ''
                    min_combined, min_combined_details = float('inf'), ''

                    for m_dict in matchups_data: 
                        p1_s_val = m_dict['player1_score']
                        p2_s_val = m_dict['player2_score']

                        if m_dict['player1_id'] == p1_id:
                            p1_s = p1_s_val
                            p2_s = p2_s_val
                        else: 
                            p1_s = p2_s_val
                            p2_s = p1_s_val

                        year_val, week_val = m_dict['year'], m_dict['week_start']
                        game_details = f"(Week {week_val}, {year_val})"
                        if p1_s is None or p2_s is None: continue
                        
                        try:
                            p1_s_float = float(p1_s)
                            p2_s_float = float(p2_s)
                        except (ValueError, TypeError):
                            continue 

                        p1_total_score += p1_s_float
                        p2_total_score += p2_s_float
                        if p1_s_float > p1_max_score: p1_max_score, p1_max_score_details = p1_s_float, game_details
                        if p2_s_float > p2_max_score: p2_max_score, p2_max_score_details = p2_s_float, game_details
                        if p1_s_float < p1_min_score: p1_min_score, p1_min_score_details = p1_s_float, game_details
                        if p2_s_float < p2_min_score: p2_min_score, p2_min_score_details = p2_s_float, game_details
                        combined = p1_s_float + p2_s_float
                        if combined > max_combined: max_combined, max_combined_details = combined, game_details
                        if combined < min_combined: min_combined, min_combined_details = combined, game_details
                        margin = abs(p1_s_float - p2_s_float)
                        if p1_s_float > p2_s_float:
                            p1_wins += 1
                            if margin > p1_max_mov: p1_max_mov, p1_max_mov_details = margin, game_details
                        elif p2_s_float > p1_s_float:
                            p2_wins += 1
                            if margin > p2_max_mov: p2_max_mov, p2_max_mov_details = margin, game_details
                        else: ties += 1
                    
                    if p1_min_score == float('inf'): p1_min_score = None 
                    if p2_min_score == float('inf'): p2_min_score = None 
                    if min_combined == float('inf'): min_combined = None 

                    h2h_stats = {'p1_wins': p1_wins, 'p2_wins': p2_wins, 'ties': ties, 'p1_total_score': p1_total_score, 'p2_total_score': p2_total_score, 'total_matchups': len(matchups_data)}
                    rivalry_stats = {'p1_max_score': p1_max_score, 'p1_max_score_details': p1_max_score_details, 'p2_max_score': p2_max_score, 'p2_max_score_details': p2_max_score_details, 'p1_min_score': p1_min_score, 'p1_min_score_details': p1_min_score_details, 'p2_min_score': p2_min_score, 'p2_min_score_details': p2_min_score_details, 'p1_max_mov': p1_max_mov, 'p1_max_mov_details': p1_max_mov_details, 'p2_max_mov': p2_max_mov, 'p2_max_mov_details': p2_max_mov_details, 'max_combined': max_combined, 'max_combined_details': max_combined_details, 'min_combined': min_combined, 'min_combined_details': min_combined_details}
        except ValueError: error_message = "Invalid player ID selected."
        except sqlite3.Error as e: print(f"Database error on H2H page: {e}"); error_message = "An error occurred fetching matchup data."
        except Exception as e: print(f"Error on H2H page: {e}"); import traceback; traceback.print_exc(); error_message = "An unexpected error occurred."
    return render_template('head_to_head.html', players=players, selected_p1_id=int(p1_id_str) if p1_id_str else None,
                           selected_p2_id=int(p2_id_str) if p2_id_str else None, player1=player1_data, player2=player2_data,
                           matchups=matchups_data, h2h_stats=h2h_stats, rivalry_stats=rivalry_stats, error_message=error_message)

@app.route('/record-book')
def record_book():
    try:
        db = get_db()
        records = {}
        default_single_game_score_record = {'score': 0.0, 'player_name': 'N/A', 'opponent_name': 'N/A', 'week': 'N/A', 'year': 'N/A', 'game_type': 'N/A'}
        default_single_game_mov_record = {'margin': 0.0, 'p1_name': 'N/A', 'p2_name': 'N/A', 'player1_score': 0.0, 'player2_score': 0.0, 'year': 'N/A', 'week_start': 'N/A', 'game_type': 'N/A'}
        default_single_game_combined_record = {'combined_score': 0.0, 'p1_name': 'N/A', 'p2_name': 'N/A', 'player1_score': 0.0, 'player2_score': 0.0, 'year': 'N/A', 'week_start': 'N/A', 'game_type': 'N/A'}
        default_season_stat_record = {'value': 0.0, 'player_name': 'N/A', 'year': 'N/A'}
        default_season_win_loss_record = {'wins': 0, 'losses': 0, 'ties': 0, 'player_name': 'N/A', 'year': 'N/A', 'regular_season_record': '0-0-0'}

        def get_safe_record(query, params, default_structure, value_key, is_min_val=False):
            rec_dict = fetch_record(query, params) 
            if rec_dict and rec_dict.get(value_key) is not None:
                for key in ['score', 'margin', 'combined_score', 'value', 'player1_score', 'player2_score']:
                    if key in rec_dict and rec_dict[key] is not None:
                        try: rec_dict[key] = float(rec_dict[key])
                        except (ValueError, TypeError): rec_dict[key] = float('inf') if is_min_val and key == value_key else 0.0
                return rec_dict
            else:
                safe_default = default_structure.copy()
                if is_min_val: safe_default[value_key] = float('inf')
                else: 
                    if value_key in safe_default: safe_default[value_key] = 0.0
                return safe_default

        records['high_score_reg'] = get_safe_record(
            """SELECT MAX(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'regular' AND wm.player1_score IS NOT NULL UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'regular' AND wm.player2_score IS NOT NULL) ORDER BY score DESC LIMIT 1""",
            (), default_single_game_score_record, 'score'
        )
        records['high_score_playoff'] = get_safe_record(
            """SELECT MAX(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type != 'regular' AND wm.player1_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type != 'regular' AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '')) ORDER BY score DESC LIMIT 1""",
            (), default_single_game_score_record, 'score'
        )
        records['low_score'] = get_safe_record(
            """SELECT MIN(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '')) ORDER BY score ASC LIMIT 1""",
            (), default_single_game_score_record, 'score', is_min_val=True
        )
        records['largest_mov'] = get_safe_record(
            """SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin DESC LIMIT 1""",
            (), default_single_game_mov_record, 'margin'
        )
        records['smallest_mov'] = get_safe_record(
            """SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) > 0 AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin ASC LIMIT 1""",
            (), default_single_game_mov_record, 'margin', is_min_val=True
        )
        records['closest_playoff_game'] = get_safe_record(
             """SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.game_type != 'regular' AND ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) > 0 AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin ASC LIMIT 1""",
            (), default_single_game_mov_record, 'margin', is_min_val=True
        )
        records['low_combined_score'] = get_safe_record(
            """SELECT (CAST(wm.player1_score AS REAL) + CAST(wm.player2_score AS REAL)) as combined_score, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY combined_score ASC LIMIT 1""",
            (), default_single_game_combined_record, 'combined_score', is_min_val=True
        )
        records['largest_playoff_mov'] = get_safe_record(
            """SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.game_type != 'regular' AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin DESC LIMIT 1""",
            (), default_single_game_mov_record, 'margin'
        )

        records['high_pf_season'] = get_safe_record("""SELECT sr.points_for as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_for IS NOT NULL ORDER BY sr.points_for DESC LIMIT 1""", (), default_season_stat_record, 'value')
        records['lowest_pf_season'] = get_safe_record("""SELECT sr.points_for as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_for IS NOT NULL ORDER BY sr.points_for ASC LIMIT 1""", (), default_season_stat_record, 'value', is_min_val=True)
        records['most_pa_season'] = get_safe_record("""SELECT sr.points_against as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_against IS NOT NULL ORDER BY sr.points_against DESC LIMIT 1""", (), default_season_stat_record, 'value')
        records['high_ppg_season'] = get_safe_record("""SELECT sr.points_per_game as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_per_game IS NOT NULL ORDER BY sr.points_per_game DESC LIMIT 1""", (), default_season_stat_record, 'value')
        records['lowest_ppg_season'] = get_safe_record("""SELECT sr.points_per_game as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_per_game IS NOT NULL ORDER BY sr.points_per_game ASC LIMIT 1""", (), default_season_stat_record, 'value', is_min_val=True)

        best_rec_q = fetch_record("""SELECT sr.wins, sr.losses, sr.ties, p.name as player_name, s.year, sr.regular_season_record FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.wins IS NOT NULL AND sr.losses IS NOT NULL ORDER BY sr.wins DESC, sr.losses ASC, sr.ties ASC LIMIT 1""")
        records['best_season_rec'] = best_rec_q if best_rec_q else default_season_win_loss_record.copy()

        worst_rec_q = fetch_record("""SELECT sr.wins, sr.losses, sr.ties, p.name as player_name, s.year, sr.regular_season_record FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.wins IS NOT NULL AND sr.losses IS NOT NULL ORDER BY sr.losses DESC, sr.wins ASC, sr.ties DESC LIMIT 1""")
        records['worst_season_rec'] = worst_rec_q if worst_rec_q else default_season_win_loss_record.copy()

        def get_leaders_cleaned(all_counts_raw, is_float_count=False):
            if not all_counts_raw: return [] 
            processed_items = []
            for item_dict in all_counts_raw: 
                raw_count = item_dict.get('count')
                if raw_count is None: item_dict['count'] = 0.0 if is_float_count else 0
                else:
                    try: item_dict['count'] = float(raw_count) if is_float_count else int(raw_count)
                    except (ValueError, TypeError): item_dict['count'] = 0.0 if is_float_count else 0
                processed_items.append(item_dict)
            if not processed_items: return []
            max_count_val = 0
            if processed_items: max_count_val = max(item['count'] for item in processed_items)
            leaders = [item for item in processed_items if item['count'] == max_count_val]
            if not leaders: return []
            if max_count_val == 0 and not is_float_count and not leaders[0].get('player_name'): return []
            return leaders

        career_pf_counts = fetch_all_records("""SELECT SUM(sr.points_for) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.points_for IS NOT NULL GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_career_pf'] = get_leaders_cleaned(career_pf_counts, is_float_count=True)
        career_ppg_counts = fetch_all_records("""SELECT AVG(sr.points_per_game) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.points_per_game IS NOT NULL GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['highest_career_ppg'] = get_leaders_cleaned(career_ppg_counts, is_float_count=True)
        championship_counts = fetch_all_records("""SELECT COUNT(c.winner_id) as count, p.name as player_name, p.player_id FROM championships c JOIN players p ON c.winner_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_championships'] = get_leaders_cleaned(championship_counts)
        playoff_counts = fetch_all_records("""SELECT COUNT(sr.player_id) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.made_playoffs = 1 GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_playoffs'] = get_leaders_cleaned(playoff_counts)
        champ_app_counts = fetch_all_records("""SELECT COUNT(appearances.player_id) as count, p.name as player_name, p.player_id FROM (SELECT c.winner_id as player_id FROM championships c UNION ALL SELECT c.runner_up_id as player_id FROM championships c) appearances JOIN players p ON appearances.player_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_champ_appearances'] = get_leaders_cleaned(champ_app_counts)
        tb_win_counts = fetch_all_records("""SELECT COUNT(wins.winner_id) as count, p.name as player_name, p.player_id FROM (SELECT wm.player1_id as winner_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score > wm.player2_score UNION ALL SELECT wm.player2_id as winner_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score > wm.player1_score) wins JOIN players p ON wins.winner_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_toilet_wins'] = get_leaders_cleaned(tb_win_counts)
        tb_loss_counts = fetch_all_records("""SELECT COUNT(losses.loser_id) as count, p.name as player_name, p.player_id FROM (SELECT wm.player2_id as loser_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score > wm.player2_score UNION ALL SELECT wm.player1_id as loser_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score > wm.player1_score) losses JOIN players p ON losses.loser_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC""")
        records['most_toilet_losses'] = get_leaders_cleaned(tb_loss_counts)
        tb_app_counts_query = """
            SELECT COUNT(appearances.player_id) as count, p.name as player_name, p.player_id
            FROM (
                SELECT wm.player1_id as player_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_id IS NOT NULL
                UNION ALL
                SELECT wm.player2_id as player_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player2_id IS NOT NULL
            ) appearances
            JOIN players p ON appearances.player_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC
        """
        tb_app_counts = fetch_all_records(tb_app_counts_query)
        records['most_toilet_appearances'] = get_leaders_cleaned(tb_app_counts)

        longest_win_streak = {'player_name': 'N/A', 'streak': 0, 'details': ''}
        longest_loss_streak = {'player_name': 'N/A', 'streak': 0, 'details': ''}
        all_matchups_for_streak = fetch_all_records("""
            SELECT s.year, wm.week_start, wm.player1_id, wm.player2_id, wm.player1_score, wm.player2_score
            FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id
            WHERE wm.game_type = 'regular' AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '')
            ORDER BY s.year ASC, wm.week_start ASC
        """)
        all_players_list = fetch_all_records("SELECT player_id, name FROM players")
        player_names_map = {p['player_id']: p['name'] for p in all_players_list}
        player_streaks = defaultdict(lambda: defaultdict(lambda: {'max_win_for_season': 0, 'max_win_details': '', 'max_loss_for_season': 0, 'max_loss_details': ''}))
        matchups_by_player_year = defaultdict(lambda: defaultdict(list))
        for matchup_dict in all_matchups_for_streak: 
            if matchup_dict.get('player1_id') is not None: matchups_by_player_year[matchup_dict['player1_id']][matchup_dict['year']].append(matchup_dict)
            if matchup_dict.get('player2_id') is not None: matchups_by_player_year[matchup_dict['player2_id']][matchup_dict['year']].append(matchup_dict)
        for pid, yearly_matchups in matchups_by_player_year.items():
            for year_val, season_matchups_list in yearly_matchups.items():
                sorted_season_matchups = sorted(season_matchups_list, key=lambda m: m['week_start'])
                current_win_streak, current_loss_streak = 0, 0
                max_win_s, max_loss_s = 0, 0
                win_details, loss_details = "", ""
                current_streak_start_week = 0
                for m_data in sorted_season_matchups:
                    outcome = 'tie'
                    p1_score, p2_score = m_data.get('player1_score'), m_data.get('player2_score')
                    if p1_score is not None and p2_score is not None:
                        try:
                            num_p1_score, num_p2_score = float(p1_score), float(p2_score)
                            if m_data['player1_id'] == pid:
                                if num_p1_score > num_p2_score: outcome = 'win'
                                elif num_p2_score > num_p1_score: outcome = 'loss'
                            elif m_data['player2_id'] == pid:
                                if num_p2_score > num_p1_score: outcome = 'win'
                                elif num_p1_score > num_p2_score: outcome = 'loss'
                        except (ValueError, TypeError): outcome = 'tie'
                    week_val = m_data['week_start']
                    if outcome == 'win':
                        current_win_streak += 1; current_loss_streak = 0
                        if current_win_streak == 1: current_streak_start_week = week_val
                        if current_win_streak > max_win_s: max_win_s = current_win_streak; win_details = f"{year_val} Wk {current_streak_start_week}-{week_val}" if current_win_streak > 1 else f"{year_val} Wk {current_streak_start_week}"
                    elif outcome == 'loss':
                        current_loss_streak += 1; current_win_streak = 0
                        if current_loss_streak == 1: current_streak_start_week = week_val
                        if current_loss_streak > max_loss_s: max_loss_s = current_loss_streak; loss_details = f"{year_val} Wk {current_streak_start_week}-{week_val}" if current_loss_streak > 1 else f"{year_val} Wk {current_streak_start_week}"
                    else: current_win_streak, current_loss_streak = 0,0
                streaks_for_year = player_streaks[pid][year_val]
                streaks_for_year['max_win_for_season'] = max_win_s; streaks_for_year['max_win_details'] = win_details
                streaks_for_year['max_loss_for_season'] = max_loss_s; streaks_for_year['max_loss_details'] = loss_details
        max_overall_win_streak_val, max_overall_loss_streak_val = 0, 0
        for pid_key, year_data_map in player_streaks.items():
            player_name = player_names_map.get(pid_key, f"Player ID {pid_key}")
            for year_val, data in year_data_map.items():
                if data['max_win_for_season'] > max_overall_win_streak_val: max_overall_win_streak_val = data['max_win_for_season']; longest_win_streak = {'player_name': player_name, 'streak': data['max_win_for_season'], 'details': data['max_win_details']}
                if data['max_loss_for_season'] > max_overall_loss_streak_val: max_overall_loss_streak_val = data['max_loss_for_season']; longest_loss_streak = {'player_name': player_name, 'streak': data['max_loss_for_season'], 'details': data['max_loss_details']}
        records['longest_win_streak'] = longest_win_streak
        records['longest_loss_streak'] = longest_loss_streak
        return render_template('record_book.html', records=records)
    except sqlite3.Error as e: print(f"Database error on Record Book page: {e}"); return f"An error occurred fetching record data: {e}", 500
    except Exception as e: print(f"Error on Record Book page: {e}"); import traceback; traceback.print_exc(); return f"An unexpected error occurred: {e}", 500

@app.route('/standings')
def standings():
    try:
        player_stats_list = fetch_all_records("""
            SELECT p.player_id, p.name, 
                   SUM(CASE WHEN sr.wins IS NULL THEN 0 ELSE sr.wins END) as total_wins, 
                   SUM(CASE WHEN sr.losses IS NULL THEN 0 ELSE sr.losses END) as total_losses, 
                   SUM(CASE WHEN sr.ties IS NULL THEN 0 ELSE sr.ties END) as total_ties, 
                   SUM(CASE WHEN sr.points_for IS NULL THEN 0.0 ELSE sr.points_for END) as total_pf, 
                   SUM(CASE WHEN sr.points_against IS NULL THEN 0.0 ELSE sr.points_against END) as total_pa
            FROM players p 
            LEFT JOIN season_results sr ON p.player_id = sr.player_id 
            GROUP BY p.player_id, p.name
        """)
        standings_data = []
        for stats_dict in player_stats_list: 
            wins = stats_dict.get('total_wins', 0)
            losses = stats_dict.get('total_losses', 0)
            ties = stats_dict.get('total_ties', 0)
            total_games = wins + losses + ties
            stats_dict['win_percentage'] = (wins / total_games * 100) if total_games > 0 else 0.0
            stats_dict['total_pf'] = stats_dict.get('total_pf', 0.0)
            standings_data.append(stats_dict)
        standings_data.sort(key=lambda x: (x['win_percentage'], x['total_pf']), reverse=True)
        return render_template('standings.html', standings_data=standings_data)
    except sqlite3.Error as e: print(f"Database error on Standings page: {e}"); return f"An error occurred fetching standings data: {e}", 500
    except Exception as e: print(f"Error on Standings page: {e}"); import traceback; traceback.print_exc(); return "An unexpected error occurred.", 500

@app.route('/seasons/<int:year>/week/<int:week_num>')
def weekly_results(year, week_num):
    try:
        season = fetch_record("SELECT season_id FROM seasons WHERE year = ?", (year,))
        if season is None: abort(404, description=f"Season {year} not found.")
        season_id = season['season_id']
        
        matchups = fetch_all_records("""
            SELECT wm.matchup_id, wm.week_start, wm.week_end, wm.weeks_included, p1.player_id as p1_id, p1.name as p1_name,
                   p2.player_id as p2_id, p2.name as p2_name, wm.player1_score, wm.player2_score, wm.game_type, wm.notes
            FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id
            WHERE wm.season_id = ? AND wm.week_start = ? ORDER BY wm.matchup_id ASC
        """, (season_id, week_num))
        
        if not matchups: abort(404, description=f"No matchups found for Week {week_num} in the {year} season.")
        return render_template('weekly_results.html', year=year, week_num=week_num, matchups=matchups)
    except sqlite3.Error as e: print(f"Database error on Weekly Results page for {year} Week {week_num}: {e}"); return f"An error occurred fetching data for {year} Week {week_num}.", 500
    except Exception as e: print(f"Error on Weekly Results page for {year} Week {week_num}: {e}"); return "An unexpected error occurred.", 500

@app.errorhandler(404)
def page_not_found(e):
    error_desc = getattr(e, 'description', 'The requested URL was not found on the server.')
    return render_template('404.html', error_description=error_desc), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

import sqlite3
import datetime
from flask import Flask, render_template, g, abort, request # Removed send_from_directory as we are not using a custom static route
from collections import defaultdict
import os

# Configuration
# Define the application root for robust path construction
APP_ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(APP_ROOT_DIR, 'REAL_Fantasy_Football_DB.db')

# Rely on Flask's default static folder ('static') and URL path ('/static')
# Flask will look for a 'static' folder in the same directory as this app.py file.
app = Flask(__name__)

# --- Database Helper Functions ---
def get_db():
    if not hasattr(g, 'sqlite_db'):
        db_path_to_check = DATABASE # Use the absolute path defined above
        
        print(f"Attempting to connect to DB. Path: {db_path_to_check}")
        if not os.path.exists(db_path_to_check):
            print(f"!!! CRITICAL: DATABASE FILE NOT FOUND AT: {db_path_to_check} !!!")
            # If the DB file isn't found, any connection attempt will fail.
            # This is a primary thing to check in Vercel logs.
            # For now, we'll let the connect attempt fail naturally to see the SQLite error.
        
        db_uri = f'file:{db_path_to_check}?mode=ro' # Read-only mode for Vercel
        try:
            print(f"Connecting with URI: {db_uri}")
            g.sqlite_db = sqlite3.connect(db_uri, uri=True)
            g.sqlite_db.row_factory = sqlite3.Row
            print(f"Successfully connected to DB in read-only mode: {db_path_to_check}")
        except sqlite3.OperationalError as e:
            print(f"!!! SQLITE ERROR CONNECTING (read-only attempt with URI): {e} for DB at {db_path_to_check}")
            # Fallback for local development or if read-only URI mode fails for other reasons
            try:
                print(f"Attempting fallback read-write connection to: {db_path_to_check}")
                g.sqlite_db = sqlite3.connect(db_path_to_check)
                g.sqlite_db.row_factory = sqlite3.Row
                print(f"Successfully connected to DB in read-write mode (fallback): {db_path_to_check}")
            except sqlite3.OperationalError as e_fallback:
                print(f"!!! SQLITE FALLBACK CONNECTION ERROR: {e_fallback} for DB at {db_path_to_check}")
                # If both attempts fail, this is a critical issue.
                # Consider how your app should behave. For now, re-raise.
                raise
    return g.sqlite_db

@app.teardown_appcontext
def close_db(error):
    if hasattr(g, 'sqlite_db'):
        g.sqlite_db.close()

@app.context_processor
def inject_current_year():
    return {'current_year': datetime.datetime.now().year, 'float': float}

def fetch_record(query, params=()):
    db = get_db()
    cursor = db.execute(query, params)
    row = cursor.fetchone()
    return dict(row) if row else None

def fetch_all_records(query, params=()):
    db = get_db()
    cursor = db.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]


@app.route('/')
def index():
    try:
        # db = get_db() # get_db() will be called by fetch_all_records/fetch_record
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
 
        all_toilet_losers_history = fetch_all_records("""
            SELECT
                s.year,
                CASE
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score < wm.player2_score THEN p1.player_id
                    WHEN wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score < wm.player1_score THEN p2.player_id
                    ELSE NULL 
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
              AND wm.player1_score != wm.player2_score 
            ORDER BY s.year DESC
        """)
        all_toilet_losers_history = [loser for loser in all_toilet_losers_history if loser.get('loser_id') is not None]

        return render_template('index.html', 
                               players=players, 
                               latest_champion=latest_champion_data,
                               all_champions=all_champions_history,
                               all_toilet_losers=all_toilet_losers_history)
    except sqlite3.OperationalError as e: 
        print(f"DATABASE OPERATIONAL ERROR in index route: {e}")
        # In a production environment, you might want to render a specific error template
        # return render_template('database_error.html', error=str(e)), 500
        return "A database error occurred. Please check the logs.", 500 # Simplified error for now
    except Exception as e:
        print(f"Error on index page: {e}")
        import traceback
        traceback.print_exc() # This will print the full traceback to Vercel logs
        return "An unexpected error occurred. Please check the logs.", 500


@app.route('/seasons')
def seasons_list():
    try:
        all_seasons = fetch_all_records("SELECT year FROM seasons ORDER BY year DESC")
        return render_template('seasons.html', seasons=all_seasons)
    except Exception as e:
        print(f"Error on seasons list page: {e}")
        import traceback; traceback.print_exc()
        return "An unexpected error occurred.", 500

@app.route('/seasons/<int:year>')
def season_detail(year):
    try:
        season = fetch_record("SELECT season_id, regular_season_end_week FROM seasons WHERE year = ?", (year,))
        if season is None: abort(404, description=f"Season {year} not found.")
        season_id = season['season_id']
        reg_season_end = season.get('regular_season_end_week') # Use .get for safety
        results = fetch_all_records("SELECT sr.rank, p.player_id, p.name, sr.regular_season_record, sr.wins, sr.losses, sr.ties, sr.points_for, sr.points_against, sr.made_playoffs FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.season_id = ? ORDER BY sr.rank ASC", (season_id,))
        championship_info = fetch_record("SELECT wp.player_id as winner_id, wp.name as winner_name, rp.player_id as runner_up_id, rp.name as runner_up_name FROM championships ch JOIN players wp ON ch.winner_id = wp.player_id JOIN players rp ON ch.runner_up_id = rp.player_id WHERE ch.season_id = ?", (season_id,))
        toilet_bowl_winner_id, toilet_bowl_loser_id = None, None
        tb_match = fetch_record("SELECT player1_id, player2_id, player1_score, player2_score FROM weekly_matchups WHERE season_id = ? AND game_type = 'toilet_bowl' LIMIT 1", (season_id,))
        if tb_match and tb_match.get('player1_score') is not None and tb_match.get('player2_score') is not None:
            if tb_match['player1_score'] > tb_match['player2_score']: toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player1_id'], tb_match['player2_id']
            elif tb_match['player2_score'] > tb_match['player1_score']: toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player2_id'], tb_match['player1_id']
        weeks_data = fetch_all_records("SELECT DISTINCT week_start FROM weekly_matchups WHERE season_id = ? ORDER BY week_start ASC", (season_id,))
        weeks_list = [{'week_start': w['week_start'], 'is_playoff': reg_season_end is not None and w.get('week_start') > reg_season_end} for w in weeks_data] if weeks_data else []
        return render_template('season_detail.html', year=year, results=results, championship=championship_info, toilet_bowl_winner_id=toilet_bowl_winner_id, toilet_bowl_loser_id=toilet_bowl_loser_id, weeks=weeks_list)
    except Exception as e: 
        print(f"Error on season detail page for {year}: {e}")
        import traceback; traceback.print_exc()
        return "An unexpected error occurred.", 500

@app.route('/players/<int:player_id>')
def player_detail(player_id):
    try:
        player = fetch_record("SELECT name FROM players WHERE player_id = ?", (player_id,))
        if player is None: abort(404, description=f"Player ID {player_id} not found.")
        player_name = player['name']
        history = fetch_all_records("SELECT s.year, sr.rank, sr.regular_season_record, sr.wins, sr.losses, sr.ties, sr.points_for, sr.points_against, sr.made_playoffs FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? ORDER BY s.year DESC", (player_id,))
        total_wins, total_losses, total_ties, total_pf, total_pa, total_rank, playoff_appearances = 0,0,0,0.0,0.0,0,0
        seasons_played = len(history)
        for s_dict in history: # s_dict is already a dict
            total_wins += s_dict.get('wins',0) or 0
            total_losses += s_dict.get('losses',0) or 0
            total_ties += s_dict.get('ties',0) or 0
            total_pf += s_dict.get('points_for',0.0) or 0.0
            total_pa += s_dict.get('points_against',0.0) or 0.0
            total_rank += s_dict.get('rank',0) or 0
            if s_dict.get('made_playoffs') == 1: playoff_appearances +=1
        total_games = total_wins + total_losses + total_ties
        win_percentage = (total_wins / total_games * 100) if total_games > 0 else 0.0
        avg_rank = (total_rank / seasons_played) if seasons_played > 0 else 0.0
        avg_pf_per_season = (total_pf / seasons_played) if seasons_played > 0 else 0.0
        avg_pa_per_season = (total_pa / seasons_played) if seasons_played > 0 else 0.0
        championship_wins = fetch_all_records("SELECT s.year FROM championships c JOIN seasons s ON c.season_id = s.season_id WHERE c.winner_id = ? ORDER BY s.year DESC", (player_id,))
        runner_up_finishes = fetch_all_records("SELECT s.year FROM championships c JOIN seasons s ON c.season_id = s.season_id WHERE c.runner_up_id = ? ORDER BY s.year DESC", (player_id,))
        third_place_finishes = fetch_all_records("SELECT s.year FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = '3rd_place' AND ((wm.player1_id = ? AND wm.player1_score > wm.player2_score) OR (wm.player2_id = ? AND wm.player2_score > wm.player1_score)) ORDER BY s.year DESC", (player_id, player_id))
        toilet_bowl_history = {}; toilet_bowl_wins, toilet_bowl_losses = 0,0
        tb_matchups = fetch_all_records("SELECT s.year, wm.player1_id, wm.player2_id, wm.player1_score, wm.player2_score FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'toilet_bowl' AND (wm.player1_id = ? OR wm.player2_id = ?)", (player_id, player_id))
        for tb_match in tb_matchups:
            y, p1s, p2s = tb_match['year'], tb_match['player1_score'], tb_match['player2_score']
            if p1s is not None and p2s is not None:
                if tb_match['player1_id'] == player_id:
                    if p1s > p2s: toilet_bowl_history[y] = 'win'; toilet_bowl_wins +=1
                    elif p2s > p1s: toilet_bowl_history[y] = 'loss'; toilet_bowl_losses +=1
                elif tb_match['player2_id'] == player_id:
                    if p2s > p1s: toilet_bowl_history[y] = 'win'; toilet_bowl_wins +=1
                    elif p1s > p2s: toilet_bowl_history[y] = 'loss'; toilet_bowl_losses +=1
        player_records = {}
        player_records['best_rank'] = fetch_record("SELECT MIN(rank) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.rank IS NOT NULL", (player_id,))
        player_records['worst_rank'] = fetch_record("SELECT MAX(rank) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.rank IS NOT NULL", (player_id,))
        player_records['highest_pf'] = fetch_record("SELECT MAX(points_for) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_for IS NOT NULL", (player_id,))
        player_records['highest_ppg'] = fetch_record("SELECT MAX(points_per_game) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_per_game IS NOT NULL", (player_id,))
        player_records['lowest_pf'] = fetch_record("SELECT MIN(points_for) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_for IS NOT NULL", (player_id,))
        player_records['lowest_ppg'] = fetch_record("SELECT MIN(points_per_game) as value, s.year FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? AND sr.points_per_game IS NOT NULL", (player_id,))
        career_stats = {'seasons_played': seasons_played, 'total_wins': total_wins, 'total_losses': total_losses, 'total_ties': total_ties, 'win_percentage': win_percentage, 'total_pf': total_pf, 'total_pa': total_pa, 'avg_rank': avg_rank, 'avg_pf_per_season': avg_pf_per_season, 'avg_pa_per_season': avg_pa_per_season, 'playoff_appearances': playoff_appearances}
        return render_template('player_detail.html', player_id=player_id, player_name=player_name, history=history, championship_wins=championship_wins, runner_up_finishes=runner_up_finishes, third_place_finishes=third_place_finishes, career_stats=career_stats, toilet_bowl_wins=toilet_bowl_wins, toilet_bowl_losses=toilet_bowl_losses, toilet_bowl_history=toilet_bowl_history, player_records=player_records)
    except Exception as e: 
        print(f"Error on player detail page for ID {player_id}: {e}")
        import traceback; traceback.print_exc()
        return "An unexpected error occurred.", 500

@app.route('/head-to-head', methods=['GET'])
def head_to_head():
    players = fetch_all_records("SELECT player_id, name FROM players ORDER BY name")
    p1_id_str, p2_id_str = request.args.get('player1_id'), request.args.get('player2_id')
    matchups_data, h2h_stats, p1_data, p2_data, error_message, rivalry_stats = [], None, None, None, None, None
    if p1_id_str and p2_id_str:
        try:
            p1_id, p2_id = int(p1_id_str), int(p2_id_str)
            if p1_id == p2_id: error_message = "Please select two different players."
            else:
                p1_data = fetch_record("SELECT player_id, name FROM players WHERE player_id = ?", (p1_id,))
                p2_data = fetch_record("SELECT player_id, name FROM players WHERE player_id = ?", (p2_id,))
                if not p1_data or not p2_data: error_message = "One or both selected players not found."
                else:
                    matchups_data = fetch_all_records("SELECT wm.matchup_id, s.year, wm.week_start, wm.week_end, wm.weeks_included, p1.name as p1_name, p2.name as p2_name, wm.player1_id, wm.player2_id, wm.player1_score, wm.player2_score, wm.game_type FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id WHERE (wm.player1_id = ? AND wm.player2_id = ?) OR (wm.player1_id = ? AND wm.player2_id = ?) ORDER BY s.year DESC, wm.week_start DESC", (p1_id, p2_id, p2_id, p1_id))
                    p1w,p2w,t,p1s_tot,p2s_tot=0,0,0,0.0,0.0
                    p1max,p1max_d,p2max,p2max_d = 0.0,'',0.0,''
                    p1min,p1min_d,p2min,p2min_d = float('inf'),'',float('inf'),''
                    p1mov,p1mov_d,p2mov,p2mov_d = 0.0,'',0.0,''
                    max_c,max_c_d,min_c,min_c_d = 0.0,'',float('inf'),''
                    for m in matchups_data:
                        p1s_v,p2s_v = m['player1_score'],m['player2_score']
                        p1s,p2s = (p1s_v,p2s_v) if m['player1_id'] == p1_id else (p2s_v,p1s_v)
                        y,w,gd = m['year'],m['week_start'],f"(Week {m['week_start']}, {m['year']})"
                        if p1s is None or p2s is None: continue
                        try: p1sf,p2sf = float(p1s),float(p2s)
                        except: continue
                        p1s_tot+=p1sf; p2s_tot+=p2sf
                        if p1sf > p1max: p1max,p1max_d=p1sf,gd
                        if p2sf > p2max: p2max,p2max_d=p2sf,gd
                        if p1sf < p1min: p1min,p1min_d=p1sf,gd
                        if p2sf < p2min: p2min,p2min_d=p2sf,gd
                        c=p1sf+p2sf
                        if c > max_c: max_c,max_c_d=c,gd
                        if c < min_c: min_c,min_c_d=c,gd
                        margin=abs(p1sf-p2sf)
                        if p1sf > p2sf: p1w+=1;_ = (margin,gd) if margin > p1mov else (p1mov,p1mov_d); p1mov,p1mov_d = _
                        elif p2sf > p1sf: p2w+=1;_ = (margin,gd) if margin > p2mov else (p2mov,p2mov_d); p2mov,p2mov_d = _
                        else: t+=1
                    p1min = None if p1min==float('inf') else p1min
                    p2min = None if p2min==float('inf') else p2min
                    min_c = None if min_c==float('inf') else min_c
                    h2h_stats = {'p1_wins':p1w,'p2_wins':p2w,'ties':t,'p1_total_score':p1s_tot,'p2_total_score':p2s_tot,'total_matchups':len(matchups_data)}
                    rivalry_stats = {'p1_max_score':p1max,'p1_max_score_details':p1max_d,'p2_max_score':p2max,'p2_max_score_details':p2max_d,'p1_min_score':p1min,'p1_min_score_details':p1min_d,'p2_min_score':p2min,'p2_min_score_details':p2min_d,'p1_max_mov':p1mov,'p1_max_mov_details':p1mov_d,'p2_max_mov':p2mov,'p2_max_mov_details':p2mov_d,'max_combined':max_c,'max_combined_details':max_c_d,'min_combined':min_c,'min_combined_details':min_c_d}
        except ValueError: error_message = "Invalid player ID."
        except Exception as e: 
            print(f"H2H Error: {e}")
            import traceback; traceback.print_exc()
            error_message="Error fetching data."
    return render_template('head_to_head.html', players=players,selected_p1_id=int(p1_id_str) if p1_id_str else None,selected_p2_id=int(p2_id_str) if p2_id_str else None,player1=p1_data,player2=p2_data,matchups=matchups_data,h2h_stats=h2h_stats,rivalry_stats=rivalry_stats,error_message=error_message)

@app.route('/record-book')
def record_book():
    try:
        records = {}
        default_sgs_rec = {'score':0.0,'player_name':'N/A','opponent_name':'N/A','week':'N/A','year':'N/A','game_type':'N/A'}
        default_sgm_rec = {'margin':0.0,'p1_name':'N/A','p2_name':'N/A','player1_score':0.0,'player2_score':0.0,'year':'N/A','week_start':'N/A','game_type':'N/A'}
        default_sgc_rec = {'combined_score':0.0,'p1_name':'N/A','p2_name':'N/A','player1_score':0.0,'player2_score':0.0,'year':'N/A','week_start':'N/A','game_type':'N/A'}
        default_ss_rec = {'value':0.0,'player_name':'N/A','year':'N/A'}
        default_swl_rec = {'wins':0,'losses':0,'ties':0,'player_name':'N/A','year':'N/A','regular_season_record':'0-0-0'}
        
        def get_safe_rec(q,p,d,vk,is_min=False):
            r_dict=fetch_record(q,p)
            if r_dict and r_dict.get(vk) is not None:
                for k_val in ['score','margin','combined_score','value','player1_score','player2_score']:
                    if k_val in r_dict and r_dict[k_val] is not None:
                        try: r_dict[k_val]=float(r_dict[k_val])
                        except (ValueError, TypeError): r_dict[k_val]=float('inf') if is_min and k_val==vk else 0.0
                return r_dict
            else:
                sd_copy=d.copy()
                if is_min: sd_copy[vk]=float('inf')
                elif vk in sd_copy: sd_copy[vk]=0.0
                return sd_copy

        records['high_score_reg'] = get_safe_rec("SELECT MAX(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'regular' AND wm.player1_score IS NOT NULL UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'regular' AND wm.player2_score IS NOT NULL) ORDER BY score DESC LIMIT 1", (), default_sgs_rec, 'score')
        records['high_score_playoff'] = get_safe_rec("SELECT MAX(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type != 'regular' AND wm.player1_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type != 'regular' AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '')) ORDER BY score DESC LIMIT 1", (), default_sgs_rec, 'score')
        records['low_score'] = get_safe_rec("SELECT MIN(score) as score, player_name, opponent_name, week, year, game_type FROM (SELECT wm.player1_score as score, p1.name as player_name, p2.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') UNION ALL SELECT wm.player2_score as score, p2.name as player_name, p1.name as opponent_name, wm.week_start as week, s.year, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '')) ORDER BY score ASC LIMIT 1", (), default_sgs_rec, 'score', True)
        records['largest_mov'] = get_safe_rec("SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin DESC LIMIT 1", (), default_sgm_rec, 'margin')
        records['smallest_mov'] = get_safe_rec("SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) > 0 AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin ASC LIMIT 1", (), default_sgm_rec, 'margin', True)
        records['closest_playoff_game'] = get_safe_rec("SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.game_type != 'regular' AND ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) > 0 AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin ASC LIMIT 1", (), default_sgm_rec, 'margin', True)
        records['low_combined_score'] = get_safe_rec("SELECT (CAST(wm.player1_score AS REAL) + CAST(wm.player2_score AS REAL)) as combined_score, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY combined_score ASC LIMIT 1", (), default_sgc_rec, 'combined_score', True)
        records['largest_playoff_mov'] = get_safe_rec("SELECT ABS(CAST(wm.player1_score AS REAL) - CAST(wm.player2_score AS REAL)) as margin, p1.name as p1_name, p2.name as p2_name, wm.player1_score, wm.player2_score, s.year, wm.week_start, wm.game_type FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id JOIN seasons s ON wm.season_id = s.season_id WHERE wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.game_type != 'regular' AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY margin DESC LIMIT 1", (), default_sgm_rec, 'margin')
        records['high_pf_season'] = get_safe_rec("SELECT sr.points_for as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_for IS NOT NULL ORDER BY sr.points_for DESC LIMIT 1", (), default_ss_rec, 'value')
        records['lowest_pf_season'] = get_safe_rec("SELECT sr.points_for as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_for IS NOT NULL ORDER BY sr.points_for ASC LIMIT 1", (), default_ss_rec, 'value', True)
        records['most_pa_season'] = get_safe_rec("SELECT sr.points_against as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_against IS NOT NULL ORDER BY sr.points_against DESC LIMIT 1", (), default_ss_rec, 'value')
        records['high_ppg_season'] = get_safe_rec("SELECT sr.points_per_game as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_per_game IS NOT NULL ORDER BY sr.points_per_game DESC LIMIT 1", (), default_ss_rec, 'value')
        records['lowest_ppg_season'] = get_safe_rec("SELECT sr.points_per_game as value, p.name as player_name, s.year FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.points_per_game IS NOT NULL ORDER BY sr.points_per_game ASC LIMIT 1", (), default_ss_rec, 'value', True)
        brq=fetch_record("SELECT sr.wins, sr.losses, sr.ties, p.name as player_name, s.year, sr.regular_season_record FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.wins IS NOT NULL AND sr.losses IS NOT NULL ORDER BY sr.wins DESC, sr.losses ASC, sr.ties ASC LIMIT 1"); records['best_season_rec']=brq if brq else default_swl_rec.copy()
        wrq=fetch_record("SELECT sr.wins, sr.losses, sr.ties, p.name as player_name, s.year, sr.regular_season_record FROM season_results sr JOIN players p ON sr.player_id = p.player_id JOIN seasons s ON sr.season_id = s.season_id WHERE sr.wins IS NOT NULL AND sr.losses IS NOT NULL ORDER BY sr.losses DESC, sr.wins ASC, sr.ties DESC LIMIT 1"); records['worst_season_rec']=wrq if wrq else default_swl_rec.copy()
        
        def get_lead_clean(acr, is_float=False): # acr is already list of dicts
            if not acr: return []
            pi=[]
            for item_d in acr: # item_d is already a dict
                rc=item_d.get('count')
                if rc is None: item_d['count']=0.0 if is_float else 0
                else:
                    try: item_d['count']=float(rc) if is_float else int(rc)
                    except (ValueError, TypeError): item_d['count']=0.0 if is_float else 0
                pi.append(item_d)
            if not pi: return []
            max_count_val=0
            if pi: max_count_val=max(i['count'] for i in pi)
            l=[i for i in pi if i['count']==max_count_val]
            if not l: return []
            if max_count_val==0 and not is_float and not l[0].get('player_name'): return []
            return l

        records['most_career_pf'] = get_lead_clean(fetch_all_records("SELECT SUM(sr.points_for) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.points_for IS NOT NULL GROUP BY p.player_id, p.name ORDER BY count DESC"),True)
        records['highest_career_ppg'] = get_lead_clean(fetch_all_records("SELECT AVG(sr.points_per_game) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.points_per_game IS NOT NULL GROUP BY p.player_id, p.name ORDER BY count DESC"),True)
        records['most_championships'] = get_lead_clean(fetch_all_records("SELECT COUNT(c.winner_id) as count, p.name as player_name, p.player_id FROM championships c JOIN players p ON c.winner_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC"))
        records['most_playoffs'] = get_lead_clean(fetch_all_records("SELECT COUNT(sr.player_id) as count, p.name as player_name, p.player_id FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.made_playoffs = 1 GROUP BY p.player_id, p.name ORDER BY count DESC"))
        records['most_champ_appearances'] = get_lead_clean(fetch_all_records("SELECT COUNT(appearances.player_id) as count, p.name as player_name, p.player_id FROM (SELECT c.winner_id as player_id FROM championships c UNION ALL SELECT c.runner_up_id as player_id FROM championships c) appearances JOIN players p ON appearances.player_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC"))
        records['most_toilet_wins'] = get_lead_clean(fetch_all_records("SELECT COUNT(wins.winner_id) as count, p.name as player_name, p.player_id FROM (SELECT wm.player1_id as winner_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score > wm.player2_score UNION ALL SELECT wm.player2_id as winner_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score > wm.player1_score) wins JOIN players p ON wins.winner_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC"))
        records['most_toilet_losses'] = get_lead_clean(fetch_all_records("SELECT COUNT(losses.loser_id) as count, p.name as player_name, p.player_id FROM (SELECT wm.player2_id as loser_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player1_score > wm.player2_score UNION ALL SELECT wm.player1_id as loser_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_score IS NOT NULL AND wm.player2_score IS NOT NULL AND wm.player2_score > wm.player1_score) losses JOIN players p ON losses.loser_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC"))
        records['most_toilet_appearances'] = get_lead_clean(fetch_all_records("SELECT COUNT(appearances.player_id) as count, p.name as player_name, p.player_id FROM (SELECT wm.player1_id as player_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player1_id IS NOT NULL UNION ALL SELECT wm.player2_id as player_id FROM weekly_matchups wm WHERE wm.game_type = 'toilet_bowl' AND wm.player2_id IS NOT NULL) appearances JOIN players p ON appearances.player_id = p.player_id GROUP BY p.player_id, p.name ORDER BY count DESC"))
        
        lws,lls={'player_name':'N/A','streak':0,'details':''},{'player_name':'N/A','streak':0,'details':''}
        amfs=fetch_all_records("SELECT s.year, wm.week_start, wm.player1_id, wm.player2_id, wm.player1_score, wm.player2_score FROM weekly_matchups wm JOIN seasons s ON wm.season_id = s.season_id WHERE wm.game_type = 'regular' AND wm.week_end IS NULL AND (wm.weeks_included IS NULL OR wm.weeks_included = '') ORDER BY s.year ASC, wm.week_start ASC")
        aplnm={p_dict['player_id']:p_dict['name'] for p_dict in fetch_all_records("SELECT player_id, name FROM players")} # p_dict is already a dict
        ps=defaultdict(lambda:defaultdict(lambda:{'max_win_for_season':0,'max_win_details':'','max_loss_for_season':0,'max_loss_details':''}))
        mbpy=defaultdict(lambda:defaultdict(list))
        for md_dict in amfs: # md_dict is already a dict
            if md_dict.get('player1_id') is not None: mbpy[md_dict['player1_id']][md_dict['year']].append(md_dict)
            if md_dict.get('player2_id') is not None: mbpy[md_dict['player2_id']][md_dict['year']].append(md_dict)
        
        for pid_val,ym_dict in mbpy.items():
            for yv_val,sml_list in ym_dict.items():
                ssm_list=sorted(sml_list,key=lambda m_item:m_item['week_start'])
                cws_val,cls_val,mws_val,mls_val,wd_val,ld_val,cssw_val=0,0,0,0,"","",0
                for m_data_dict in ssm_list: # m_data_dict is already a dict
                    o_val='tie';p1s_val,p2s_val=m_data_dict.get('player1_score'),m_data_dict.get('player2_score')
                    if p1s_val is not None and p2s_val is not None:
                        try:
                            n_p1s_val,n_p2s_val=float(p1s_val),float(p2s_val)
                            if m_data_dict['player1_id']==pid_val: o_val='win' if n_p1s_val > n_p2s_val else ('loss' if n_p2s_val > n_p1s_val else 'tie')
                            elif m_data_dict['player2_id']==pid_val: o_val='win' if n_p2s_val > n_p1s_val else ('loss' if n_p1s_val > n_p2s_val else 'tie')
                        except (ValueError, TypeError): o_val='tie'
                    wv_val=m_data_dict['week_start']
                    if o_val=='win': cws_val+=1;cls_val=0;cssw_val=wv_val if cws_val==1 else cssw_val; mws_val,wd_val=(cws_val,f"{yv_val} Wk {cssw_val}-{wv_val}" if cws_val>1 else f"{yv_val} Wk {cssw_val}") if cws_val>mws_val else (mws_val,wd_val)
                    elif o_val=='loss': cls_val+=1;cws_val=0;cssw_val=wv_val if cls_val==1 else cssw_val; mls_val,ld_val=(cls_val,f"{yv_val} Wk {cssw_val}-{wv_val}" if cls_val>1 else f"{yv_val} Wk {cssw_val}") if cls_val>mls_val else (mls_val,ld_val)
                    else: cws_val,cls_val=0,0
                sfy_dict=ps[pid_val][yv_val];sfy_dict['max_win_for_season']=mws_val;sfy_dict['max_win_details']=wd_val;sfy_dict['max_loss_for_season']=mls_val;sfy_dict['max_loss_details']=ld_val
        
        mowsv_val,molsv_val=0,0
        for pidk_val,ydm_dict in ps.items():
            pn_val=aplnm.get(pidk_val,f"Player ID {pidk_val}")
            for yv_val,data_dict in ydm_dict.items():
                if data_dict['max_win_for_season']>mowsv_val: mowsv_val=data_dict['max_win_for_season'];lws={'player_name':pn_val,'streak':data_dict['max_win_for_season'],'details':data_dict['max_win_details']}
                if data_dict['max_loss_for_season']>molsv_val: molsv_val=data_dict['max_loss_for_season'];lls={'player_name':pn_val,'streak':data_dict['max_loss_for_season'],'details':data_dict['max_loss_details']}
        records['longest_win_streak']=lws;records['longest_loss_streak']=lls
        return render_template('record_book.html', records=records)
    except Exception as e: 
        print(f"Record Book Error: {e}")
        import traceback; traceback.print_exc()
        return "Error fetching records.",500

@app.route('/standings')
def standings():
    try:
        psl_list = fetch_all_records("SELECT p.player_id, p.name, SUM(CASE WHEN sr.wins IS NULL THEN 0 ELSE sr.wins END) as total_wins, SUM(CASE WHEN sr.losses IS NULL THEN 0 ELSE sr.losses END) as total_losses, SUM(CASE WHEN sr.ties IS NULL THEN 0 ELSE sr.ties END) as total_ties, SUM(CASE WHEN sr.points_for IS NULL THEN 0.0 ELSE sr.points_for END) as total_pf, SUM(CASE WHEN sr.points_against IS NULL THEN 0.0 ELSE sr.points_against END) as total_pa FROM players p LEFT JOIN season_results sr ON p.player_id = sr.player_id GROUP BY p.player_id, p.name")
        sd_list=[]
        for s_dict_item in psl_list:
            w_val,l_val,t_val=s_dict_item.get('total_wins',0),s_dict_item.get('total_losses',0),s_dict_item.get('total_ties',0)
            tg_val=w_val+l_val+t_val;s_dict_item['win_percentage']=(w_val/tg_val*100) if tg_val>0 else 0.0;s_dict_item['total_pf']=s_dict_item.get('total_pf',0.0)
            sd_list.append(s_dict_item)
        sd_list.sort(key=lambda x_item:(x_item['win_percentage'],x_item['total_pf']),reverse=True)
        return render_template('standings.html',standings_data=sd_list)
    except Exception as e: 
        print(f"Standings Error: {e}")
        import traceback; traceback.print_exc()
        return "Error fetching standings.",500

@app.route('/seasons/<int:year>/week/<int:week_num>')
def weekly_results(year, week_num):
    try:
        s_data = fetch_record("SELECT season_id FROM seasons WHERE year = ?", (year,))
        if s_data is None: abort(404, description=f"Season {year} not found for week {week_num}") # Added more desc
        sid_val = s_data['season_id']
        m_data = fetch_all_records("SELECT wm.matchup_id, wm.week_start, wm.week_end, wm.weeks_included, p1.player_id as p1_id, p1.name as p1_name, p2.player_id as p2_id, p2.name as p2_name, wm.player1_score, wm.player2_score, wm.game_type, wm.notes FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id WHERE wm.season_id = ? AND wm.week_start = ? ORDER BY wm.matchup_id ASC", (sid_val, week_num))
        if not m_data: abort(404, description=f"No matchups for {year} Week {week_num}") # Added more desc
        return render_template('weekly_results.html', year=year, week_num=week_num, matchups=m_data)
    except Exception as e: 
        print(f"Weekly Results Error for {year} Wk {week_num}: {e}")
        import traceback; traceback.print_exc()
        return "Error fetching weekly results.",500


@app.errorhandler(404)
def page_not_found(e):
    error_desc = getattr(e, 'description', 'The requested URL was not found on the server.')
    # Ensure we handle the case where e might not have description
    if not isinstance(error_desc, str): # Basic check
        error_desc = "The requested resource was not found."
    print(f"404 Error: {error_desc} for URL {request.path}") # Log the 404
    return render_template('404.html', error_description=error_desc), 404

if __name__ == '__main__':
    # This part is for local development only.
    # Vercel uses the 'app' instance imported via wsgi.py.
    print("Running Flask app locally...")
    app.run(host='0.0.0.0', port=5000, debug=True)


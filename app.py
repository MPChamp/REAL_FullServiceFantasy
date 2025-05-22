import sqlite3
import datetime
from flask import Flask, render_template, g, abort, request, send_from_directory # Added send_from_directory just in case, but we aim not to use a custom route
from collections import defaultdict
import os # Make sure os is imported

# Configuration
# Define the application root and static folder path explicitly
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(APP_ROOT, 'REAL_Fantasy_Football_DB.db') # Also make DB path absolute
STATIC_FOLDER = os.path.join(APP_ROOT, 'static')


app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='/static')

# --- Database Helper Functions ---
def get_db():
    if not hasattr(g, 'sqlite_db'):
        # Try connecting with read-only mode for Vercel's filesystem
        db_uri = f'file:{DATABASE}?mode=ro'
        try:
            g.sqlite_db = sqlite3.connect(db_uri, uri=True)
            g.sqlite_db.row_factory = sqlite3.Row
        except sqlite3.OperationalError as e:
            print(f"!!! SQLITE ERROR CONNECTING (read-only attempt): {e} for DB at {DATABASE}")
            # Fallback for local development if read-only fails (e.g., if DB needs to be created)
            # or if the file truly doesn't exist at the path.
            # For Vercel, if this fails, the file is likely not there or path is wrong.
            try:
                g.sqlite_db = sqlite3.connect(DATABASE)
                g.sqlite_db.row_factory = sqlite3.Row
                print(f"Connected to DB in read-write mode (fallback): {DATABASE}")
            except sqlite3.OperationalError as e_fallback:
                print(f"!!! SQLITE FALLBACK ERROR: {e_fallback} for DB at {DATABASE}")
                raise # Re-raise the error if fallback also fails
    return g.sqlite_db

# (The rest of your app.py remains the same: context_processor, fetch_record, fetch_all_records, all your routes, etc.)
# ... (ensure all previous routes are included here) ...

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
        all_toilet_losers_history = [loser for loser in all_toilet_losers_history if loser['loser_id'] is not None]

        return render_template('index.html', 
                               players=players, 
                               latest_champion=latest_champion_data,
                               all_champions=all_champions_history,
                               all_toilet_losers=all_toilet_losers_history)
    except sqlite3.OperationalError as e: # Catch specific DB errors
        print(f"DATABASE OPERATIONAL ERROR in index route: {e}")
        return "A database error occurred. Please try again later.", 500
    except Exception as e:
        print(f"Error on index page: {e}")
        import traceback
        traceback.print_exc()
        return "An unexpected error occurred.", 500


# --- Add all your other routes here (seasons_list, season_detail, player_detail, etc.) ---
# --- Make sure they also use the updated get_db() if they interact with the database ---

@app.route('/seasons')
def seasons_list():
    try:
        all_seasons = fetch_all_records("SELECT year FROM seasons ORDER BY year DESC")
        return render_template('seasons.html', seasons=all_seasons)
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
        results = fetch_all_records("SELECT sr.rank, p.player_id, p.name, sr.regular_season_record, sr.wins, sr.losses, sr.ties, sr.points_for, sr.points_against, sr.made_playoffs FROM season_results sr JOIN players p ON sr.player_id = p.player_id WHERE sr.season_id = ? ORDER BY sr.rank ASC", (season_id,))
        championship_info = fetch_record("SELECT wp.player_id as winner_id, wp.name as winner_name, rp.player_id as runner_up_id, rp.name as runner_up_name FROM championships ch JOIN players wp ON ch.winner_id = wp.player_id JOIN players rp ON ch.runner_up_id = rp.player_id WHERE ch.season_id = ?", (season_id,))
        toilet_bowl_winner_id, toilet_bowl_loser_id = None, None
        tb_match = fetch_record("SELECT player1_id, player2_id, player1_score, player2_score FROM weekly_matchups WHERE season_id = ? AND game_type = 'toilet_bowl' LIMIT 1", (season_id,))
        if tb_match and tb_match.get('player1_score') is not None and tb_match.get('player2_score') is not None:
            if tb_match['player1_score'] > tb_match['player2_score']: toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player1_id'], tb_match['player2_id']
            elif tb_match['player2_score'] > tb_match['player1_score']: toilet_bowl_winner_id, toilet_bowl_loser_id = tb_match['player2_id'], tb_match['player1_id']
        weeks_data = fetch_all_records("SELECT DISTINCT week_start FROM weekly_matchups WHERE season_id = ? ORDER BY week_start ASC", (season_id,))
        weeks_list = [{'week_start': w['week_start'], 'is_playoff': reg_season_end is not None and w['week_start'] > reg_season_end} for w in weeks_data] if weeks_data else []
        return render_template('season_detail.html', year=year, results=results, championship=championship_info, toilet_bowl_winner_id=toilet_bowl_winner_id, toilet_bowl_loser_id=toilet_bowl_loser_id, weeks=weeks_list)
    except Exception as e: print(f"Error on season detail page for {year}: {e}"); return "An unexpected error occurred.", 500

@app.route('/players/<int:player_id>')
def player_detail(player_id):
    try:
        player = fetch_record("SELECT name FROM players WHERE player_id = ?", (player_id,))
        if player is None: abort(404, description=f"Player ID {player_id} not found.")
        player_name = player['name']
        history = fetch_all_records("SELECT s.year, sr.rank, sr.regular_season_record, sr.wins, sr.losses, sr.ties, sr.points_for, sr.points_against, sr.made_playoffs FROM season_results sr JOIN seasons s ON sr.season_id = s.season_id WHERE sr.player_id = ? ORDER BY s.year DESC", (player_id,))
        total_wins, total_losses, total_ties, total_pf, total_pa, total_rank, playoff_appearances = 0,0,0,0.0,0.0,0,0
        seasons_played = len(history)
        for s in history:
            total_wins += s.get('wins',0) or 0; total_losses += s.get('losses',0) or 0; total_ties += s.get('ties',0) or 0
            total_pf += s.get('points_for',0.0) or 0.0; total_pa += s.get('points_against',0.0) or 0.0
            total_rank += s.get('rank',0) or 0
            if s.get('made_playoffs') == 1: playoff_appearances +=1
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
    except Exception as e: print(f"Error on player detail page for ID {player_id}: {e}"); return "An unexpected error occurred.", 500

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
        except Exception as e: print(f"H2H Error: {e}"); error_message="Error fetching data."
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
            r=fetch_record(q,p)
            if r and r.get(vk) is not None:
                for k in ['score','margin','combined_score','value','player1_score','player2_score']:
                    if k in r and r[k] is not None:
                        try: r[k]=float(r[k])
                        except: r[k]=float('inf') if is_min and k==vk else 0.0
                return r
            else:
                sd=d.copy()
                if is_min: sd[vk]=float('inf')
                elif vk in sd: sd[vk]=0.0
                return sd
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
        def get_lead_clean(acr, is_float=False):
            if not acr: return []
            pi=[]
            for item_d in acr:
                rc=item_d.get('count')
                if rc is None: item_d['count']=0.0 if is_float else 0
                else:
                    try: item_d['count']=float(rc) if is_float else int(rc)
                    except: item_d['count']=0.0 if is_float else 0
                pi.append(item_d)
            if not pi: return []
            mcv=0
            if pi: mcv=max(i['count'] for i in pi)
            l=[i for i in pi if i['count']==mcv]
            if not l: return []
            if mcv==0 and not is_float and not l[0].get('player_name'): return []
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
        aplnm={p['player_id']:p['name'] for p in fetch_all_records("SELECT player_id, name FROM players")}
        ps=defaultdict(lambda:defaultdict(lambda:{'max_win_for_season':0,'max_win_details':'','max_loss_for_season':0,'max_loss_details':''}))
        mbpy=defaultdict(lambda:defaultdict(list))
        for md in amfs:
            if md.get('player1_id') is not None: mbpy[md['player1_id']][md['year']].append(md)
            if md.get('player2_id') is not None: mbpy[md['player2_id']][md['year']].append(md)
        for pid,ym in mbpy.items():
            for yv,sml in ym.items():
                ssm=sorted(sml,key=lambda m:m['week_start'])
                cws,cls,mws,mls,wd,ld,cssw=0,0,0,0,"","",0
                for m_d in ssm:
                    o='tie';p1s,p2s=m_d.get('player1_score'),m_d.get('player2_score')
                    if p1s is not None and p2s is not None:
                        try:
                            n_p1s,n_p2s=float(p1s),float(p2s)
                            if m_d['player1_id']==pid: o='win' if n_p1s > n_p2s else ('loss' if n_p2s > n_p1s else 'tie')
                            elif m_d['player2_id']==pid: o='win' if n_p2s > n_p1s else ('loss' if n_p1s > n_p2s else 'tie')
                        except: o='tie'
                    wv=m_d['week_start']
                    if o=='win': cws+=1;cls=0;cssw=wv if cws==1 else cssw; mws,wd=(cws,f"{yv} Wk {cssw}-{wv}" if cws>1 else f"{yv} Wk {cssw}") if cws>mws else (mws,wd)
                    elif o=='loss': cls+=1;cws=0;cssw=wv if cls==1 else cssw; mls,ld=(cls,f"{yv} Wk {cssw}-{wv}" if cls>1 else f"{yv} Wk {cssw}") if cls>mls else (mls,ld)
                    else: cws,cls=0,0
                sfy=ps[pid][yv];sfy['max_win_for_season']=mws;sfy['max_win_details']=wd;sfy['max_loss_for_season']=mls;sfy['max_loss_details']=ld
        mowsv,molsv=0,0
        for pidk,ydm in ps.items():
            pn=aplnm.get(pidk,f"Player ID {pidk}")
            for yv,d in ydm.items():
                if d['max_win_for_season']>mowsv: mowsv=d['max_win_for_season'];lws={'player_name':pn,'streak':d['max_win_for_season'],'details':d['max_win_details']}
                if d['max_loss_for_season']>molsv: molsv=d['max_loss_for_season'];lls={'player_name':pn,'streak':d['max_loss_for_season'],'details':d['max_loss_details']}
        records['longest_win_streak']=lws;records['longest_loss_streak']=lls
        return render_template('record_book.html', records=records)
    except Exception as e: print(f"Record Book Error: {e}"); import traceback; traceback.print_exc(); return "Error fetching records.",500

@app.route('/standings')
def standings():
    try:
        psl = fetch_all_records("SELECT p.player_id, p.name, SUM(CASE WHEN sr.wins IS NULL THEN 0 ELSE sr.wins END) as total_wins, SUM(CASE WHEN sr.losses IS NULL THEN 0 ELSE sr.losses END) as total_losses, SUM(CASE WHEN sr.ties IS NULL THEN 0 ELSE sr.ties END) as total_ties, SUM(CASE WHEN sr.points_for IS NULL THEN 0.0 ELSE sr.points_for END) as total_pf, SUM(CASE WHEN sr.points_against IS NULL THEN 0.0 ELSE sr.points_against END) as total_pa FROM players p LEFT JOIN season_results sr ON p.player_id = sr.player_id GROUP BY p.player_id, p.name")
        sd=[]
        for s_d in psl:
            w,l,t=s_d.get('total_wins',0),s_d.get('total_losses',0),s_d.get('total_ties',0)
            tg=w+l+t;s_d['win_percentage']=(w/tg*100) if tg>0 else 0.0;s_d['total_pf']=s_d.get('total_pf',0.0)
            sd.append(s_d)
        sd.sort(key=lambda x:(x['win_percentage'],x['total_pf']),reverse=True)
        return render_template('standings.html',standings_data=sd)
    except Exception as e: print(f"Standings Error: {e}"); return "Error fetching standings.",500

@app.route('/seasons/<int:year>/week/<int:week_num>')
def weekly_results(year, week_num):
    try:
        s = fetch_record("SELECT season_id FROM seasons WHERE year = ?", (year,))
        if s is None: abort(404)
        sid = s['season_id']
        m = fetch_all_records("SELECT wm.matchup_id, wm.week_start, wm.week_end, wm.weeks_included, p1.player_id as p1_id, p1.name as p1_name, p2.player_id as p2_id, p2.name as p2_name, wm.player1_score, wm.player2_score, wm.game_type, wm.notes FROM weekly_matchups wm JOIN players p1 ON wm.player1_id = p1.player_id JOIN players p2 ON wm.player2_id = p2.player_id WHERE wm.season_id = ? AND wm.week_start = ? ORDER BY wm.matchup_id ASC", (sid, week_num))
        if not m: abort(404)
        return render_template('weekly_results.html', year=year, week_num=week_num, matchups=m)
    except Exception as e: print(f"Weekly Results Error for {year} Wk {week_num}: {e}"); return "Error fetching weekly results.",500

@app.errorhandler(404)
def page_not_found(e):
    error_desc = getattr(e, 'description', 'The requested URL was not found on the server.')
    return render_template('404.html', error_description=error_desc), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)


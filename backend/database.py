import sqlite3, os
DB_PATH = os.path.join("database", "app.db")
os.makedirs("database", exist_ok=True)

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS analyses(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT, movesAnalyzed INT, avgCPL INT, accuracy REAL,
        inaccuracies INT, mistakes INT, blunders INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    cur.execute("""CREATE TABLE IF NOT EXISTS analysis_moves(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        analysis_id INT, ply INT, played TEXT, best TEXT, cpl INT, tag TEXT
    )""")
    conn.commit(); conn.close()

init_db()

from fastapi import APIRouter, Query
from services.analysis_service import analyze_pgn_file

router = APIRouter(prefix="/analysis", tags=["Analysis"])

@router.get("/analyze_game")
def analyze_game(pgn_filename: str = Query(default=None, description="Optional: filename in data/uploads")):
    result = analyze_pgn_file(pgn_filename)
    return result

@router.post("/analyze_and_store")
def analyze_and_store(pgn_filename: str | None = None):
    from services.analysis_service import analyze_pgn_file, save_analysis
    result = analyze_pgn_file(pgn_filename)
    if "error" in result: return result
    saved = save_analysis(result)
    return saved

@router.get("/analyses")
def list_analyses():
    from database import get_conn
    conn = get_conn(); cur = conn.cursor()
    rows = cur.execute("SELECT * FROM analyses ORDER BY id DESC LIMIT 20").fetchall()
    conn.close()
    return [dict(r) for r in rows]

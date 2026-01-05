import os
import json
from fastapi import APIRouter, HTTPException, Request
from services.profiling import StockfishEvaluator, build_profile_from_pgn, save_profile

router = APIRouter()

UPLOADS_DIR = os.path.join("data", "uploads")
PROFILES_DIR = os.path.join("data", "profiles")


@router.get("/profile/{username}")
def get_or_build_profile(username: str, request: Request):
    profile_path = os.path.join(PROFILES_DIR, f"{username}.json")
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)

    # Try to build from existing uploads
    # Prefer chess.com file name convention you already use
    pgn_path = os.path.join(UPLOADS_DIR, f"{username}_chesscom.pgn")
    if not os.path.exists(pgn_path):
        # also allow manual upload naming
        alt = os.path.join(UPLOADS_DIR, f"{username}.pgn")
        if os.path.exists(alt):
            pgn_path = alt
        else:
            raise HTTPException(status_code=404, detail="No PGN found for this user. Fetch/upload games first.")

    engine = getattr(request.app.state, 'stockfish_engine', None)
    if engine is None:
        error = getattr(request.app.state, 'stockfish_error', None)
        detail = 'Stockfish engine not initialized'
        if error:
            detail = f'Stockfish engine failed to start: {error}'
        raise HTTPException(status_code=500, detail=detail)

    evaluator = StockfishEvaluator(engine)
    lock = getattr(request.app.state, 'stockfish_lock', None)
    if lock:
        with lock:
            profile = build_profile_from_pgn(username=username, pgn_path=pgn_path, evaluator=evaluator)
    else:
        profile = build_profile_from_pgn(username=username, pgn_path=pgn_path, evaluator=evaluator)
    out_path = save_profile(profile, PROFILES_DIR)

    with open(out_path, "r", encoding="utf-8") as f:
        return json.load(f)

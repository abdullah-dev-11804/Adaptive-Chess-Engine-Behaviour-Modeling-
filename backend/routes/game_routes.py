from fastapi import APIRouter, UploadFile, File, HTTPException, Query
import os
from datetime import datetime
import chess.pgn

router = APIRouter(prefix="/games", tags=["Games"])

UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _resolve_pgn_path(username: str) -> str:
    clean = (username or "").strip()
    if not clean:
        raise HTTPException(status_code=400, detail="Username required")
    primary = os.path.join(UPLOAD_DIR, f"{clean}_chesscom.pgn")
    if os.path.exists(primary):
        return primary
    alt = os.path.join(UPLOAD_DIR, f"{clean}.pgn")
    if os.path.exists(alt):
        return alt
    raise HTTPException(status_code=404, detail="No PGN found for this user")


@router.post("/upload")
async def upload_pgn(file: UploadFile = File(...)):
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    return {"status": "success", "message": f"File {file.filename} uploaded successfully"}


@router.get("/pgn/{username}/games")
def list_pgn_games(username: str, limit: int = Query(default=20, ge=1, le=200)):
    path = _resolve_pgn_path(username)
    games = []
    with open(path, "r", encoding="utf-8", errors="ignore") as pgn:
        index = 0
        while True:
            game = chess.pgn.read_game(pgn)
            if game is None:
                break
            headers = game.headers
            games.append({
                "index": index,
                "white": headers.get("White"),
                "black": headers.get("Black"),
                "event": headers.get("Event"),
                "date": headers.get("Date"),
                "result": headers.get("Result"),
                "eco": headers.get("ECO"),
                "opening": headers.get("Opening"),
            })
            index += 1
            if index >= limit:
                break

    return {
        "username": username,
        "count": len(games),
        "games": games,
    }


@router.get("/pgn/{username}/moves")
def get_pgn_game_moves(username: str, index: int = Query(..., ge=0)):
    path = _resolve_pgn_path(username)
    with open(path, "r", encoding="utf-8", errors="ignore") as pgn:
        current = 0
        game = None
        while True:
            game = chess.pgn.read_game(pgn)
            if game is None:
                break
            if current == index:
                break
            current += 1

    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    moves = [move.uci() for move in game.mainline_moves()]
    headers = game.headers
    user = (username or "").strip().lower()
    white = (headers.get("White") or "").strip().lower()
    black = (headers.get("Black") or "").strip().lower()
    user_color = None
    if white == user:
        user_color = "white"
    elif black == user:
        user_color = "black"

    return {
        "index": index,
        "moves": moves,
        "user_color": user_color,
        "headers": {
            "white": headers.get("White"),
            "black": headers.get("Black"),
            "event": headers.get("Event"),
            "date": headers.get("Date"),
            "result": headers.get("Result"),
            "eco": headers.get("ECO"),
            "opening": headers.get("Opening"),
        },
    }

from fastapi import APIRouter, HTTPException
import requests
from requests.exceptions import RequestException
import os

router = APIRouter(prefix="/games/fetch", tags=["Game Fetch"])

DATA_DIR = "data/uploads"

@router.post("/chesscom")
def fetch_chesscom_games(payload: dict):
    raw_username = payload.get("username", "")
    username = raw_username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username required")

    os.makedirs(DATA_DIR, exist_ok=True)

    # Step 1: get archives
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    headers = {
        "User-Agent": "adaptive-chess-engine/1.0",
        "Accept": "application/json",
    }

    try:
        r = requests.get(archives_url, headers=headers, timeout=10)
    except RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Chess.com request failed: {exc.__class__.__name__}",
        )

    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="User not found")
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Chess.com error: {r.status_code}",
        )

    archives = r.json().get("archives", [])

    games_imported = 0
    pgn_path = os.path.join(DATA_DIR, f"{username}_chesscom.pgn")

    with open(pgn_path, "w", encoding="utf-8") as pgn_file:
        for archive_url in archives[-6:]:  # last 6 months only (safe & fast)
            try:
                month_data = requests.get(
                    archive_url, headers=headers, timeout=10
                ).json()
            except RequestException:
                continue
            for game in month_data.get("games", []):
                if "pgn" in game:
                    pgn_file.write(game["pgn"] + "\n\n")
                    games_imported += 1

    return {
        "platform": "chess.com",
        "username": username,
        "gamesImported": games_imported,
        "file": pgn_path
    }

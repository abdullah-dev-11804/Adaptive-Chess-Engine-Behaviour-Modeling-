import os, glob, chess.pgn, io, chess
from .engine_service import analyse_fen_cp, best_move_san
from database import get_conn

UPLOAD_DIR = "data/uploads"

def _latest_pgn():
    files = sorted(glob.glob(os.path.join(UPLOAD_DIR, "*.pgn")), key=os.path.getmtime)
    return files[-1] if files else None

def analyze_pgn_file(pgn_filename: str | None):
    path = os.path.join(UPLOAD_DIR, pgn_filename) if pgn_filename else _latest_pgn()
    if not path or not os.path.exists(path):
        return {"error": "No PGN found. Upload or specify pgn_filename."}

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        game = chess.pgn.read_game(f)
    if game is None:
        return {"error": "PGN parse failed"}

    board = game.board()
    moves = list(game.mainline_moves())
    move_summaries = []
    total_cpl = 0
    blunders = mistakes = inaccuracies = 0

    for ply_idx, move in enumerate(moves, start=1):
        fen_before = board.fen()
        # eval best line vs played move
        best_san = best_move_san(fen_before, movetime_ms=200) or ""
        cp_before = analyse_fen_cp(fen_before, depth=8)  # quick depth for UI

        try:
            played_san = board.san(move)
        except Exception:
            played_san = ""
        board.push(move)
        fen_after = board.fen()
        cp_after = analyse_fen_cp(fen_after, depth=8)

        cpl = (cp_before - cp_after) if board.turn else (cp_after - cp_before)  # relative loss approx
        cpl = abs(cpl)
        total_cpl += max(0, cpl)

        # classify
        tag = "good"
        if cpl >= 500:
            tag = "blunder"; blunders += 1
        elif cpl >= 350:
            tag = "mistake"; mistakes += 1
        elif cpl >= 200:
            tag = "inaccuracy"; inaccuracies += 1

        move_summaries.append({
            "ply": ply_idx,
            "played": played_san,
            "best": best_san,
            "cpl": int(cpl),
            "tag": tag
        })

    avg_cpl = int(total_cpl / max(1, len(moves)))
    # Rough “accuracy” proxy (lower CPL → higher accuracy). Calibrate later.
    accuracy = max(0, min(100, 100 - avg_cpl/10))

    return {
        "file": os.path.basename(path),
        "movesAnalyzed": len(moves),
        "avgCPL": avg_cpl,
        "accuracy": round(accuracy, 1),
        "inaccuracies": inaccuracies,
        "mistakes": mistakes,
        "blunders": blunders,
        "moves": move_summaries
    }

def save_analysis(summary: dict):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("""INSERT INTO analyses(filename, movesAnalyzed, avgCPL, accuracy, inaccuracies, mistakes, blunders)
                   VALUES(?,?,?,?,?,?,?)""",
                (summary["file"], summary["movesAnalyzed"], summary["avgCPL"], summary["accuracy"],
                 summary["inaccuracies"], summary["mistakes"], summary["blunders"]))
    analysis_id = cur.lastrowid
    for m in summary["moves"]:
        cur.execute("""INSERT INTO analysis_moves(analysis_id, ply, played, best, cpl, tag)
                       VALUES(?,?,?,?,?,?)""",
                    (analysis_id, m["ply"], m["played"], m["best"], m["cpl"], m["tag"]))
    conn.commit(); conn.close()
    summary["analysis_id"] = analysis_id
    return summary
import os, chess, chess.engine

ENGINE_PATH = os.getenv("STOCKFISH_PATH") or r"D:\engines\stockfish\stockfish-windows-x86-64-avx2.exe"  # adjust if needed
_engine = None

def get_engine():
    global _engine
    if _engine is None:
        _engine = chess.engine.SimpleEngine.popen_uci(ENGINE_PATH)
        # Optional: make it more human-like
        _engine.configure({"Skill Level": 6, "UCI_LimitStrength": True, "UCI_Elo": 1500})
    return _engine

def best_move_san(fen: str, movetime_ms: int = 300):
    board = chess.Board(fen)
    engine = get_engine()
    # quick response for UI feel
    result = engine.play(board, chess.engine.Limit(time=movetime_ms/1000.0))
    if result.move is None:
        return None
    return board.san(result.move)

def analyse_fen_cp(fen: str, depth: int = 10) -> int:
    """Return centipawn eval from side to move perspective (cp, not mate)."""
    board = chess.Board(fen)
    engine = get_engine()
    info = engine.analyse(board, chess.engine.Limit(depth=depth))
    score = info["score"].pov(board.turn)
    return score.score(mate_score=100000)  # convert Mx to big cp

from __future__ import annotations

import os
from typing import Dict, List, Optional

import chess
import chess.engine

from services.profiling import (
    BLUNDER_CPL,
    INACCURACY_CPL,
    MISTAKE_CPL,
    MAX_CPL_PER_MOVE,
    MATE_SCORE_ABS,
    classify_phase,
)


def _score_cp(engine: chess.engine.SimpleEngine, board: chess.Board, depth: int) -> Optional[int]:
    info = engine.analyse(board, chess.engine.Limit(depth=depth))
    score = info["score"].pov(chess.WHITE)
    cp = score.score(mate_score=100000)
    return int(cp) if cp is not None else None


def _label_for_cpl(cpl: float) -> str:
    if cpl >= BLUNDER_CPL:
        return "blunder"
    if cpl >= MISTAKE_CPL:
        return "mistake"
    if cpl >= INACCURACY_CPL:
        return "inaccuracy"
    return "good"


def _profile_path(username: str) -> str:
    return os.path.join("data", "profiles", f"{username}.json")


def _load_profile(username: str) -> Optional[Dict]:
    path = _profile_path(username)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        import json
        return json.load(f)


def _suggested_good_moves(engine: chess.engine.SimpleEngine, fen: str, depth: int = 10, top_k: int = 5) -> List[str]:
    board = chess.Board(fen)
    infos = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=top_k)
    moves = []
    for info in infos:
        pv = info.get("pv")
        if pv:
            moves.append(pv[0].uci())
    seen = set()
    out = []
    for move in moves:
        if move not in seen:
            seen.add(move)
            out.append(move)
    return out[:top_k]


def analyze_move(
    *,
    engine: chess.engine.SimpleEngine,
    fen: str,
    move_uci: str,
    username: str,
    depth: int = 10,
) -> Dict:
    board_before = chess.Board(fen)
    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        raise ValueError("Invalid UCI move")

    if move not in board_before.legal_moves:
        raise ValueError("Illegal move for this position")

    fullmove_before = board_before.fullmove_number
    before_cp = _score_cp(engine, board_before, depth)
    if before_cp is None:
        raise RuntimeError("Stockfish evaluation failed (before)")

    player_color = board_before.turn
    board_after = board_before.copy()
    board_after.push(move)
    after_cp = _score_cp(engine, board_after, depth)
    if after_cp is None:
        raise RuntimeError("Stockfish evaluation failed (after)")

    # Convert to player's POV (player_color before the move).
    before = before_cp if player_color == chess.WHITE else -before_cp
    after = after_cp if player_color == chess.WHITE else -after_cp

    if abs(before) >= MATE_SCORE_ABS or abs(after) >= MATE_SCORE_ABS:
        cpl = MAX_CPL_PER_MOVE
    else:
        delta = after - before
        raw_cpl = max(0, -delta)
        cpl = min(raw_cpl, MAX_CPL_PER_MOVE)

    label = _label_for_cpl(cpl)

    # Profile weakness check (phase + label against profile).
    ply_index = (fullmove_before - 1) * 2 + (1 if player_color == chess.WHITE else 2)
    phase = classify_phase(board_after, ply_index)
    profile = _load_profile(username)
    matches_profile_weakness = False
    if profile:
        weak_phase = profile.get("weak_phase")
        if weak_phase == phase and label in {"mistake", "blunder"}:
            matches_profile_weakness = True

    suggested_good_moves = _suggested_good_moves(engine, fen, depth=depth, top_k=5)

    feedback = None
    if label in {"mistake", "blunder"}:
        feedback = "This move worsens your position. Focus on safety, development, and solid plans."
        if matches_profile_weakness:
            feedback += f" This matches your usual weakness in the {phase}."

    return {
        "cpl": round(cpl, 2),
        "label": label,
        "phase": phase,
        "matches_profile_weakness": matches_profile_weakness,
        "suggested_good_moves": suggested_good_moves,
        "feedback": feedback,
    }

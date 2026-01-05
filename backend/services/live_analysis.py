from __future__ import annotations

import hashlib
import os
import threading
from typing import Dict, List, Optional

import chess
import chess.engine

from services.feedback import generate_live_explanation
from services.profiling import (
    BLUNDER_CPL,
    INACCURACY_CPL,
    MISTAKE_CPL,
    MAX_CPL_PER_MOVE,
    MATE_SCORE_ABS,
    classify_phase,
)

_DEEP_CACHE: Dict[str, Dict] = {}
_DEEP_CACHE_LOCK = threading.Lock()
_EXPLAIN_CACHE: Dict[str, Dict] = {}
_EXPLAIN_CACHE_LOCK = threading.Lock()


def _cache_key(username: str, fen: str, move_uci: str, depth: int, pv_len: int) -> str:
    raw = f"{username}|{move_uci}|{fen}|{depth}|{pv_len}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _score_from_info(info: Dict) -> Optional[int]:
    score = info["score"].pov(chess.WHITE)
    cp = score.score(mate_score=100000)
    return int(cp) if cp is not None else None


def _score_cp(engine: chess.engine.SimpleEngine, board: chess.Board, depth: int) -> Optional[int]:
    info = engine.analyse(board, chess.engine.Limit(depth=depth))
    return _score_from_info(info)


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


def _suggested_good_moves(
    engine: chess.engine.SimpleEngine,
    fen: str,
    depth: int = 10,
    top_k: int = 5,
) -> List[str]:
    board = chess.Board(fen)
    infos = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=top_k)
    if isinstance(infos, dict):
        infos = [infos]
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


def _pv_to_san(board: chess.Board, pv: List[chess.Move], max_len: int) -> List[str]:
    line = []
    for move in pv[:max_len]:
        line.append(board.san(move))
        board.push(move)
    return line


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

    before = before_cp if player_color == chess.WHITE else -before_cp
    after = after_cp if player_color == chess.WHITE else -after_cp

    if abs(before) >= MATE_SCORE_ABS or abs(after) >= MATE_SCORE_ABS:
        cpl = MAX_CPL_PER_MOVE
    else:
        delta = after - before
        raw_cpl = max(0, -delta)
        cpl = min(raw_cpl, MAX_CPL_PER_MOVE)

    label = _label_for_cpl(cpl)

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


def analyze_move_deep(
    *,
    engine: chess.engine.SimpleEngine,
    fen: str,
    move_uci: str,
    username: str,
    depth: int = 14,
    pv_len: int = 8,
    use_cache: bool = True,
) -> Dict:
    cache_key = _cache_key(username, fen, move_uci, depth, pv_len)
    if use_cache:
        with _DEEP_CACHE_LOCK:
            cached = _DEEP_CACHE.get(cache_key)
        if cached:
            return cached

    board_before = chess.Board(fen)
    try:
        move = chess.Move.from_uci(move_uci)
    except ValueError:
        raise ValueError("Invalid UCI move")

    if move not in board_before.legal_moves:
        raise ValueError("Illegal move for this position")

    player_color = board_before.turn
    fullmove_before = board_before.fullmove_number

    best_info = engine.analyse(board_before, chess.engine.Limit(depth=depth), multipv=1)
    if isinstance(best_info, list):
        best_info = best_info[0] if best_info else {}
    best_pv = best_info.get("pv") or []
    best_eval_white = _score_from_info(best_info) if best_info else None
    if best_eval_white is None:
        raise RuntimeError("Stockfish evaluation failed (best)")

    board_after = board_before.copy()
    board_after.push(move)
    played_info = engine.analyse(board_after, chess.engine.Limit(depth=depth), multipv=1)
    if isinstance(played_info, list):
        played_info = played_info[0] if played_info else {}
    played_pv = played_info.get("pv") or []
    played_eval_white = _score_from_info(played_info) if played_info else None
    if played_eval_white is None:
        raise RuntimeError("Stockfish evaluation failed (played)")

    before = best_eval_white if player_color == chess.WHITE else -best_eval_white
    after = played_eval_white if player_color == chess.WHITE else -played_eval_white

    if abs(before) >= MATE_SCORE_ABS or abs(after) >= MATE_SCORE_ABS:
        cpl = MAX_CPL_PER_MOVE
    else:
        delta = after - before
        raw_cpl = max(0, -delta)
        cpl = min(raw_cpl, MAX_CPL_PER_MOVE)

    label = _label_for_cpl(cpl)

    ply_index = (fullmove_before - 1) * 2 + (1 if player_color == chess.WHITE else 2)
    phase = classify_phase(board_after, ply_index)

    profile = _load_profile(username)
    matches_profile_weakness = False
    if profile:
        weak_phase = profile.get("weak_phase")
        if weak_phase == phase and label in {"mistake", "blunder"}:
            matches_profile_weakness = True

    best_move = best_pv[0].uci() if best_pv else None
    best_line = _pv_to_san(board_before.copy(), best_pv, pv_len)
    played_line_moves = [move] + played_pv
    played_line = _pv_to_san(board_before.copy(), played_line_moves, pv_len)

    eval_best = before
    eval_played = after
    eval_delta = eval_best - eval_played

    result = {
        "cpl": round(cpl, 2),
        "label": label,
        "phase": phase,
        "matches_profile_weakness": matches_profile_weakness,
        "best_move": best_move,
        "best_line": best_line,
        "played_line": played_line,
        "eval_best": int(eval_best),
        "eval_played": int(eval_played),
        "eval_delta": int(eval_delta),
        "depth": depth,
    }

    if use_cache:
        with _DEEP_CACHE_LOCK:
            _DEEP_CACHE[cache_key] = result

    return result


def explain_move(
    *,
    engine: chess.engine.SimpleEngine,
    fen: str,
    move_uci: str,
    username: str,
    depth: int = 14,
    pv_len: int = 8,
) -> Dict:
    cache_key = _cache_key(username, fen, move_uci, depth, pv_len)
    with _EXPLAIN_CACHE_LOCK:
        cached = _EXPLAIN_CACHE.get(cache_key)
    if cached:
        return cached

    analysis = analyze_move_deep(
        engine=engine,
        fen=fen,
        move_uci=move_uci,
        username=username,
        depth=depth,
        pv_len=pv_len,
        use_cache=True,
    )
    profile = _load_profile(username) or {}
    explanation = generate_live_explanation(profile, analysis, fen, move_uci)

    payload = {
        "analysis": analysis,
        "explanation": explanation,
    }

    with _EXPLAIN_CACHE_LOCK:
        _EXPLAIN_CACHE[cache_key] = payload

    return payload

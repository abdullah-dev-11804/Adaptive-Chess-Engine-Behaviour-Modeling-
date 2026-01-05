from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple

import chess
import chess.engine
import chess.pgn


# ---------- Config ----------
DEFAULT_MAX_GAMES = 200          # keep runtime sane for demo
DEFAULT_MAX_PLIES_PER_GAME = 120 # limit long games
EVAL_DEPTH = 12                  # adjust for speed/quality tradeoff

# CPL thresholds (common-ish heuristics)
INACCURACY_CPL = 50
MISTAKE_CPL = 100
BLUNDER_CPL = 200
MAX_CPL_PER_MOVE = 300
IGNORE_POSITION_BELOW = -500
MATE_SCORE_ABS = 10000


@dataclass
class StyleFlags:
    aggressive: bool
    early_queen: bool
    late_castling: bool


@dataclass
class PhaseWeakness:
    opening_avg_cpl: float
    middlegame_avg_cpl: float
    endgame_avg_cpl: float
    weak_phase: str


@dataclass
class PlayerProfile:
    username: str
    games_analyzed: int
    avg_cpl: float
    inaccuracy_rate: float
    mistake_rate: float
    blunder_rate: float
    weak_phase: str
    opening_preferences: List[str]
    style: StyleFlags
    phase_breakdown: PhaseWeakness
    profile_proofs: List[Dict[str, object]]


# ---------- Helpers ----------
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def side_from_username(game: chess.pgn.Game, username: str) -> Optional[chess.Color]:
    w = (game.headers.get("White") or "").strip().lower()
    b = (game.headers.get("Black") or "").strip().lower()
    u = username.strip().lower()
    if w == u:
        return chess.WHITE
    if b == u:
        return chess.BLACK
    return None


def game_opening_name(game: chess.pgn.Game) -> Optional[str]:
    # Prefer "Opening" header; fall back to ECO if present.
    opening = game.headers.get("Opening")
    if opening:
        return opening.strip()
    eco = game.headers.get("ECO")
    if eco:
        return eco.strip()
    return None


def classify_phase(board: chess.Board, ply_index: int) -> str:
    """
    Simple, defensible phase heuristic:
    - Opening: first 16 plies (8 moves) OR until minor pieces developed? keep simple.
    - Endgame: low material (no queens OR total non-pawn material small).
    - Middlegame: otherwise.
    """
    if ply_index <= 16:
        return "opening"

    # Material heuristic
    queens = len(board.pieces(chess.QUEEN, chess.WHITE)) + len(board.pieces(chess.QUEEN, chess.BLACK))
    non_pawn = 0
    for piece in [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN]:
        non_pawn += 3 * (len(board.pieces(piece, chess.WHITE)) + len(board.pieces(piece, chess.BLACK))) if piece in [chess.KNIGHT, chess.BISHOP] else 5 * (len(board.pieces(piece, chess.WHITE)) + len(board.pieces(piece, chess.BLACK))) if piece == chess.ROOK else 9 * (len(board.pieces(piece, chess.WHITE)) + len(board.pieces(piece, chess.BLACK)))

    # Endgame if queens off OR low non-pawn material
    if queens == 0 or non_pawn <= 14:
        return "endgame"

    return "middlegame"


def is_castle_move(move: chess.Move, board: chess.Board) -> bool:
    return board.is_castling(move)


def queen_moved_early(move: chess.Move, board: chess.Board, player_color: chess.Color, ply_index: int) -> bool:
    # "Early queen move" heuristic: queen moved in first 10 plies by that player
    if ply_index > 20:  # 10 full moves = 20 plies
        return False
    piece = board.piece_at(move.from_square)
    return piece is not None and piece.piece_type == chess.QUEEN and piece.color == player_color


# ---------- Stockfish adapter (reuse yours if you already have one) ----------
class StockfishEvaluator:
    """
    Minimal wrapper around python-chess engine API.
    If your project already has a Stockfish service, adapt this to call it instead.
    """
    def __init__(self, engine: chess.engine.SimpleEngine, depth: int = EVAL_DEPTH):
        self.engine = engine
        self.depth = depth

    def eval_cp(self, board: chess.Board) -> Optional[int]:
        """
        Returns evaluation in centipawns from White's perspective.
        If mate is detected, return large cp with sign.
        """
        import chess.engine

        try:
            limit = chess.engine.Limit(depth=self.depth)
            info = self.engine.analyse(board, limit)
            score = info["score"].pov(chess.WHITE)
            if score.is_mate():
                mate = score.mate()
                # Map mate score to big cp (sign preserved)
                return 100000 if mate is not None and mate > 0 else -100000
            cp = score.score(mate_score=100000)
            return int(cp) if cp is not None else None
        except Exception:
            return None


# ---------- Main profiler ----------
def build_profile_from_pgn(
    username: str,
    pgn_path: str,
    evaluator: StockfishEvaluator,
    max_games: int = DEFAULT_MAX_GAMES,
    max_plies_per_game: int = DEFAULT_MAX_PLIES_PER_GAME,
) -> PlayerProfile:
    games = 0

    cpl_sum = 0
    cpl_count = 0

    inacc = 0
    mistake = 0
    blunder = 0
    total_user_moves = 0

    # Phase tracking
    phase_cpl_sum = {"opening": 0, "middlegame": 0, "endgame": 0}
    phase_cpl_cnt = {"opening": 0, "middlegame": 0, "endgame": 0}

    # Style indicators
    early_queen_flag = False
    castled_ply: List[int] = []
    aggressive_moves = 0
    quiet_moves = 0

    opening_counts: Dict[str, int] = {}
    proof_positions: List[Dict[str, object]] = []
    MAX_PROOFS = 10

    with open(pgn_path, "r", encoding="utf-8", errors="ignore") as f:
        while games < max_games:
            game = chess.pgn.read_game(f)
            if game is None:
                break

            player_side = side_from_username(game, username)
            if player_side is None:
                continue

            opening_name = game_opening_name(game)
            if opening_name:
                opening_counts[opening_name] = opening_counts.get(opening_name, 0) + 1

            board = game.board()
            node = game

            # Evaluate initial position once
            prev_eval = evaluator.eval_cp(board)
            if prev_eval is None:
                continue

            ply_index = 0
            user_castled = False

            # Walk moves
            for move in game.mainline_moves():
                ply_index += 1
                if ply_index > max_plies_per_game:
                    break

                # For aggression heuristic: captures/checks are "aggressive"
                is_capture = board.is_capture(move)
                gives_check = board.gives_check(move)

                # User move?
                best_move_uci = None
                fen_before_move = None
                if board.turn == player_side:
                    total_user_moves += 1

                    if queen_moved_early(move, board, player_side, ply_index):
                        early_queen_flag = True

                    if is_castle_move(move, board) and not user_castled:
                        user_castled = True
                        castled_ply.append(ply_index)
                    fen_before_move = board.fen()
                    try:
                        best = evaluator.engine.analyse(
                            board,
                            chess.engine.Limit(depth=evaluator.depth),
                            multipv=1,
                        )
                        pv = best.get("pv")
                        best_move_uci = pv[0].uci() if pv else None
                    except Exception:
                        best_move_uci = None

                # Make the move
                board.push(move)

                curr_eval = evaluator.eval_cp(board)
                if curr_eval is None:
                    prev_eval = curr_eval
                    continue

                # Only compute CPL on user's moves: compare eval before user's move vs after user's move
                # But note: eval is from White perspective. Convert to player's POV.
                if (ply_index % 2 == 1 and player_side == chess.WHITE) or (ply_index % 2 == 0 and player_side == chess.BLACK):
                    # This ply was made by player
                    if prev_eval is not None:
                        # For player's POV, if player is Black, flip sign
                        before = prev_eval if player_side == chess.WHITE else -prev_eval
                        after = curr_eval if player_side == chess.WHITE else -curr_eval

                        # Skip forced mates/extreme evals and already-lost positions
                        if abs(before) >= MATE_SCORE_ABS or abs(after) >= MATE_SCORE_ABS:
                            continue
                        if before < IGNORE_POSITION_BELOW:
                            continue

                        # A drop in eval (after - before) negative means player worsened position
                        delta = after - before
                        raw_cpl = max(0, -delta)  # only count losses
                        cpl = min(raw_cpl, MAX_CPL_PER_MOVE)
                        cpl_sum += cpl
                        cpl_count += 1

                        # Phase bucket based on board AFTER move (reasonable & simple)
                        phase = classify_phase(board, ply_index)
                        phase_cpl_sum[phase] += cpl
                        phase_cpl_cnt[phase] += 1

                        # ---- store proof positions (only significant mistakes) ----
                        if cpl >= 150 and fen_before_move:
                            proof_positions.append({
                                "fen": fen_before_move,
                                "played_move": move.uci(),
                                "best_move": best_move_uci,
                                "cpl": round(cpl, 2),
                                "phase": phase,
                                "label": (
                                    "blunder" if cpl >= 200
                                    else "mistake" if cpl >= 100
                                    else "inaccuracy"
                                ),
                                "opening": opening_name,
                                "move_number": ply_index // 2 + 1,
                            })

                        # Mistake categories
                        if cpl >= BLUNDER_CPL:
                            blunder += 1
                        elif cpl >= MISTAKE_CPL:
                            mistake += 1
                        elif cpl >= INACCURACY_CPL:
                            inacc += 1

                # Aggression heuristic counts only for user's moves
                if (board.turn != player_side):  # after push, turn switched; so if now it's opponent, last move was user's
                    if is_capture or gives_check:
                        aggressive_moves += 1
                    else:
                        quiet_moves += 1

                prev_eval = curr_eval

            games += 1

    proof_positions = sorted(
        proof_positions,
        key=lambda x: x["cpl"],
        reverse=True
    )[:MAX_PROOFS]

    avg_cpl = (cpl_sum / cpl_count) if cpl_count else 0.0

    def rate(x: int) -> float:
        return (x / total_user_moves) if total_user_moves else 0.0

    # Weak phase
    opening_avg = (phase_cpl_sum["opening"] / phase_cpl_cnt["opening"]) if phase_cpl_cnt["opening"] else 0.0
    middle_avg = (phase_cpl_sum["middlegame"] / phase_cpl_cnt["middlegame"]) if phase_cpl_cnt["middlegame"] else 0.0
    end_avg = (phase_cpl_sum["endgame"] / phase_cpl_cnt["endgame"]) if phase_cpl_cnt["endgame"] else 0.0

    phase_map = {"opening": opening_avg, "middlegame": middle_avg, "endgame": end_avg}
    weak_phase = max(phase_map, key=lambda k: phase_map[k]) if games else "middlegame"

    # Opening preferences (top 5)
    top_openings = sorted(opening_counts.items(), key=lambda kv: kv[1], reverse=True)[:5]
    opening_pref_list = [name for name, _cnt in top_openings]

    # Style flags
    total_style_moves = aggressive_moves + quiet_moves
    aggressive_ratio = (aggressive_moves / total_style_moves) if total_style_moves else 0.0
    aggressive_flag = aggressive_ratio >= 0.45  # heuristic threshold

    # late castling: castling after ply 16 (after 8 moves) OR never castled in many games
    if castled_ply:
        avg_castle_ply = sum(castled_ply) / len(castled_ply)
        late_castling_flag = avg_castle_ply > 16
    else:
        late_castling_flag = True  # if never castled, treat as "late/absent" for profile

    profile = PlayerProfile(
        username=username,
        games_analyzed=games,
        avg_cpl=round(avg_cpl, 2),
        inaccuracy_rate=round(rate(inacc), 4),
        mistake_rate=round(rate(mistake), 4),
        blunder_rate=round(rate(blunder), 4),
        weak_phase=weak_phase,
        opening_preferences=opening_pref_list,
        style=StyleFlags(
            aggressive=aggressive_flag,
            early_queen=early_queen_flag,
            late_castling=late_castling_flag,
        ),
        phase_breakdown=PhaseWeakness(
            opening_avg_cpl=round(opening_avg, 2),
            middlegame_avg_cpl=round(middle_avg, 2),
            endgame_avg_cpl=round(end_avg, 2),
            weak_phase=weak_phase,
        ),
        profile_proofs=proof_positions,
    )
    return profile


def save_profile(profile: PlayerProfile, profiles_dir: str) -> str:
    ensure_dir(profiles_dir)
    out_path = os.path.join(profiles_dir, f"{profile.username}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(asdict(profile), f, indent=2)
    return out_path

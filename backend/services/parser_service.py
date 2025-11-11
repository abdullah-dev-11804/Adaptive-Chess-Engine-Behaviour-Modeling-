import chess.pgn

def parse_pgn(filepath: str):
    with open(filepath) as pgn:
        game = chess.pgn.read_game(pgn)
    moves = [move.uci() for move in game.mainline_moves()]
    return moves

from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request

from services.live_analysis import analyze_move

router = APIRouter(prefix="/analyze", tags=["Live Analysis"])


class MoveAnalysisRequest(BaseModel):
    username: str = Field(..., min_length=1)
    fen: str
    move: str
    depth: int | None = None


@router.post("/move")
def analyze_live_move(payload: MoveAnalysisRequest, request: Request):
    engine = getattr(request.app.state, "stockfish_engine", None)
    if engine is None:
        error = getattr(request.app.state, "stockfish_error", None)
        detail = "Stockfish engine not initialized"
        if error:
            detail = f"Stockfish engine failed to start: {error}"
        raise HTTPException(status_code=500, detail=detail)

    lock = getattr(request.app.state, "stockfish_lock", None)
    depth = payload.depth or 10
    try:
        if lock:
            with lock:
                result = analyze_move(
                    engine=engine,
                    fen=payload.fen,
                    move_uci=payload.move,
                    username=payload.username,
                    depth=depth,
                )
        else:
            result = analyze_move(
                engine=engine,
                fen=payload.fen,
                move_uci=payload.move,
                username=payload.username,
                depth=depth,
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return result

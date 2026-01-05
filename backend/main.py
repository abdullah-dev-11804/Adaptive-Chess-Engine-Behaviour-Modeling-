import os
import threading
from fastapi import FastAPI
from routes import game_routes, model_routes
from fastapi.middleware.cors import CORSMiddleware
from routes import game_routes, model_routes
from routes import analysis_routes
from routes import game_fetch_routes
from routes.profile import router as profile_router
from routes.feedback import router as feedback_router
from routes.live_analysis import router as live_analysis_router
from dotenv import load_dotenv
import chess.engine



load_dotenv()

app = FastAPI(title="Adaptive Chess Engine Backend", version="1.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include routes
app.include_router(game_routes.router)
app.include_router(model_routes.router)
app.include_router(analysis_routes.router)
app.include_router(game_fetch_routes.router)
app.include_router(profile_router)
app.include_router(feedback_router)
app.include_router(live_analysis_router)

@app.on_event("startup")
def startup_engine():
    stockfish_path = os.getenv(
        "STOCKFISH_PATH",
        r"D:\engines\stockfish\stockfish-windows-x86-64-avx2.exe",
    )
    try:
        app.state.stockfish_engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
        app.state.stockfish_error = None
    except Exception as exc:
        app.state.stockfish_engine = None
        app.state.stockfish_error = str(exc)
    app.state.stockfish_lock = threading.Lock()



@app.on_event("shutdown")
def shutdown_engine():
    engine = getattr(app.state, "stockfish_engine", None)
    if engine is not None:
        try:
            engine.quit()
        except Exception:
            pass

@app.get("/")
def root():
    return {"message": "Adaptive Chess Engine API is running 🚀"}

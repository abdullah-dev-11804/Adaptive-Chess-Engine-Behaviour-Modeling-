from fastapi import FastAPI
from routes import game_routes, model_routes
from fastapi.middleware.cors import CORSMiddleware
from routes import game_routes, model_routes
from routes import analysis_routes

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

@app.get("/")
def root():
    return {"message": "Adaptive Chess Engine API is running 🚀"}

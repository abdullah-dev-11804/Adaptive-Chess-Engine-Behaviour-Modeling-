import os
from dotenv import load_dotenv
from google import genai

MODEL_NAME = "gemini-2.0-flash"


def _get_client():
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    load_dotenv(env_path)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None
    return genai.Client(api_key=api_key)


def _missing_key_message() -> str:
    return (
        "Gemini feedback is not available. Please configure a valid GEMINI_API_KEY "
        "and restart the server."
    )


def generate_feedback(profile: dict, proof: dict) -> str:
    """
    Generates personalised chess feedback for a single proof position.
    """

    prompt = f"""
You are a chess coach explaining mistakes to a human player.

PLAYER PROFILE:
- Average CPL: {profile['avg_cpl']}
- Weak phase: {profile['weak_phase']}
- Style:
  - Early queen moves: {profile['style']['early_queen']}
  - Late castling: {profile['style']['late_castling']}
  - Aggressive: {profile['style']['aggressive']}

POSITION:
- FEN: {proof['fen']}
- Move played: {proof['played_move']}
- Centipawn loss: {proof['cpl']}
- Classification: {proof['label']}
- Phase: {proof['phase']}

TASK:
Explain in simple, instructional language:
1. Why this move is bad
2. Which chess principle was violated
3. What the player should focus on improving, considering their usual weaknesses

RULES:
- Do NOT suggest engine-like calculations
- Do NOT mention Stockfish or engines
- Keep it concise (3–5 sentences)
- Be encouraging, not insulting
"""

    client = _get_client()
    if not client:
        return _missing_key_message()

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        text = getattr(response, "text", None)
        return text.strip() if text else _missing_key_message()
    except Exception:
        return _missing_key_message()

import json
import os
from fastapi import APIRouter, HTTPException

from services.feedback import generate_feedback

router = APIRouter()

PROFILES_DIR = os.path.join("data", "profiles")


@router.get("/feedback/{username}")
def get_feedback(username: str):
    profile_path = os.path.join(PROFILES_DIR, f"{username}.json")

    if not os.path.exists(profile_path):
        raise HTTPException(status_code=404, detail="Profile not found")

    with open(profile_path, "r", encoding="utf-8") as f:
        profile = json.load(f)

    proofs = profile.get("profile_proofs", [])
    if not proofs:
        raise HTTPException(status_code=404, detail="No proof positions found")

    feedback_items = []

    for proof in proofs:
        feedback_text = generate_feedback(profile, proof)
        feedback_items.append({
            "move_number": proof["move_number"],
            "played_move": proof["played_move"],
            "label": proof["label"],
            "feedback": feedback_text
        })

    return {
        "username": username,
        "feedback": feedback_items
    }

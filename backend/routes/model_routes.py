from fastapi import APIRouter, Form
from services import ai_service
from pydantic import BaseModel

router = APIRouter(prefix="/model", tags=["Model"])

class MoveRequest(BaseModel):
    fen: str

@router.post("/train")
def train_model(user_id: str = Form(...)):
    result = ai_service.train_model(user_id)
    return result

@router.post("/predict")
def predict_move(request: MoveRequest):
    result = ai_service.predict_move(request.fen)
    return result

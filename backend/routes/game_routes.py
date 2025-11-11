from fastapi import APIRouter, UploadFile, File
import os
from datetime import datetime

router = APIRouter(prefix="/games", tags=["Games"])

UPLOAD_DIR = "data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_pgn(file: UploadFile = File(...)):
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    return {"status": "success", "message": f"File {file.filename} uploaded successfully"}

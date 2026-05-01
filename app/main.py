from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List
import random
import os
import glob

from .parser import get_words, mark_word_as_learned

app = FastAPI()

# Get the base directory (parent of 'app' folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def get_existing_files():
    # Find all .md files in BASE_DIR (which is /work in the container)
    return glob.glob(os.path.join(BASE_DIR, "*.md"))


class WordResponse(BaseModel):
    id: int
    german: str
    translations: str
    explanation: str
    example: str
    file_path: str
    line_index: int


@app.get("/api/words", response_model=List[WordResponse])
def fetch_words():
    files = get_existing_files()
    if not files:
        return []

    all_words = get_words(files)
    # Filter only unmarked words
    unmarked = [w for w in all_words if not w.is_marked]

    # Shuffle words to provide a random order on every load
    random.shuffle(unmarked)

    response = []
    for i, w in enumerate(unmarked):
        response.append(WordResponse(
            id=i,
            german=w.german,
            translations=w.translations,
            explanation=w.explanation,
            example=w.example,
            file_path=w.file_path,
            line_index=w.line_index
        ))
    return response


class MarkRequest(BaseModel):
    file_path: str
    line_index: int


@app.post("/api/mark")
def mark_learned(req: MarkRequest):
    try:
        # Security: check if file_path is within BASE_DIR
        abs_path = os.path.abspath(req.file_path)
        if not abs_path.startswith(os.path.abspath(BASE_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")

        if not os.path.exists(req.file_path):
            raise HTTPException(status_code=404, detail="File not found")

        mark_word_as_learned(req.file_path, req.line_index)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/", response_class=HTMLResponse)
def read_root():
    # Use BASE_DIR for template path
    template_path = os.path.join(BASE_DIR, "app/templates/index.html")
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template not found")

    with open(template_path, "r") as f:
        return f.read()


# Mount static files using BASE_DIR
static_path = os.path.join(BASE_DIR, "app/static")
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

"""
FraudShield ML API

Step 1 (today): a skeleton FastAPI server with two placeholder endpoints
that always return "unknown" — this just proves the extension and the
backend can talk to each other.

Step 4-6 (later): these will load real trained models (models/) and
return real predictions instead of the dummy response below.

Run locally with:
    uvicorn app:app --reload
Then visit http://127.0.0.1:8000/docs for interactive API docs.
"""

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="FraudShield ML API")


class EmailInput(BaseModel):
    text: str


class UrlInput(BaseModel):
    url: str


@app.get("/")
def health_check():
    return {"status": "FraudShield API is running"}


@app.post("/predict/email")
def predict_email(payload: EmailInput):
    # TODO (Step 4): replace with the trained email classifier
    return {"verdict": "unknown", "confidence": 0.0, "note": "model not trained yet"}


@app.post("/predict/url")
def predict_url(payload: UrlInput):
    # TODO (Step 4): replace with the trained URL / website classifier
    return {"verdict": "unknown", "confidence": 0.0, "note": "model not trained yet"}

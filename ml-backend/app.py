"""
FraudShield ML API
Run:  uvicorn app:app --reload
Docs: http://127.0.0.1:8000/docs
"""

import json
import datetime
from pathlib import Path
from typing import Optional, Literal, List

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from preprocessing import clean_email_text as clean_text
from utills.URL_feature_extraction import extract_features

BASE = Path(__file__).parent
MODELS = BASE / "models"
REPORTS = BASE / "data" / "reports.jsonl"

# ---------- settings to verify with teammates ----------
EMAIL_VECTORIZER_FILE = "tfidf_vectorizer.pkl"   # CHANGE: real filename in models/
EMAIL_PHISH_CLASS = 1                            # CHANGE if email labels differ
URL_PHISH_CLASS = 1                              # CHANGE: ask Arijit (0/1 or -1/1?)
URL_THRESHOLD = 0.4                              # lower = catches more fraud

app = FastAPI(title="FraudShield ML API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # the Chrome extension must be allowed to call us
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- load models once at startup ----------
email_model = joblib.load(MODELS / "email_model.pkl")
email_vectorizer = joblib.load(MODELS / EMAIL_VECTORIZER_FILE)
url_model = joblib.load(MODELS / "URL_Detection_compreased.pkl")
meta = json.loads((MODELS / "email_model_meta.json").read_text())

EMAIL_THRESHOLD = meta.get("threshold", 0.5)     # CHANGE if the key has another name

print("Email classes:", email_model.classes_, "| threshold:", EMAIL_THRESHOLD)
print("URL classes:  ", url_model.classes_, "| threshold:", URL_THRESHOLD)


# ---------- helpers ----------
def phish_probability(model, X, phish_class) -> float:
    """Probability of the phishing class, whatever column it is in."""
    classes = list(model.classes_)
    return float(model.predict_proba(X)[0][classes.index(phish_class)])


def build_verdict_email(score: float, threshold: float) -> dict:
    is_phish = score >= threshold
    return {
        "verdict": "phishing" if is_phish else "safe",
        "confidence": round(score if is_phish else 1 - score, 4),
        "phishing_score": round(score, 4),
    }
def build_verdict_url(prediction, score):
    return {
        "verdict": "phishing" if prediction == 1 else "safe",
        "confidence": round(float(max(score, 1 - score)), 4),
        "phishing_score": round(float(score), 4)
    }


# ---------- schemas ----------
class EmailInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000)
    sender: Optional[str] = None
    reply_to: Optional[str] = None


class UrlInput(BaseModel):
    url: str = Field(..., min_length=3, max_length=2048)


class ReportInput(BaseModel):
    type: Literal["email", "url"]
    content: str = Field(..., max_length=20000)
    user_label: Literal["phishing", "safe"]


# ---------- endpoints ----------
@app.get("/")
def health_check():
    return {"status": "FraudShield API is running"}


@app.post("/predict/email")
def predict_email(payload: EmailInput):
    try:
        cleaned = clean_text(payload.text)
        X = email_vectorizer.transform([cleaned])
        score = phish_probability(email_model, X, EMAIL_PHISH_CLASS)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email prediction failed: {e}")
    return build_verdict_email(score, EMAIL_THRESHOLD)


@app.post("/predict/url")
def predict_url(payload: UrlInput):
    try:
        feats = extract_features(payload.url)
        prediction = url_model.predict(feats)[0]
        score = phish_probability(
            url_model, feats, URL_PHISH_CLASS
        )
        return build_verdict_url(prediction, score)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain")
def explain(payload: EmailInput, top_n: int = 8):
    try:
        cleaned = clean_text(payload.text)
        X = email_vectorizer.transform([cleaned])
        names = email_vectorizer.get_feature_names_out()
        contrib = X.toarray()[0] * email_model.coef_[0]
        idx = np.argsort(-np.abs(contrib))[:top_n]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explain failed: {e}")
    return {
        "top_features": [
            {
                "feature": str(names[i]),
                "weight": round(float(contrib[i]), 4),
                "pushes_toward": "phishing" if contrib[i] > 0 else "safe",
            }
            for i in idx if contrib[i] != 0
        ]
    }


@app.post("/report")
def report(payload: ReportInput):
    REPORTS.parent.mkdir(exist_ok=True)
    entry = {**payload.model_dump(), "ts": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    with REPORTS.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    return {"status": "logged"}
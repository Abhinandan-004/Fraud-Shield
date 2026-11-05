"""
Mock FraudShield API — lets the extension be built and tested BEFORE the
real models exist. It follows the same contract as app.py (see
docs/API_CONTRACT.md) but decides with simple keyword rules.

Run:  uvicorn mock_app:app --reload
"""
import json, re, time
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FraudShield MOCK API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

URGENT = ["urgent", "verify", "suspended", "password", "account", "click here", "immediately",
          "confirm", "bank", "winner", "prize", "login", "security alert", "expire"]
BAD_URL = ["login", "verify", "secure", "account", "update", "bank", "free", "bonus"]


class EmailIn(BaseModel):
    text: str
    kind: str | None = None

class UrlIn(BaseModel):
    url: str

class UrlsIn(BaseModel):
    urls: list[str]

class ExplainIn(BaseModel):
    kind: str
    text: str | None = None
    url: str | None = None

class ReportIn(BaseModel):
    kind: str
    content: str
    label: str


def score_email(text: str):
    t = text.lower()
    hits = [(w, 1.0) for w in URGENT if w in t]
    links = len(re.findall(r"https?://", t))
    s = min(1.0, len(hits) * 0.18 + links * 0.08)
    return s, hits

def score_url(url: str):
    p = urlparse(url if "//" in url else "http://" + url)
    host = p.hostname or ""
    s, hits = 0.05, []
    if re.fullmatch(r"\d+(\.\d+){3}", host): s += .5; hits.append(("ip address host", 1.0))
    if p.scheme != "https": s += .15; hits.append(("no https", 0.5))
    if len(url) > 75: s += .15; hits.append(("very long url", 0.5))
    if host.count(".") >= 3: s += .15; hits.append(("many subdomains", 0.6))
    if "@" in url: s += .3; hits.append(("@ in url", 1.0))
    for w in BAD_URL:
        if w in url.lower(): s += .08; hits.append((w, 0.4))
    return min(s, 0.99), hits

def verdict(s: float):
    return ("fraud" if s >= .6 else "suspicious" if s >= .3 else "safe")

def pack(s: float):
    v = verdict(s)
    return {"verdict": v, "confidence": round(s if v != "safe" else 1 - s, 2), "note": "mock model"}


@app.get("/")
def health():
    return {"status": "FraudShield MOCK API is running"}

@app.post("/predict/email")
def predict_email(p: EmailIn):
    return pack(score_email(p.text)[0])

@app.post("/predict/url")
def predict_url(p: UrlIn):
    return pack(score_url(p.url)[0])

@app.post("/predict/urls")
def predict_urls(p: UrlsIn):
    return {"results": [{"url": u, **pack(score_url(u)[0])} for u in p.urls]}

@app.post("/explain")
def explain(p: ExplainIn):
    _, hits = score_url(p.url) if p.kind == "url" else score_email(p.text or "")
    return {"top_features": [[w, wt] for w, wt in hits]}

@app.post("/report")
def report(p: ReportIn):
    path = Path("data/reports.jsonl")
    path.parent.mkdir(exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": time.time(), **p.model_dump()}) + "\n")
    return {"status": "logged"}

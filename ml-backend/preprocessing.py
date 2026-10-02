"""
Shared text cleaning — used by both the training scripts and the API,
so the model always sees text in the same shape it was trained on.
"""
import re

MAX_CHARS = 10_000
URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

def clean_email_text(text: str) -> str:
    text = str(text)[:MAX_CHARS]
    text = URL_RE.sub(" urltoken ", text)
    text = EMAIL_RE.sub(" emailtoken ", text)
    return re.sub(r"\s+", " ", text).strip()
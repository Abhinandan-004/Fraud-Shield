"""
Step 3a: clean email text for modelling.

Input : data/emails_clean.csv
Output: data/emails_model_ready.csv  (columns: text, label, url_count)
"""

import re
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

MAX_CHARS = 10_000   # cut off giant emails
MIN_CHARS = 20       # drop near-empty emails

URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

df = pd.read_csv(DATA_DIR / "emails_clean.csv")
print("Start:", df.shape)

# 1. Truncate huge emails first so the regexes below stay fast
df["text"] = df["text"].str.slice(0, MAX_CHARS)

# 2. Count URLs BEFORE we replace them (useful signal for later)
df["url_count"] = df["text"].apply(lambda t: len(URL_RE.findall(t)))

# 3. Replace URLs and email addresses with placeholder tokens
def clean(text: str) -> str:
    text = URL_RE.sub(" urltoken ", text)
    text = EMAIL_RE.sub(" emailtoken ", text)
    return re.sub(r"\s+", " ", text).strip()

df["text"] = df["text"].apply(clean)

# 4. Look at very short emails before deleting them
short = df[df["text"].str.len() < MIN_CHARS]
print(f"\nEmails under {MIN_CHARS} chars: {len(short)}")
print("Their labels:\n", short["label"].value_counts())
print("Examples:\n", short["text"].head(8).to_string())

df = df[df["text"].str.len() >= MIN_CHARS]

# 5. Cleaning can create new duplicates, so remove them again
df = df.drop_duplicates(subset="text")

print("\nFinal shape:", df.shape)
print("Class balance:\n", df["label"].value_counts())
print("\nLength after cleaning:\n", df["text"].str.len().describe())
print("\nAverage URLs per email by class:")
print(df.groupby("label")["url_count"].mean())

df.to_csv(DATA_DIR / "emails_model_ready.csv", index=False)
print("\nSaved data/emails_model_ready.csv")
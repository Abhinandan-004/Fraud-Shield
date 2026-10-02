"""
Step 5b: validate the trained models on an independent dataset (CEAS_08),
which shares no source with our training data.

Input : data/external/CEAS_08.csv, models/tfidf_vectorizer.pkl,
        models/{logreg,naive_bayes,linear_svm}.pkl, data/train.csv, data/test.csv
"""

import re
import joblib
import pandas as pd
from pathlib import Path
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

BASE = Path(__file__).resolve().parent.parent
DATA_DIR, MODEL_DIR = BASE / "data", BASE / "models"
MAX_CHARS = 10_000

URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

def clean(text: str) -> str:
    # same cleaning as 03_clean_text.py, kept identical on purpose so the
    # model sees text in the same shape it was trained on
    text = str(text)[:MAX_CHARS]
    text = URL_RE.sub(" urltoken ", text)
    text = EMAIL_RE.sub(" emailtoken ", text)
    return re.sub(r"\s+", " ", text).strip()

# 1. Load and build a text column the same way we did for training
ext = pd.read_csv(DATA_DIR / "external" / "CEAS_08.csv")
ext["text"] = (ext["subject"].fillna("") + " " + ext["body"].fillna("")).apply(clean)
ext = ext.dropna(subset=["label"])
ext["label"] = ext["label"].astype(int)

print("External set shape:", ext.shape)
print("Class balance:\n", ext["label"].value_counts())

# 2. Spot-check the label convention before trusting it
print("\nSample label=1 (should look like phishing/spam):")
print(ext[ext.label == 1][["sender", "subject"]].head(3).to_string())
print("\nSample label=0 (should look legitimate):")
print(ext[ext.label == 0][["sender", "subject"]].head(3).to_string())

# 3. Check for overlap with our own train/test text (leakage check)
own_text = pd.concat([
    pd.read_csv(DATA_DIR / "train.csv")["text"],
    pd.read_csv(DATA_DIR / "test.csv")["text"],
])
overlap = ext["text"].isin(set(own_text))
print(f"\nExact text overlap with our data: {overlap.sum()} of {len(ext)} rows")
ext = ext[~overlap]  # drop any that do overlap, to keep this a fair test

# 4. Transform with the SAVED vectorizer — transform only, never fit again
vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")
X_ext = vectorizer.transform(ext["text"])
y_ext = ext["label"].to_numpy()

# 5. Evaluate each saved model
for name in ["logreg", "naive_bayes", "linear_svm"]:
    model = joblib.load(MODEL_DIR / f"{name}.pkl")
    pred = model.predict(X_ext)
    p, r, f1, _ = precision_recall_fscore_support(y_ext, pred, pos_label=1, average="binary")
    tn, fp, fn, tp = confusion_matrix(y_ext, pred).ravel()
    print(f"\n===== {name} on external data =====")
    print(f"precision={p:.3f}  recall={r:.3f}  f1={f1:.3f}")
    print(f"caught phish={tp}  missed phish={fn}  false alarms={fp}  correct safe={tn}")
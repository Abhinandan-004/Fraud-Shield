"""
Step 5c-5d: tune the decision threshold on one half of the external data,
report a final honest score on the untouched other half, and inspect
specific errors.
"""

import re
import joblib
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

BASE = Path(__file__).resolve().parent.parent
DATA_DIR, MODEL_DIR = BASE / "data", BASE / "models"
MAX_CHARS = 10_000

URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")

def clean(text: str) -> str:
    text = str(text)[:MAX_CHARS]
    text = URL_RE.sub(" urltoken ", text)
    text = EMAIL_RE.sub(" emailtoken ", text)
    return re.sub(r"\s+", " ", text).strip()

ext = pd.read_csv(DATA_DIR / "external" / "CEAS_08.csv")
ext["text"] = (ext["subject"].fillna("") + " " + ext["body"].fillna("")).apply(clean)
ext = ext.dropna(subset=["label"])
ext["label"] = ext["label"].astype(int)

own_text = pd.concat([
    pd.read_csv(DATA_DIR / "train.csv")["text"],
    pd.read_csv(DATA_DIR / "test.csv")["text"],
])
ext = ext[~ext["text"].isin(set(own_text))].reset_index(drop=True)

val_df, holdout_df = train_test_split(
    ext, test_size=0.5, stratify=ext["label"], random_state=42
)

vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")
model = joblib.load(MODEL_DIR / "logreg.pkl")

X_val, y_val = vectorizer.transform(val_df["text"]), val_df["label"].to_numpy()
X_holdout, y_holdout = vectorizer.transform(holdout_df["text"]), holdout_df["label"].to_numpy()

# 1. Threshold search on the TUNING half only
proba_val = model.predict_proba(X_val)[:, 1]
print("Threshold search (tuning half):")
print(f"{'threshold':>9} {'precision':>10} {'recall':>8} {'f1':>6}")
for t in [0.5, 0.4, 0.35, 0.3, 0.25, 0.2]:
    pred = (proba_val >= t).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(y_val, pred, pos_label=1, average="binary")
    print(f"{t:9.2f} {p:10.3f} {r:8.3f} {f1:6.3f}")

# 2. Pick a threshold by eye from the table above, then set it here:
CHOSEN_THRESHOLD = 0.4  # <-- change this after reading the printout, rerun

# 3. Final honest score on the untouched holdout half
proba_holdout = model.predict_proba(X_holdout)[:, 1]
pred_holdout = (proba_holdout >= CHOSEN_THRESHOLD).astype(int)
p, r, f1, _ = precision_recall_fscore_support(y_holdout, pred_holdout, pos_label=1, average="binary")
tn, fp, fn, tp = confusion_matrix(y_holdout, pred_holdout).ravel()
print(f"\nFinal holdout @ threshold {CHOSEN_THRESHOLD}: precision={p:.3f} recall={r:.3f} f1={f1:.3f}")
print(f"caught phish={tp}  missed phish={fn}  false alarms={fp}  correct safe={tn}")

# 4. Error analysis on the holdout half
holdout_df = holdout_df.reset_index(drop=True)
holdout_df["pred"], holdout_df["proba"] = pred_holdout, proba_holdout

fn_rows = holdout_df[(holdout_df.label == 1) & (holdout_df.pred == 0)]
fp_rows = holdout_df[(holdout_df.label == 0) & (holdout_df.pred == 1)]

print(f"\n--- Missed phishing (false negatives), {len(fn_rows)} total, showing 5 ---")
print(fn_rows[["subject", "proba"]].head(5).to_string())
print(f"\n--- False alarms (false positives), {len(fp_rows)} total, showing 5 ---")
print(fp_rows[["subject", "proba"]].head(5).to_string())
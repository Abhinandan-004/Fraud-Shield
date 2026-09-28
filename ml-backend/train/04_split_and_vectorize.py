"""
Step 3b: stratified train/test split, then TF-IDF (fit on train only).

Input : data/emails_model_ready.csv
Output: data/train.csv, data/test.csv, data/X_train.npz, data/X_test.npz,
        models/tfidf_vectorizer.pkl
"""

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from scipy import sparse
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer

BASE = Path(__file__).resolve().parent.parent
DATA_DIR = BASE / "data"
MODEL_DIR = BASE / "models"

df = pd.read_csv(DATA_DIR / "emails_model_ready.csv")

# 1. Split 80/20. stratify keeps the 63/37 class mix in both halves;
#    random_state makes the split repeatable for your teammates.
train_df, test_df = train_test_split(
    df, test_size=0.2, stratify=df["label"], random_state=42
)
print("Train:", train_df.shape, "| Test:", test_df.shape)
print("Phishing share  train: %.3f  test: %.3f"
      % (train_df["label"].mean(), test_df["label"].mean()))

train_df.to_csv(DATA_DIR / "train.csv", index=False)
test_df.to_csv(DATA_DIR / "test.csv", index=False)

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

# Words that reveal WHERE an email came from rather than whether it is phishing
GIVEAWAY_WORDS = {
    # our own placeholders + URL/email fragments (formatted differently per class)
    "urltoken", "emailtoken", "http", "https", "www", "com", "org", "net",
    # Enron-era header/corpus fingerprints
    "enron", "ect", "hou", "subject", "date", "pm", "am", "cc",
}
STOP_WORDS = list(ENGLISH_STOP_WORDS.union(GIVEAWAY_WORDS))

# 2. TF-IDF: single words + word pairs, ignore very rare/very common terms
vectorizer = TfidfVectorizer(
    max_features=50_000,
    ngram_range=(1, 2),
    min_df=3,
    max_df=0.9,
    sublinear_tf=True,
    stop_words=STOP_WORDS,
    token_pattern=r"(?u)\b[a-zA-Z]{2,}\b",   # letters only: drops 2001, 10, 00...
)
# fit_transform on TRAIN only; the test set only gets transform()
X_train = vectorizer.fit_transform(train_df["text"])
X_test = vectorizer.transform(test_df["text"])
print("X_train:", X_train.shape, "| X_test:", X_test.shape)

# 3. Save everything for the next step
MODEL_DIR.mkdir(exist_ok=True)
joblib.dump(vectorizer, MODEL_DIR / "tfidf_vectorizer.pkl")
sparse.save_npz(DATA_DIR / "X_train.npz", X_train)
sparse.save_npz(DATA_DIR / "X_test.npz", X_test)

# 4. Sanity check: which words stand out most in each class?
terms = np.array(vectorizer.get_feature_names_out())
y_train = train_df["label"].to_numpy()

for label, name in [(1, "PHISHING"), (0, "SAFE")]:
    mean_scores = np.asarray(X_train[y_train == label].mean(axis=0)).ravel()
    top = terms[mean_scores.argsort()[::-1][:20]]
    print(f"\nTop 20 terms in {name} emails:")
    print(", ".join(top))
"""
Step 4: train baseline classifiers on the TF-IDF features and compare them.

Input : data/train.csv, data/test.csv, data/X_train.npz, data/X_test.npz
Output: models/<name>.pkl for each model
"""

import joblib
import pandas as pd
from pathlib import Path
from scipy import sparse
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.metrics import precision_recall_fscore_support, confusion_matrix

BASE = Path(__file__).resolve().parent.parent
DATA_DIR, MODEL_DIR = BASE / "data", BASE / "models"

X_train = sparse.load_npz(DATA_DIR / "X_train.npz")
X_test = sparse.load_npz(DATA_DIR / "X_test.npz")
y_train = pd.read_csv(DATA_DIR / "train.csv")["label"].to_numpy()
y_test = pd.read_csv(DATA_DIR / "test.csv")["label"].to_numpy()

models = {
    "logreg": LogisticRegression(max_iter=1000, class_weight="balanced"),
    "naive_bayes": MultinomialNB(),
    "linear_svm": LinearSVC(class_weight="balanced"),
}

for name, model in models.items():
    model.fit(X_train, y_train)

    print(f"\n===== {name} =====")
    for split, X, y in [("train", X_train, y_train), ("test", X_test, y_test)]:
        pred = model.predict(X)
        p, r, f1, _ = precision_recall_fscore_support(
            y, pred, pos_label=1, average="binary"
        )
        print(f"{split:5s}  precision={p:.3f}  recall={r:.3f}  f1={f1:.3f}")

    tn, fp, fn, tp = confusion_matrix(y_test, model.predict(X_test)).ravel()
    print(f"test confusion: caught phish={tp}, missed phish={fn}, "
          f"false alarms={fp}, correct safe={tn}")

    joblib.dump(model, MODEL_DIR / f"{name}.pkl")

print("\nSaved models to models/")
"""
Step 2c: turn the raw Kaggle CSV into a clean {text, label} table.

Input : ml-backend/data/Phishing_Email.csv
Output: ml-backend/data/emails_clean.csv
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

df = pd.read_csv(DATA_DIR / "Phishing_Email.csv")
print("Raw shape:", df.shape)

# 1. Drop the accidental index column and rename to simple names
df = df.drop(columns=["Unnamed: 0"]).rename(
    columns={"Email Text": "text", "Email Type": "label"}
)

# 2. Look at the labels before converting them
print("\nLabel values found:")
print(df["label"].value_counts(dropna=False))

# 3. Convert text labels to numbers: 1 = phishing, 0 = safe
label_map = {"Phishing Email": 1, "Safe Email": 0}
df["label"] = df["label"].map(label_map)

# 4. Remove rows that are missing text or a label
before = len(df)
df = df.dropna(subset=["text", "label"])
df["text"] = df["text"].astype(str).str.strip()
df = df[df["text"] != ""]
print(f"\nRemoved {before - len(df)} empty/missing rows")

# 5. Remove exact duplicate emails (prevents train/test leakage)
before = len(df)
df = df.drop_duplicates(subset="text")
print(f"Removed {before - len(df)} duplicate emails")

df["label"] = df["label"].astype(int)

# 6. Summary of the final dataset
print("\nFinal shape:", df.shape)
print("Class balance:")
print(df["label"].value_counts())
print("\nEmail length (characters):")
print(df["text"].str.len().describe())

df.to_csv(DATA_DIR / "emails_clean.csv", index=False)
print("\nSaved data/emails_clean.csv")
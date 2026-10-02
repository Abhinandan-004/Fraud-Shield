"""
Step 5a: inspect the external validation file before using it.
"""

import pandas as pd
from pathlib import Path

EXTERNAL_DIR = Path(__file__).resolve().parent.parent / "data" / "external"

df = pd.read_csv(EXTERNAL_DIR / "CEAS_08.csv")
print("Shape:", df.shape)
print("Columns:", list(df.columns))
print(df.head(3))

# Find whatever the label column is and show its value counts
for col in df.columns:
    if df[col].nunique() <= 5:
        print(f"\n'{col}' unique values:")
        print(df[col].value_counts(dropna=False))
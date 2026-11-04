import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

csv_files = sorted(DATA_DIR.glob("*.csv"))
print(f"Found {len(csv_files)} CSV file(s):")
for f in csv_files:
    print(" -", f.name)

for f in csv_files:
    df = pd.read_csv(f, nrows=5)
    print(f"\n=== {f.name} ===")
    print("columns:", list(df.columns))
    print(df.head(2))
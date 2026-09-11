# FraudShield

A Chrome extension that reads the page you're on to warn you about
phishing emails and fraudulent websites, powered by a Python machine
learning backend.

> Status: project setup complete. The extension and API talk to
> placeholder logic right now — real ML models come in later steps.

## How it works

1. A **content script** runs on every page and (later) extracts the
   email text or the page/URL you're looking at.
2. A **background service worker** sends that data to a small
   **Python API**.
3. The API runs two ML models — one for email text, one for
   URLs/websites — and returns a verdict.
4. The extension shows the verdict via a toolbar badge and popup.

## Project structure

```
fraud-shield/
├── extension/          Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background.js   service worker — talks to the API
│   ├── content.js      runs on each page — extracts data
│   ├── popup.html/js   UI shown when you click the icon
│   └── icons/          toolbar icons
└── ml-backend/          Python ML API
    ├── app.py           FastAPI server
    ├── requirements.txt
    ├── data/             datasets (not committed — see .gitignore)
    ├── models/           trained model files (not committed)
    └── train/            training scripts
```

## Running it locally

**Backend:**
```bash
cd ml-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```
Visit http://127.0.0.1:8000/docs to see the API.

**Extension:**
1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select the `extension/` folder

## Roadmap

- [x] Step 1 — project setup
- [ ] Step 2 — collect phishing email + phishing URL datasets
- [ ] Step 3 — feature engineering
- [ ] Step 4 — train baseline ML models
- [ ] Step 5 — evaluate and improve
- [ ] Step 6 — wire trained models into the API
- [ ] Step 7 — build out the real extension logic
- [ ] Step 8 — connect extension to API end to end
- [ ] Step 9 — extras (typosquat detection, link highlighting, feedback loop)
- [ ] Step 10 — polish, docs, publish

## License

MIT — see [LICENSE](LICENSE).

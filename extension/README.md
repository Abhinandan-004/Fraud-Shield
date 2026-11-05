# FraudShield extension

## Files
| File | Job |
|---|---|
| `manifest.json` | Permissions, scripts, CSP (allows Tesseract's WASM) |
| `config.js` | API address, limits, verdict labels/colours |
| `api.js` | All calls to the Python API |
| `content.js` | Reads Gmail/Outlook email or page URL; highlights bad links |
| `background.js` | Service worker: calls API, saves result, sets badge |
| `popup.html/css/js` | Verdict, Rescan, Why?, Report, Scan screen |
| `scan.html/js` | Screen scan: desktopCapture → Tesseract OCR → API |
| `vendor/` | Tesseract.js worker, WASM core, English language data (bundled; Chrome MV3 blocks CDNs) |

## Try it without the ML models
```bash
cd ml-backend
pip install -r requirements.txt
uvicorn mock_app:app --reload
```
Then load `extension/` at `chrome://extensions` (Developer mode → Load unpacked).

After editing extension code, click the reload icon on the extension card, and refresh the page you're testing.

## If Gmail/Outlook stops being detected
Their HTML changes. Fix the selectors at the top of `content.js` (`EMAIL_SITES`).
Find a new one with right-click → Inspect on the email body.

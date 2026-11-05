# FraudShield API contract

Agreed between Jyoti (extension) and Arup (backend). The extension only
talks to the API through `extension/api.js`; if this file changes, update that file.

Verdict values: `fraud`, `suspicious`, `safe`, `unknown`. Confidence is 0.0–1.0.

| Endpoint | Request | Response |
|---|---|---|
| `GET /` | – | `{"status": "..."}` |
| `POST /predict/email` | `{"text": "..."}` | `{"verdict": "fraud", "confidence": 0.93}` |
| `POST /predict/url` | `{"url": "https://..."}` | same as above |
| `POST /predict/urls` | `{"urls": ["...", "..."]}` | `{"results": [{"url": "...", "verdict": "...", "confidence": 0.8}]}` |
| `POST /explain` | `{"kind": "email", "text": "..."}` or `{"kind": "url", "url": "..."}` | `{"top_features": [["urgent", 0.41], ["verify", 0.30]]}` (negative weight = pushes toward safe) |
| `POST /report` | `{"kind": "email\|url", "content": "...", "label": "phishing\|safe"}` | `{"status": "logged"}` |

`mock_app.py` in `ml-backend/` implements all of this with simple rules so the
extension can be built before the real models are ready.

// background.js — the extension's service worker (Manifest V3)
//
// Step 1 (today): just log that the extension started.
// Step 8 (later): this will receive data from content.js, call our
// Python ML API, and tell popup.js / the toolbar badge what verdict
// to show (safe, suspicious, or fraud).

chrome.runtime.onInstalled.addListener(() => {
  console.log("FraudShield installed.");
});

// TODO (Step 8): chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { ... })
//                to receive extracted text/URL from content.js
// TODO (Step 8): fetch("http://127.0.0.1:8000/predict/url", { ... }) to call our FastAPI backend
// TODO (Step 8): chrome.action.setBadgeText({ text: "!" }) to show a warning badge

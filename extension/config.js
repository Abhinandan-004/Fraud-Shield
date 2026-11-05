// config.js — settings shared by background.js, popup.js and scan.js.
// Change API_BASE here when the backend is deployed.

export const API_BASE = "http://127.0.0.1:8000";

// Never send more than this many characters of email/page text to the API.
export const MAX_TEXT = 5000;

// Network timeout for API calls (ms).
export const API_TIMEOUT = 8000;

// Verdict -> how it looks. Used by the popup, scan page and badge.
export const VERDICTS = {
  fraud:      { label: "Likely fraud", badge: "!",  color: "#c8321f" },
  suspicious: { label: "Suspicious",   badge: "?",  color: "#b97b00" },
  safe:       { label: "Looks safe",   badge: "✓",  color: "#1f8a5b" },
  unknown:    { label: "Not sure",     badge: "",   color: "#6b7a86" },
  error:      { label: "Can't reach server", badge: "–", color: "#6b7a86" }
};

// Sites we never bother the API about (exact host match, "www." ignored).
export const ALLOWLIST = [
  "google.com", "youtube.com", "wikipedia.org", "github.com",
  "stackoverflow.com", "claude.ai", "anthropic.com", "localhost", "127.0.0.1"
];

// How long a URL verdict is reused before asking the API again (ms).
export const CACHE_MS = 10 * 60 * 1000;

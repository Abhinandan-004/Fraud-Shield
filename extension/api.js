// api.js — the ONLY place that talks to the FraudShield Python API.
// If Arup changes an endpoint or response shape, fix it here.

import { API_BASE, API_TIMEOUT, MAX_TEXT } from "./config.js";

async function post(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
  try {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const err = new Error(`API ${path} returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Different model code may say "phishing" or "legitimate" — map to our 4 words.
export function normalizeVerdict(v) {
  const s = String(v || "").toLowerCase();
  if (["fraud", "phishing", "malicious", "spam", "bad"].includes(s)) return "fraud";
  if (["suspicious", "warning", "maybe"].includes(s)) return "suspicious";
  if (["safe", "legitimate", "benign", "ham", "good"].includes(s)) return "safe";
  return "unknown";
}

function clean(data) {
  return {
    verdict: normalizeVerdict(data.verdict),
    confidence: Number(data.confidence) || 0,
    note: data.note || ""
  };
}

export async function predictEmail(text) {
  return clean(await post("/predict/email", { text: text.slice(0, MAX_TEXT) }));
}

export async function predictUrl(url) {
  return clean(await post("/predict/url", { url }));
}

// Many URLs at once. Uses /predict/urls if the API has it,
// otherwise falls back to one request per URL (max 20).
export async function predictUrls(urls) {
  const unique = [...new Set(urls)].slice(0, 20);
  if (!unique.length) return {};
  try {
    const data = await post("/predict/urls", { urls: unique });
    const out = {};
    for (const r of data.results || []) out[r.url] = clean(r);
    return out;
  } catch (e) {
    if (e.status !== 404 && e.status !== 405) throw e;
  }
  const out = {};
  await Promise.all(unique.map(async (u) => {
    try { out[u] = await predictUrl(u); } catch { /* skip this link */ }
  }));
  return out;
}

// "Why did you say that?" — top words / features behind the verdict.
// kind: "email" | "url"; content: the text or the URL.
export async function explain(kind, content) {
  const body = kind === "email"
    ? { kind, text: content.slice(0, MAX_TEXT) }
    : { kind, url: content };
  const data = await post("/explain", body);
  // Accept [["word", 0.4], ...] or [{feature:"word", weight:0.4}, ...]
  return (data.top_features || []).map((f) =>
    Array.isArray(f)
      ? { name: String(f[0]), weight: Number(f[1]) }
      : { name: String(f.feature || f.name), weight: Number(f.weight) }
  );
}

// User feedback: label is "phishing" or "safe". Logged for future retraining.
export async function report(kind, content, label) {
  return post("/report", { kind, content: content.slice(0, MAX_TEXT), label });
}

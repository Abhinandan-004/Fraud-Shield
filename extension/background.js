// background.js — the extension's service worker (Manifest V3)
//
// content.js  --SCAN_PAGE-->  here  --fetch-->  Python API
//                                   --> saves result, counts stats, sets toolbar badge
//                                   --> replies to content.js (which animates the shield)
// popup.js reads the saved result from chrome.storage.session.
//
// A service worker can be shut down at any moment, so never keep
// results in normal variables — always use chrome.storage.

import { VERDICTS, ALLOWLIST, CACHE_MS } from "./config.js";
import { predictEmail, predictUrl, predictUrls } from "./api.js";

const key = (tabId) => `tab:${tabId}`;

async function setBadge(tabId, verdict) {
  const v = VERDICTS[verdict] || VERDICTS.unknown;
  await chrome.action.setBadgeText({ tabId, text: v.badge });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: v.color });
  await chrome.action.setTitle({ tabId, title: `FraudShield: ${v.label}` });
}

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// "Today: N checked, M warnings" shown in the popup.
async function bumpStats(verdict) {
  const today = new Date().toDateString();
  const { stats } = await chrome.storage.local.get("stats");
  const s = stats && stats.date === today ? stats : { date: today, scanned: 0, flagged: 0 };
  s.scanned++;
  if (verdict === "fraud" || verdict === "suspicious") s.flagged++;
  await chrome.storage.local.set({ stats: s });
}

async function getResult(kind, content) {
  if (kind === "url") {
    if (ALLOWLIST.includes(hostOf(content))) {
      return { verdict: "safe", confidence: 1, note: "Trusted site" };
    }
    const ck = "cache:" + content;
    const hit = (await chrome.storage.session.get(ck))[ck];
    if (hit && Date.now() - hit.ts < CACHE_MS) return hit.result;
  }
  try {
    const result = kind === "email" ? await predictEmail(content) : await predictUrl(content);
    if (kind === "url") await chrome.storage.session.set({ ["cache:" + content]: { ts: Date.now(), result } });
    return result;
  } catch (err) {
    console.warn("FraudShield API error:", err.message);
    return { verdict: "error", confidence: 0, note: err.message };
  }
}

async function handleScan(msg, tabId) {
  const { kind, content, title } = msg;           // kind: "email" | "url"
  const result = await getResult(kind, content);
  const saved = { kind, content, title: title || "", url: msg.url || "", ...result, ts: Date.now() };
  await chrome.storage.session.set({ [key(tabId)]: saved });
  await setBadge(tabId, result.verdict);
  if (result.verdict !== "error") await bumpStats(result.verdict);
  return saved;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === "SCAN_PAGE" && tabId != null) {
    handleScan(msg, tabId).then(sendResponse);
    return true;                                   // keep channel open (async)
  }

  if (msg.type === "NO_CONTENT" && tabId != null) {
    chrome.storage.session.remove(key(tabId));
    chrome.action.setBadgeText({ tabId, text: "" });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "CHECK_LINKS") {
    predictUrls(msg.urls || [])
      .then((results) => sendResponse({ results }))
      .catch(() => sendResponse({ results: {} }));
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") {
    chrome.storage.session.remove(key(tabId));
    chrome.action.setBadgeText({ tabId, text: "" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(key(tabId));
});

chrome.runtime.onInstalled.addListener(() => console.log("FraudShield installed."));

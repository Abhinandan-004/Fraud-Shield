// popup.js — the small window that opens when you click the icon.
// Shows the saved verdict for the current tab (animated shield + confidence ring),
// today's scan counts, and buttons: Rescan, Why?, Report, Scan screen.

import { VERDICTS } from "./config.js";
import { explain, report } from "./api.js";

const $ = (id) => document.getElementById(id);
const RING = 175.93;                 // circumference of the ring (2 * pi * 28)
let tab = null;
let current = null;                  // the saved result for this tab

const REASON = {
  url: {
    fraud: "This page matches known phishing patterns. Don't enter any information.",
    suspicious: "This page looks unusual. Be careful with passwords and payments.",
    safe: "No signs of fraud found on this page.",
    unknown: "FraudShield couldn't decide about this page."
  },
  email: {
    fraud: "This email looks like phishing. Don't click links or reply.",
    suspicious: "This email has warning signs. Check the sender first.",
    safe: "No signs of phishing found in this email.",
    unknown: "FraudShield couldn't decide about this email."
  }
};

function toast(msg) { $("toast").textContent = msg; }
function showHint(t) { $("hint").textContent = t; $("hint").hidden = false; }
function setButtons(on) { for (const id of ["whyBtn", "reportBtn", "safeBtn"]) $(id).disabled = !on; }

function render(r) {
  current = r;
  const band = $("verdictBand");
  if (!r) {
    band.dataset.state = "unknown";
    $("verdictWord").textContent = "Nothing scanned yet";
    $("ring").style.strokeDashoffset = RING;
    $("confidence").textContent = "";
    $("reason").textContent = "";
    $("subject").textContent = "";
    showHint("Open a website or an email, or press Rescan.");
    setButtons(false);
    return;
  }
  const v = VERDICTS[r.verdict] || VERDICTS.unknown;
  band.dataset.state = r.verdict;
  $("verdictWord").textContent = v.label;
  $("ring").style.strokeDashoffset = RING * (1 - (r.verdict === "error" ? 0 : r.confidence || 0));
  $("confidence").textContent =
    r.verdict === "error" ? "" : r.confidence ? `${Math.round(r.confidence * 100)}% confidence` : (r.note || "");
  $("reason").textContent = (REASON[r.kind] || REASON.url)[r.verdict] || "";
  $("subject").textContent = (r.kind === "email" ? "Email: " : "Page: ") + (r.title || r.url);

  if (r.verdict === "error") {
    showHint("Start the backend:  cd ml-backend && uvicorn app:app --reload");
  } else {
    $("hint").hidden = true;
  }
  setButtons(r.verdict !== "error");
}

async function loadStats() {
  const { stats } = await chrome.storage.local.get("stats");
  const s = stats && stats.date === new Date().toDateString() ? stats : null;
  $("stats").textContent = s
    ? `Today: ${s.scanned} checked, ${s.flagged} warning${s.flagged === 1 ? "" : "s"}`
    : "No scans yet today";
}

async function load() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    const data = await chrome.storage.session.get(`tab:${tab.id}`);
    render(data[`tab:${tab.id}`] || null);
  } else {
    render(null);
  }
  loadStats();
}

// Update live when a rescan finishes while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && tab && changes[`tab:${tab.id}`]) {
    render(changes[`tab:${tab.id}`].newValue || null);
    loadStats();
  }
});

$("rescanBtn").addEventListener("click", async () => {
  if (!tab) return;
  toast("");
  $("whyList").innerHTML = ""; $("why").hidden = true;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "RESCAN" });
    $("verdictBand").dataset.state = "loading";
    $("verdictWord").textContent = "Checking…";
    $("confidence").textContent = ""; $("reason").textContent = "";
  } catch {
    showHint("Can't scan this page. Reload the tab and try again (chrome:// pages aren't supported).");
  }
});

$("whyBtn").addEventListener("click", async () => {
  if (!current) return;
  $("why").hidden = false;
  const list = $("whyList");
  list.innerHTML = "<li>Loading…</li>";
  try {
    const feats = await explain(current.kind, current.content);
    if (!feats.length) { list.innerHTML = "<li>No explanation available yet.</li>"; return; }
    const max = Math.max(...feats.map((f) => Math.abs(f.weight))) || 1;
    list.innerHTML = "";
    for (const f of feats.slice(0, 8)) {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = f.name;
      const bar = document.createElement("div");
      bar.className = "bar" + (f.weight < 0 ? " neg" : "");
      bar.style.width = Math.max(6, (Math.abs(f.weight) / max) * 100) + "%";
      li.append(name, bar);
      list.append(li);
    }
  } catch {
    list.innerHTML = "<li>Explanation isn't available from the server.</li>";
  }
});

async function sendFeedback(label) {
  if (!current) return;
  try {
    await report(current.kind, current.content, label);
    toast("Thanks — your feedback was saved.");
  } catch {
    toast("Couldn't send feedback (is the server running?).");
  }
}
$("reportBtn").addEventListener("click", () => sendFeedback("phishing"));
$("safeBtn").addEventListener("click", () => sendFeedback("safe"));

// Screen scan runs in its own tab because this popup closes when the
// screen-picker window takes focus.
$("screenBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("scan.html") });
});

// "Show floating shield" setting (read by shield.js)
chrome.storage.sync.get({ showShield: true }).then((s) => { $("shieldToggle").checked = s.showShield; });
$("shieldToggle").addEventListener("change", (e) => chrome.storage.sync.set({ showShield: e.target.checked }));

load();

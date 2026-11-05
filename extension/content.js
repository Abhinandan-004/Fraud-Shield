// content.js — runs inside every web page you visit.
//
// 1. Works out whether this is an email client (Gmail / Outlook) or a normal site.
// 2. Extracts the email text or the page URL and sends it to background.js.
// 3. (Extra) Highlights suspicious links inside an opened email.
//
// Content scripts can't use `import`, so this file is self-contained.

(() => {
  // ---------------------------------------------------------------
  // 1. Selectors for each email client. Gmail/Outlook change their
  //    HTML now and then — if scanning stops working, fix it HERE.
  // ---------------------------------------------------------------
  const EMAIL_SITES = [
    {
      name: "Gmail",
      match: (h) => h === "mail.google.com",
      body: ["div.a3s.aiL", "div.a3s"],
      subject: ["h2.hP", "h2[data-thread-perm-id]"],
      sender: ["span.gD[email]", "span.go"]
    },
    {
      name: "Outlook",
      match: (h) => h === "outlook.live.com" || h === "outlook.office.com" || h === "outlook.office365.com",
      body: ['div[aria-label="Message body"]', "div#UniqueMessageBody", 'div[role="document"]'],
      subject: ['div[role="heading"][aria-level="2"]', "span.JdFsz"],
      sender: ["span.OZZZK", 'span[data-testid="SenderName"]']
    }
  ];

  const MAX_TEXT = 5000;
  const site = EMAIL_SITES.find((s) => s.match(location.hostname)) || null;

  const firstMatch = (selectors, all = false) => {
    for (const sel of selectors) {
      const found = all ? [...document.querySelectorAll(sel)] : document.querySelector(sel);
      if (all ? found.length : found) return found;
    }
    return all ? [] : null;
  };

  // ---------------------------------------------------------------
  // 2. Extraction
  // ---------------------------------------------------------------
  function extractEmail() {
    const bodies = firstMatch(site.body, true).filter((el) => el.innerText.trim());
    if (!bodies.length) return null;
    const bodyEl = bodies[bodies.length - 1];      // newest message in a thread
    const subject = firstMatch(site.subject)?.innerText.trim() || "";
    const senderEl = firstMatch(site.sender);
    const sender = senderEl?.getAttribute("email") || senderEl?.innerText.trim() || "";

    const text = `Subject: ${subject}\nFrom: ${sender}\n\n${bodyEl.innerText.trim()}`.slice(0, MAX_TEXT);
    return { kind: "email", content: text, title: subject || "(no subject)", url: location.href, bodyEl };
  }

  function extractPage() {
    return { kind: "url", content: location.href, title: document.title, url: location.href };
  }

  // ---------------------------------------------------------------
  // 3. Scan + send to background (deduplicated)
  // ---------------------------------------------------------------
  let lastSignature = "";
  let timer = null;

  async function scan(force = false) {
    const data = site ? extractEmail() : extractPage();

    if (!data) {                                    // no email open right now
      if (lastSignature !== "none") {
        lastSignature = "none";
        globalThis.FSShield?.hide();
        chrome.runtime.sendMessage({ type: "NO_CONTENT" }).catch(() => {});
      }
      return;
    }

    const sig = data.kind + "|" + data.content.length + "|" + data.content.slice(0, 200);
    if (!force && sig === lastSignature) return;    // nothing changed
    lastSignature = sig;

    const { bodyEl, ...message } = data;
    globalThis.FSShield?.scanning();                // spinning ring
    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: "SCAN_PAGE", ...message });
    } catch (e) {
      return;                                       // extension reloaded; ignore
    }
    if (result) globalThis.FSShield?.show(result);  // tick / warning / danger animation
    if (bodyEl) highlightLinks(bodyEl);
  }

  const scheduleScan = () => {
    clearTimeout(timer);
    timer = setTimeout(() => scan(), 900);          // wait for the page to settle
  };

  // Gmail/Outlook are single-page apps: watch for DOM changes.
  new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  scan();

  // Popup "Rescan" button
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "RESCAN") scan(true);
  });

  // ---------------------------------------------------------------
  // 4. Extra: highlight suspicious links inside an email
  // ---------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    a[data-fs="mismatch"], a[data-fs="fraud"] { outline: 2px solid #c8321f !important; outline-offset: 2px; background: #c8321f1a !important; }
    a[data-fs="suspicious"] { outline: 2px dashed #b97b00 !important; outline-offset: 2px; background: #b97b001a !important; }
    a[data-fs="mismatch"], a[data-fs="fraud"], a[data-fs="suspicious"] { animation: fs-pop .6s ease 1; }
    @keyframes fs-pop { 0% { outline-offset: 12px; outline-color: transparent; } 100% { outline-offset: 2px; } }
    @media (prefers-reduced-motion: reduce) { a[data-fs] { animation: none !important; } }
  `;
  document.documentElement.appendChild(style);

  // Gmail/Outlook sometimes wrap the real link — unwrap it.
  function realHref(a) {
    try {
      const u = new URL(a.href);
      if (u.hostname.endsWith("google.com") && u.pathname === "/url") return u.searchParams.get("q") || a.href;
      if (u.hostname.endsWith("safelinks.protection.outlook.com")) return u.searchParams.get("url") || a.href;
      return a.href;
    } catch { return a.href; }
  }

  const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
  function baseDomain(host) {                       // "mail.paypal.com" -> "paypal.com"
    const p = host.toLowerCase().replace(/^www\./, "").split(".");
    if (p.length <= 2) return p.join(".");
    const take = SECOND_LEVEL.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
    return p.slice(-take).join(".");
  }

  // Cheap rules that need no ML.
  function localProblem(a, href) {
    let host;
    try { host = new URL(href).hostname; } catch { return null; }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "Link goes to a raw IP address";
    if (host.includes("xn--")) return "Link uses look-alike (punycode) characters";
    const shown = a.innerText.trim();
    const m = shown.match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
    if (m && baseDomain(m[1]) !== baseDomain(host)) {
      return `Link says "${m[1]}" but really goes to ${host}`;
    }
    return null;
  }

  async function highlightLinks(root) {
    const anchors = [...root.querySelectorAll("a[href]")].filter((a) => !a.dataset.fs);
    const toAsk = [];
    for (const a of anchors) {
      const href = realHref(a);
      if (!/^https?:/i.test(href)) continue;
      const problem = localProblem(a, href);
      if (problem) {
        a.dataset.fs = "mismatch";
        a.title = "FraudShield: " + problem;
      } else {
        toAsk.push([a, href]);
      }
    }
    if (!toAsk.length) return;

    let results = {};
    try {
      const res = await chrome.runtime.sendMessage({ type: "CHECK_LINKS", urls: toAsk.map(([, h]) => h) });
      results = res?.results || {};
    } catch { return; }

    for (const [a, href] of toAsk) {
      const r = results[href];
      if (r && (r.verdict === "fraud" || r.verdict === "suspicious")) {
        a.dataset.fs = r.verdict;
        a.title = `FraudShield: model says ${r.verdict} (${Math.round(r.confidence * 100)}%)`;
      } else {
        a.dataset.fs = "ok";
      }
    }
  }
})();

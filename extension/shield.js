// shield.js — the floating protection shield shown on every page.
//
// States:  scanning (spinning ring) -> safe (green tick draws itself, then shrinks)
//                                   -> suspicious (amber, shakes, shows a warning card)
//                                   -> fraud (red, pulses, card + full-page warning)
//
// It lives in a Shadow DOM so the website's own CSS can't break it.
// content.js calls:  FSShield.scanning()  /  FSShield.show(result)  /  FSShield.hide()

(() => {
  if (globalThis.FSShield) return;

  // Only pages scanned as URLs this sure of fraud get the full-page warning.
  const FULLPAGE_THRESHOLD = 0.85;

  const TEXT = {
    url: {
      safe:       ["Looks safe", "We didn't find signs of fraud on this page."],
      suspicious: ["Be careful", "This page looks unusual. Don't enter passwords or payment details unless you're sure it's genuine."],
      fraud:      ["Likely fraud", "This page matches known phishing patterns. Don't enter any information here."],
      unknown:    ["Not sure", "FraudShield couldn't decide about this page."],
      error:      ["Offline", "FraudShield can't reach its server, so this page wasn't checked."]
    },
    email: {
      safe:       ["Email looks safe", "No signs of phishing found in this email."],
      suspicious: ["Be careful", "This email has warning signs. Check the sender before you click or reply."],
      fraud:      ["Likely phishing", "This email looks like phishing. Don't click its links or reply."],
      unknown:    ["Not sure", "FraudShield couldn't decide about this email."],
      error:      ["Offline", "FraudShield can't reach its server, so this email wasn't checked."]
    }
  };

  const CSS = `
    :host { all: initial; }
    .wrap { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
            font: 14px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; color: #15222c; --c: #6b7a86; }
    .wrap[data-state="safe"]       { --c: #1f8a5b; }
    .wrap[data-state="suspicious"] { --c: #b97b00; }
    .wrap[data-state="fraud"]      { --c: #c8321f; }

    .badge { position: relative; width: 52px; height: 52px; padding: 0; border: 0; border-radius: 50%;
             background: #fff; cursor: pointer; display: grid; place-items: center;
             box-shadow: 0 4px 18px rgba(0,0,0,.22); transition: transform .25s ease, opacity .25s ease; }
    .badge:focus-visible { outline: 3px solid #2a6df4; outline-offset: 3px; }
    .badge.mini { transform: scale(.62); opacity: .7; }
    .badge.mini:hover, .badge.mini:focus-visible { transform: scale(1); opacity: 1; }
    .badge svg.icon { width: 34px; height: 34px; }

    .shape { fill: color-mix(in srgb, var(--c) 14%, white); stroke: var(--c); stroke-width: 2.2; stroke-linejoin: round; }
    .mark  { fill: none; stroke: var(--c); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; display: none; }
    .wrap[data-state="safe"]       .m-safe,
    .wrap[data-state="suspicious"] .m-warn,
    .wrap[data-state="fraud"]      .m-warn,
    .wrap[data-state="unknown"]    .m-unknown { display: block; }
    .m-safe { stroke-dasharray: 1; stroke-dashoffset: 1; }
    .wrap[data-state="safe"] .m-safe { animation: draw .5s .1s ease forwards; }

    svg.ring { position: absolute; inset: -5px; width: calc(100% + 10px); height: calc(100% + 10px);
               fill: none; stroke: var(--c); stroke-width: 2.6; stroke-linecap: round; opacity: 0; }
    .wrap[data-state="scanning"] svg.ring { opacity: 1; animation: spin 1s linear infinite; }

    .wrap[data-state="suspicious"] .badge:not(.mini) { animation: shake .6s ease 2; }
    .wrap[data-state="fraud"] .badge { animation: pulse 1.6s ease-out infinite; }

    .card { position: absolute; right: 0; bottom: 66px; width: 290px; padding: 14px 16px; background: #fff;
            border-left: 5px solid var(--c); border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.25);
            opacity: 0; transform: translateY(8px); pointer-events: none; transition: opacity .2s ease, transform .2s ease; }
    .card.open { opacity: 1; transform: none; pointer-events: auto; }
    .card h3 { margin: 0 0 4px; font-size: 16px; color: var(--c); }
    .card p { margin: 0 0 8px; }
    .card .conf { font-size: 12px; color: #5d6c77; }
    .card .actions { display: flex; gap: 8px; margin-top: 10px; }
    button.btn { flex: 1; padding: 7px 8px; font: inherit; font-weight: 600; border-radius: 4px; cursor: pointer;
                 border: 1px solid #d9e0e5; background: #fff; color: #15222c; }
    button.btn.primary { background: var(--c); border-color: var(--c); color: #fff; }
    button.btn:focus-visible { outline: 2px solid #2a6df4; outline-offset: 2px; }

    .overlay { position: fixed; inset: 0; z-index: 2147483647; display: none; place-items: center; text-align: center;
               background: #7a1a0f; color: #fff; padding: 24px;
               font: 14px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif; }
    .overlay.open { display: grid; animation: fade .3s ease; }
    .overlay .box { max-width: 520px; }
    .overlay svg { width: 96px; height: 96px; margin-bottom: 8px; }
    .overlay svg .shape { fill: #ffffff22; stroke: #fff; }
    .overlay svg .mark  { display: block; stroke: #fff; }
    .overlay h1 { margin: 0 0 8px; font-size: 28px; }
    .overlay p { margin: 0 0 18px; font-size: 16px; }
    .overlay .host { font-family: ui-monospace, Consolas, monospace; background: #00000033; padding: 2px 8px; border-radius: 4px; }
    .overlay button.btn { flex: none; padding: 12px 24px; font-size: 16px; background: #fff; color: #7a1a0f; border-color: #fff; }
    .overlay .proceed { display: block; margin: 16px auto 0; background: none; border: 0; color: #ffd9d3;
                        text-decoration: underline; cursor: pointer; font: inherit; font-size: 13px; }

    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

    @keyframes spin  { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes draw  { to { stroke-dashoffset: 0; } }
    @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-5px); }
                       40% { transform: translateX(5px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
    @keyframes pulse { 0% { box-shadow: 0 4px 18px rgba(0,0,0,.22), 0 0 0 0 rgba(200,50,31,.6); }
                       100% { box-shadow: 0 4px 18px rgba(0,0,0,.22), 0 0 0 18px rgba(200,50,31,0); } }
    @keyframes fade  { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  const SHIELD_SVG = `
    <svg class="icon" viewBox="0 0 32 32" aria-hidden="true">
      <path class="shape" d="M16 3l11 4v8c0 7-4.6 12.2-11 14C9.6 27.2 5 22 5 15V7z"/>
      <path class="mark m-safe" pathLength="1" d="M11 16l4 4 6-7.5"/>
      <path class="mark m-warn" d="M16 10v7M16 21.5v.5"/>
      <path class="mark m-unknown" d="M13 12.5a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.1-1.5 2.4M16 21.5v.5"/>
    </svg>`;

  let host, wrap, badge, card, overlay, live;
  let showBadge = true, proceeded = false, miniTimer = null, closeTimer = null;
  try { proceeded = sessionStorage.getItem("fs-proceed:" + location.hostname) === "1"; } catch {}

  // User setting from the popup ("Show floating shield")
  const ready = chrome.storage.sync.get({ showShield: true }).then((s) => { showBadge = s.showShield; }).catch(() => {});
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === "sync" && ch.showShield) {
      showBadge = ch.showShield.newValue;
      if (host) host.style.display = showBadge || wrap.dataset.state === "fraud" ? "" : "none";
    }
  });

  function build() {
    if (host) return;
    host = document.createElement("div");
    host.id = "fraudshield-root";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap" data-state="scanning">
        <div class="card" role="dialog" aria-label="FraudShield result">
          <h3></h3><p class="msg"></p><p class="conf"></p>
          <div class="actions">
            <button class="btn primary leave" hidden>Leave this page</button>
            <button class="btn dismiss">Got it</button>
          </div>
        </div>
        <button class="badge" aria-label="FraudShield">
          <svg class="ring" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="28" stroke-dasharray="50 126"/></svg>
          ${SHIELD_SVG}
        </button>
        <div class="sr" aria-live="polite"></div>
      </div>
      <div class="overlay" role="alertdialog" aria-modal="true" aria-label="Dangerous page warning">
        <div class="box">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path class="shape" d="M16 3l11 4v8c0 7-4.6 12.2-11 14C9.6 27.2 5 22 5 15V7z"/><path class="mark" d="M16 10v7M16 21.5v.5"/></svg>
          <h1>This looks like a phishing site</h1>
          <p class="ovmsg"></p>
          <button class="btn goback">Go back to safety</button>
          <button class="proceed">Proceed anyway (not recommended)</button>
        </div>
      </div>`;
    wrap = root.querySelector(".wrap");
    badge = root.querySelector(".badge");
    card = root.querySelector(".card");
    overlay = root.querySelector(".overlay");
    live = root.querySelector(".sr");

    badge.addEventListener("click", () => card.classList.toggle("open"));
    root.querySelector(".dismiss").addEventListener("click", () => { card.classList.remove("open"); badge.classList.add("mini"); });
    const leave = () => { if (history.length > 1) history.back(); else location.replace("about:blank"); };
    root.querySelector(".leave").addEventListener("click", leave);
    root.querySelector(".goback").addEventListener("click", leave);
    root.querySelector(".proceed").addEventListener("click", () => {
      proceeded = true;
      try { sessionStorage.setItem("fs-proceed:" + location.hostname, "1"); } catch {}
      overlay.classList.remove("open");
    });
    document.documentElement.appendChild(host);
    host._root = root;
  }

  function clearTimers() { clearTimeout(miniTimer); clearTimeout(closeTimer); }

  function scanning() {
    build(); clearTimers();
    wrap.dataset.state = "scanning";
    badge.classList.remove("mini");
    card.classList.remove("open");
    host.style.display = showBadge ? "" : "none";
    live.textContent = "FraudShield is checking this page.";
    badge.setAttribute("aria-label", "FraudShield is checking this page");
  }

  async function show(res) {
    await ready;
    build(); clearTimers();
    const kind = res.kind === "email" ? "email" : "url";
    const state = ["safe", "suspicious", "fraud"].includes(res.verdict) ? res.verdict : (res.verdict === "error" ? "error" : "unknown");
    const [title, msg] = TEXT[kind][state];

    wrap.dataset.state = state === "error" ? "unknown" : state;
    badge.classList.remove("mini");
    host.style.display = showBadge || state === "fraud" ? "" : "none";

    const root = host._root;
    root.querySelector(".card h3").textContent = title;
    root.querySelector(".card .msg").textContent = msg;
    root.querySelector(".card .conf").textContent =
      res.confidence && state !== "error" ? `${Math.round(res.confidence * 100)}% confidence` : "";
    root.querySelector(".leave").hidden = !(state === "fraud" && kind === "url");
    live.textContent = `FraudShield: ${title}. ${msg}`;
    badge.setAttribute("aria-label", `FraudShield: ${title}`);

    if (state === "safe" || state === "unknown" || state === "error") {
      card.classList.remove("open");
      miniTimer = setTimeout(() => badge.classList.add("mini"), state === "safe" ? 2800 : 1500);
    } else if (state === "suspicious") {
      card.classList.add("open");
      closeTimer = setTimeout(() => card.classList.remove("open"), 9000);
    } else {                                                  // fraud
      card.classList.add("open");
      if (kind === "url" && res.confidence >= FULLPAGE_THRESHOLD && !proceeded) {
        root.querySelector(".ovmsg").innerHTML = "";
        const p = root.querySelector(".ovmsg");
        p.append("FraudShield is ", String(Math.round(res.confidence * 100)), "% sure that ");
        const h = document.createElement("span"); h.className = "host"; h.textContent = location.hostname;
        p.append(h, " is trying to steal your information.");
        card.classList.remove("open");
        card.classList.remove("open");
        overlay.classList.add("open");
        root.querySelector(".goback").focus();
      }
    }
  }

  function hide() { if (host) host.style.display = "none"; }

  globalThis.FSShield = { scanning, show, hide };
})();

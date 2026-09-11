// content.js — runs inside every webpage you visit
//
// Step 1 (today): just confirm the extension is loaded on the page.
// Step 7 (later): this will extract the page's visible text and URL,
// figure out whether you're looking at an email client (Gmail, Outlook)
// or a regular website, and send that data to background.js.

console.log("FraudShield content script loaded on:", window.location.hostname);

// TODO (Step 7): extract page text / email body from the DOM
// TODO (Step 7): send extracted data to background.js via
//                chrome.runtime.sendMessage({ type: "SCAN_PAGE", ... })

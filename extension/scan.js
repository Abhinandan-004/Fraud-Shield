// scan.js — screen scan (Step 8).
//
// 1. chrome.desktopCapture asks the user to pick a screen/window/tab.
// 2. We grab ONE frame, then stop sharing immediately.
// 3. Tesseract.js (bundled in /vendor) reads the text from the frame.
// 4. The text goes to the same prediction API as normal emails.

import { VERDICTS } from "./config.js";
import { predictEmail, predictUrls } from "./api.js";

const $ = (id) => document.getElementById(id);
const status = (t) => { $("status").textContent = t; };

let worker = null;

function pickSource() {
  return new Promise((resolve) => {
    chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], (streamId) => resolve(streamId));
  });
}

async function grabFrame(streamId) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: streamId } }
  });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 350));          // let the first real frame arrive

    // Upscale small captures and make text higher-contrast: helps OCR a lot.
    const scale = video.videoWidth < 1600 ? 2 : 1;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(1) contrast(1.35)";
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    stream.getTracks().forEach((t) => t.stop());           // stop sharing right away
  }
}

async function getWorker() {
  if (worker) return worker;
  const base = chrome.runtime.getURL("vendor");
  worker = await Tesseract.createWorker("eng", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,                       // folder holding tesseract-core-*.wasm.js
    langPath: `${base}/lang`,             // folder holding eng.traineddata.gz
    workerBlobURL: false,                 // required: extension CSP blocks blob workers
    cacheMethod: "none",
    logger: (m) => {
      if (m.status === "recognizing text") status(`Reading text… ${Math.round(m.progress * 100)}%`);
    }
  });
  return worker;
}

function showResult(r, links) {
  const v = VERDICTS[r.verdict] || VERDICTS.unknown;
  const box = $("result");
  box.style.display = "block";
  box.dataset.state = r.verdict;
  $("verdictWord").textContent = v.label;
  $("confidence").textContent = r.confidence ? `${Math.round(r.confidence * 100)}% confidence` : (r.note || "");
  const ul = $("links");
  ul.innerHTML = "";
  for (const [url, lr] of Object.entries(links)) {
    const li = document.createElement("li");
    li.textContent = `${url} — ${(VERDICTS[lr.verdict] || VERDICTS.unknown).label}`;
    ul.append(li);
  }
}

async function analyze(text) {
  if (text.trim().length < 20) {
    status("Couldn't read enough text from that capture. Try a different window, or zoom in.");
    return;
  }
  status("Checking…");
  try {
    const urls = text.match(/https?:\/\/[^\s)>"']+/gi) || [];
    const [r, links] = await Promise.all([
      predictEmail(text),
      predictUrls(urls).catch(() => ({}))
    ]);
    showResult(r, links);
    status("");
  } catch {
    status("Can't reach the FraudShield server. Is it running?");
  }
}

$("pickBtn").addEventListener("click", async () => {
  $("pickBtn").disabled = true;
  try {
    const streamId = await pickSource();
    if (!streamId) { status("Cancelled."); return; }
    status("Capturing…");
    const canvas = await grabFrame(streamId);
    $("preview").src = canvas.toDataURL("image/png");
    $("preview").style.display = "block";

    status("Loading text reader…");
    const w = await getWorker();
    const { data } = await w.recognize(canvas);
    $("textPanel").hidden = false;
    $("ocrText").value = data.text.trim();
    await analyze(data.text);
  } catch (e) {
    console.error(e);
    status("Something went wrong: " + e.message);
  } finally {
    $("pickBtn").disabled = false;
  }
});

$("recheckBtn").addEventListener("click", () => analyze($("ocrText").value));

// AI chat widget — a small floating launcher + panel injected into the page.
//
// It POSTs { question } to the same-origin /api/chat proxy and renders the
// plain-text { answer }. All real guardrails live in the Cloud Function
// (grounding, the banned-term output filter, per-IP rate limiting) — this file
// is only the UI.
//
// App Check is OPTIONAL: set RECAPTCHA_V3_SITE_KEY + FIREBASE_CONFIG below to
// attach a Firebase App Check token to each request; leave the placeholders and
// the widget still works, just without a token.

const ENDPOINT = "/api/chat";
const MAX_LEN = 1000; // mirrors CHAT_MAX_QUESTION_LEN on the server

const GREETING =
  "Hi! I'm the Acme Cloud assistant. Ask me about the product, pricing, or getting started.";
// Clickable starter questions shown once in the fresh chat window.
const SUGGESTIONS = [
  "What is Acme Cloud?",
  "How much does it cost?",
  "Do you offer a free trial?",
  "How do I get support?",
];

const ERR_GENERIC =
  "Something went wrong on my end. Please try again, or use the contact form below.";
const ERR_RATE =
  "That's a lot of questions in a short time — please wait a minute, then try again.";

// --- optional Firebase App Check -------------------------------------------
const RECAPTCHA_V3_SITE_KEY = "REPLACE_WITH_YOUR_RECAPTCHA_V3_SITE_KEY";
const FIREBASE_CONFIG = {
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "REPLACE_ME",
};

let _appCheckPromise = null;
function getAppCheck() {
  if (_appCheckPromise) return _appCheckPromise;
  const isLocal = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);
  if (isLocal || !RECAPTCHA_V3_SITE_KEY || RECAPTCHA_V3_SITE_KEY.startsWith("REPLACE")) {
    _appCheckPromise = Promise.resolve(null);
    return _appCheckPromise;
  }
  _appCheckPromise = (async () => {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
    const { initializeAppCheck, ReCaptchaV3Provider } = await import(
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js"
    );
    const app = initializeApp(FIREBASE_CONFIG);
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  })().catch((err) => {
    console.warn("App Check init failed:", err);
    return null;
  });
  return _appCheckPromise;
}

// Best-effort App Check header — never blocks a send on the client side.
async function appCheckHeader() {
  const ac = await getAppCheck();
  if (!ac) return {};
  try {
    const { getToken } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js");
    const { token } = await getToken(ac, false);
    return { "X-Firebase-AppCheck": token };
  } catch {
    return {};
  }
}

// --- scaffold ---------------------------------------------------------------
// Author-controlled markup only (no user data), so innerHTML is safe here.
// Visitor questions and model answers are always inserted with textContent.
const root = document.createElement("div");
root.className = "aichat";
root.innerHTML = `
  <button class="aichat__launcher" type="button" aria-label="Open chat" aria-expanded="false">
    <svg class="aichat__bot" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="13" r="9.3"/>
        <path d="M11 10V8.3"/>
        <rect x="5.7" y="10" width="10.6" height="7.8" rx="2.2"/>
        <path d="M5.7 14H4.5M16.3 14h1.2"/>
        <path d="M15.8 2.4h5a1.4 1.4 0 0 1 1.4 1.4v2.3a1.4 1.4 0 0 1-1.4 1.4h-2.9l-2.2 1.7V7.5a1.4 1.4 0 0 1-1.3-1.4V3.8a1.4 1.4 0 0 1 1.4-1.4z"/>
      </g>
      <circle cx="11" cy="7.7" r="0.95" fill="currentColor"/>
      <circle cx="8.7" cy="13.9" r="1.25" fill="currentColor"/>
      <circle cx="13.3" cy="13.9" r="1.25" fill="currentColor"/>
      <circle cx="17.1" cy="5" r="0.7" fill="currentColor"/>
      <circle cx="19.3" cy="5" r="0.7" fill="currentColor"/>
    </svg>
  </button>
  <section class="aichat__panel" role="dialog" aria-label="Chat with the assistant" aria-hidden="true">
    <header class="aichat__head">
      <div class="aichat__title"><span class="aichat__dot" aria-hidden="true"></span>Ask Acme</div>
      <button class="aichat__close" type="button" aria-label="Close chat">&times;</button>
    </header>
    <div class="aichat__log" aria-live="polite"></div>
    <p class="aichat__note">AI assistant — answers may be imperfect. For anything important, use the <a href="#contact">contact form</a>.</p>
    <form class="aichat__form" novalidate>
      <input class="aichat__input" type="text" autocomplete="off" autocapitalize="sentences" autocorrect="on" enterkeyhint="send" maxlength="1000" placeholder="Ask a question…" aria-label="Your question">
      <button class="aichat__send" type="submit" aria-label="Send">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.2L4 11l9 1-9 1-1.99 6.2a1 1 0 0 0 1.39 1.2z"/></svg>
      </button>
    </form>
  </section>
`;
document.body.appendChild(root);

const launcher = root.querySelector(".aichat__launcher");
const panel = root.querySelector(".aichat__panel");
const closeBtn = root.querySelector(".aichat__close");
const log = root.querySelector(".aichat__log");
const form = root.querySelector(".aichat__form");
const input = root.querySelector(".aichat__input");
const sendBtn = root.querySelector(".aichat__send");

let greeted = false;
let pending = false;

// --- open / close -----------------------------------------------------------

function openPanel() {
  root.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  launcher.setAttribute("aria-expanded", "true");
  syncViewport();
  if (!greeted) {
    addMessage("bot", GREETING);
    addSuggestions();
    greeted = true;
  }
  if (!isPhone()) setTimeout(() => input.focus(), 60);
}

function closePanel() {
  root.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  launcher.setAttribute("aria-expanded", "false");
  launcher.focus();
}

launcher.addEventListener("click", () =>
  root.classList.contains("is-open") ? closePanel() : openPanel()
);
closeBtn.addEventListener("click", closePanel);
// Any element on the page marked data-aichat-open opens the panel.
document.querySelectorAll("[data-aichat-open]").forEach((el) =>
  el.addEventListener("click", (e) => {
    e.preventDefault();
    openPanel();
  })
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && root.classList.contains("is-open")) closePanel();
});

// --- mobile viewport / keyboard fitting -------------------------------------
// On phones the panel is a bottom sheet pinned to the *visual* viewport. The
// visualViewport API reports how much the on-screen keyboard covers, so the
// input never hides behind it. We publish two CSS vars the stylesheet consumes.
const vv = window.visualViewport;
const isPhone = () => window.matchMedia("(max-width: 480px)").matches;
function syncViewport() {
  if (!vv) return;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  root.style.setProperty("--aichat-kb", kb + "px");
  root.style.setProperty("--aichat-vh", vv.height + "px");
}
if (vv) {
  vv.addEventListener("resize", syncViewport);
  vv.addEventListener("scroll", syncViewport);
}
// Tapping the contact link should dismiss the panel so the form is visible.
log.parentElement
  .querySelector(".aichat__note a")
  .addEventListener("click", closePanel);

// --- messages ---------------------------------------------------------------

function addMessage(who, text) {
  const el = document.createElement("div");
  el.className = `aichat__msg aichat__msg--${who}`;
  el.textContent = text; // textContent → never interprets HTML
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

// Suggested starter questions — author-controlled text, rendered as chips that
// submit the question on click. Removed as soon as any question is asked.
function addSuggestions() {
  if (!SUGGESTIONS.length) return;
  const box = document.createElement("div");
  box.className = "aichat__suggest";
  const label = document.createElement("div");
  label.className = "aichat__suggest-label";
  label.textContent = "Try asking";
  box.appendChild(label);
  SUGGESTIONS.forEach((q) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "aichat__chip";
    chip.textContent = q;
    chip.addEventListener("click", () => submitQuestion(q));
    box.appendChild(chip);
  });
  log.appendChild(box);
  log.scrollTop = log.scrollHeight;
}

function clearSuggestions() {
  const box = log.querySelector(".aichat__suggest");
  if (box) box.remove();
}

function addTyping() {
  const el = document.createElement("div");
  el.className = "aichat__msg aichat__msg--bot aichat__typing";
  el.innerHTML = "<span></span><span></span><span></span>";
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function setBusy(busy) {
  pending = busy;
  input.disabled = busy;
  sendBtn.disabled = busy;
}

// --- ask --------------------------------------------------------------------

async function ask(question) {
  setBusy(true);
  const typing = addTyping();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await appCheckHeader()) },
      body: JSON.stringify({ question }),
    });
    typing.remove();

    if (res.status === 429) {
      addMessage("bot", ERR_RATE);
      return;
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON / empty body */
    }
    const answer =
      data && typeof data.answer === "string" ? data.answer.trim() : "";

    // The function returns a friendly { answer } even on a 502 upstream error,
    // so prefer any answer it gave us; otherwise show the generic fallback.
    addMessage("bot", answer || ERR_GENERIC);
  } catch {
    typing.remove();
    addMessage("bot", ERR_GENERIC);
  } finally {
    setBusy(false);
    input.focus();
  }
}

// Single entry point for asking — used by both the form and the suggestion chips.
function submitQuestion(raw) {
  if (pending) return;
  const q = (raw || "").trim().slice(0, MAX_LEN);
  if (!q) return;
  clearSuggestions();
  addMessage("user", q);
  input.value = "";
  ask(q);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  submitQuestion(input.value);
});

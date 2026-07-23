# AI Chat Widget (Grounded, Firebase + Claude)

A small, embeddable AI chat widget for any website — a floating launcher + panel
that answers visitor questions **grounded only in a knowledge base you control**.
It is built to be cheap, hard to jailbreak, and honest about what it doesn't know.

Backend is a single **Firebase Cloud Function** that proxies to **Anthropic
Claude**; the API key never touches the browser. The frontend is one dependency-free
ES module you drop into a page.

> This is a genericized, reusable template extracted from a live site. It ships
> with a fictional **"Acme Cloud"** knowledge base — replace the files in
> `functions/knowledge/` with your own.

---

## Why it's more than "call an LLM"

Three layers keep it cheap and on-message, and **two of them don't depend on the
model behaving**:

1. **FAQ layer (free, instant).** Predictable questions (pricing, support, "are
   you a bot?") are answered from a hand-written list **before** any model call —
   zero tokens, zero latency, no hallucination.
2. **Grounded model call.** For everything else, the function context-stuffs your
   `knowledge/*.md` as the *only* source of truth and instructs Claude to answer
   solely from it (or say it doesn't know). The stable source block carries
   **prompt caching**, so bursts of questions bill ~0.1x on the shared prefix.
3. **Deterministic output filter (`safeAnswer`).** Runs *after* the model and
   blocks specific strings (internal codenames, phone numbers, a retired email)
   no matter what the model emits — so no prompt injection can leak them. These
   banned strings live **only** server-side, never in a public file.

Plus the usual hardening: **App Check** (optional, reCAPTCHA v3), **per-IP rate
limiting** (Firestore fixed-window), origin checks, and a length cap on questions.

---

## How it works

```
Browser (public/js/chat.js)  ──POST {question}──▶  /api/chat  (Cloud Function)
                                                     │
                                   CORS + origin + App Check + per-IP rate limit
                                                     │
                                       faqLookup(question) ── hit ──▶ canned answer (no model call)
                                                     │ miss
                                       Claude (grounded on knowledge/*.md,
                                       prompt-cached source block)
                                                     │
                                       safeAnswer()  ── strip Markdown + block banned strings
                                                     │
                                      ◀──────── { answer, source } ─────────
```

The widget renders `answer` as **plain text** (`textContent`), so model Markdown
can't inject HTML; `safeAnswer` also flattens `[label](url)` and `**bold**`.

---

## Project structure

```
.
├── firebase.json            Hosting rewrite (/api/chat → chat function)
├── firestore.rules          Locks the rate-limit collection to server-only
├── .firebaserc              Your Firebase project id (placeholder: your-project)
├── functions/
│   ├── index.js             Entry point — initializes admin + exports `chat`
│   ├── chat.js              The handler: FAQ → grounded Claude → safeAnswer
│   ├── config.js            Model, token caps, rate-limit tunables (env-overridable)
│   ├── util.js              App Check, origin, rate limit, request helpers
│   ├── knowledge/           ← YOUR source of truth (.md files). Demo = Acme Cloud.
│   ├── .env.example         Copy to .env / .env.<project>; key is a Secret (see below)
│   ├── package.json
│   └── test-chat.mjs        Guardrail unit tests (no API key needed)
└── public/
    ├── index.html           Demo page (loads the widget)
    ├── css/chat.css          Self-contained widget styles (all tokens included)
    └── js/chat.js            The widget (launcher + panel; optional App Check)
```

---

## Setup

**Prerequisites:** a Firebase project on the **Blaze** plan, the Firebase CLI
(`npm i -g firebase-tools`), Node 22, and an **Anthropic API key**.

1. **Project**
   - Put your project id in `.firebaserc`.
   - (Optional App Check) paste your Firebase web config + reCAPTCHA v3 site key
     into `public/js/chat.js`. Leave the placeholders to run without App Check.

2. **Anthropic key (as a secret, never in the repo)**
   ```bash
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
   For the local emulator, put it in `functions/.secret.local` instead:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. **Your knowledge base**
   - Replace the files in `functions/knowledge/` with your own `.md` content.
   - Edit `SYSTEM_RULES`, the `FAQ` list, and `BANNED_SUBSTRINGS` in
     `functions/chat.js` to match your brand and rules.

4. **Config**
   - `cp functions/.env.example functions/.env` (or `.env.<project-id>`),
     set `SITE_ORIGIN` / `ALLOWED_ORIGINS`. Keep `APP_CHECK_ENFORCE=false` until
     you've wired App Check.

5. **Deploy**
   ```bash
   cd functions && npm install && cd ..
   firebase deploy
   ```

6. **Embed on your own site**
   ```html
   <link rel="stylesheet" href="css/chat.css">
   <script type="module" src="js/chat.js"></script>
   ```
   Any element with `data-aichat-open` also opens the panel.

---

## Local testing

```bash
cd functions
npm install
npm test          # node test-chat.mjs — guardrail tests, NO API key required
```

The tests cover the two model-independent guardrails: `safeAnswer` (banned
strings, phone shapes, Markdown flattening, no false positives on date ranges)
and `faqLookup`. The grounded model path is exercised against the live API once
deployed.

---

## Configuration reference (`functions/config.js`, env-overridable)

| Constant | Default | Notes |
|---|---|---|
| `CHAT_MODEL` | `claude-haiku-4-5` | Any Anthropic model id. |
| `CHAT_MAX_TOKENS` | `1024` | Caps cost + rambling. |
| `CHAT_MAX_QUESTION_LEN` | `1000` | Server-side cap on the question. |
| `CHAT_RATE_LIMIT_WINDOW_MINUTES` | `10` | Per-IP window. |
| `CHAT_RATE_LIMIT_MAX_PER_IP` | `20` | Requests per window per IP. |
| `SITE_ORIGIN` / `ALLOWED_ORIGINS` | `https://example.com` | Who may call `/api/chat`. |
| `APP_CHECK_ENFORCE` | `false` | `true` = reject missing/invalid App Check tokens. |

### Cost note

Every FAQ hit and every grounded answer that stays within the cached prefix is
cheap; the dominant cost is output tokens. The structured `chat: answered` log
line (with `source: faq|model` and token counts) lets you chart the FAQ-vs-model
split in Cloud Logging.

---

## License

[MIT](LICENSE) © 2026 Avi Kahana

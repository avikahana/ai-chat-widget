<h1 align="center">AI Chat Widget</h1>

<p align="center">
  <strong>Grounded, embeddable AI chat for static websites.</strong>
</p>

<p align="center">
  <kbd>Firebase</kbd>
  <kbd>Claude</kbd>
  <kbd>FAQ-first</kbd>
  <kbd>server-side key</kbd>
  <kbd>grounded answers</kbd>
  <kbd>MIT</kbd>
</p>

<p align="center">
  AI Chat Widget is a reusable website chat template with a dependency-free
  browser widget and a Firebase Cloud Function backend. It answers visitor
  questions from a knowledge base you control, keeps the Anthropic API key out
  of the browser, and uses deterministic guardrails around model output.
</p>

<h2 align="center">Reading Map</h2>

<div align="center">

<table>
  <thead>
    <tr>
      <th>Start Here</th>
      <th>Then Check</th>
      <th>Deep Dive</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="#quick-start">Quick Start</a></td>
      <td><a href="#how-it-works">How It Works</a></td>
      <td><a href="#configuration-reference">Configuration Reference</a></td>
    </tr>
    <tr>
      <td><a href="#what-it-does">What It Does</a></td>
      <td><a href="#safety-model">Safety Model</a></td>
      <td><a href="#local-testing">Local Testing</a></td>
    </tr>
    <tr>
      <td><a href="#why-it-exists">Why It Exists</a></td>
      <td><a href="#project-structure">Project Structure</a></td>
      <td><a href="#license">License</a></td>
    </tr>
  </tbody>
</table>

</div>

<div align="center">

<table>
  <tbody>
    <tr><th>Frontend</th><td>Dependency-free ES module widget</td></tr>
    <tr><th>Backend</th><td>Firebase Cloud Functions</td></tr>
    <tr><th>Model provider</th><td>Anthropic Claude</td></tr>
    <tr><th>Knowledge source</th><td><code>functions/knowledge/*.md</code></td></tr>
    <tr><th>Default demo content</th><td>Fictional Acme Cloud knowledge base</td></tr>
    <tr><th>Client secret exposure</th><td>none</td></tr>
    <tr><th>Default raw HTML rendering</th><td>none, answers render as plain text</td></tr>
    <tr><th>License</th><td>MIT</td></tr>
  </tbody>
</table>

</div>

<h2 align="center">Why It Exists</h2>

<p align="center">
  Many website chat demos are just a browser calling a model. That is expensive,
  easy to jailbreak, and risky because private keys and source material can end
  up in the wrong place. This template keeps the model call server-side, routes
  predictable questions through a free FAQ layer, and grounds the rest on local
  Markdown files.
</p>

<p align="center">
  It is a genericized template extracted from a live site. Replace the demo
  <strong>Acme Cloud</strong> knowledge base in <code>functions/knowledge/</code>
  with your own product, company, or project docs.
</p>

> [!NOTE]
> The widget is designed to answer from controlled source material. When the
> source does not contain an answer, the assistant should say it does not know
> and point the visitor to a contact or support path.

<h2 align="center">What It Does</h2>

<div align="center">

<table>
  <thead>
    <tr>
      <th>Workflow</th>
      <th>File Or Layer</th>
      <th>What You Get</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Embed chat</td>
      <td><code>public/js/chat.js</code>, <code>public/css/chat.css</code></td>
      <td>Floating launcher and panel for a static website</td>
    </tr>
    <tr>
      <td>Handle questions</td>
      <td><code>functions/chat.js</code></td>
      <td>Cloud Function endpoint exposed through <code>/api/chat</code></td>
    </tr>
    <tr>
      <td>Answer common prompts</td>
      <td><code>faqLookup()</code></td>
      <td>Instant, zero-token answers before any model call</td>
    </tr>
    <tr>
      <td>Ground model replies</td>
      <td><code>functions/knowledge/*.md</code></td>
      <td>Claude answers from the controlled Markdown source block</td>
    </tr>
    <tr>
      <td>Filter output</td>
      <td><code>safeAnswer()</code></td>
      <td>Server-side banned-string and phone-number backstop after the model runs</td>
    </tr>
    <tr>
      <td>Reduce abuse</td>
      <td><code>functions/util.js</code>, <code>firestore.rules</code></td>
      <td>Origin checks, optional App Check, per-IP rate limits, and server-only Firestore state</td>
    </tr>
  </tbody>
</table>

</div>

<h2 align="center">Quick Start</h2>

<p align="center"><strong>Prerequisites:</strong> Firebase Blaze plan, Firebase CLI, Node 22, and an Anthropic API key.</p>

<p align="center"><strong>1. Configure the Firebase project</strong></p>

- Put your Firebase project id in `.firebaserc`.
- Optional App Check: add your Firebase web config and reCAPTCHA v3 site key in `public/js/chat.js`.
- Keep placeholders if you want to run without App Check first.

<p align="center"><strong>2. Store the Anthropic key as a Firebase secret</strong></p>

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

For the local emulator, use `functions/.secret.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

<p align="center"><strong>3. Replace the knowledge base</strong></p>

- Replace the demo files in `functions/knowledge/` with your own `.md` files.
- Edit `SYSTEM_RULES`, `FAQ`, and `BANNED_SUBSTRINGS` in `functions/chat.js`.

<p align="center"><strong>4. Configure allowed origins</strong></p>

```bash
cp functions/.env.example functions/.env
```

Set `SITE_ORIGIN` and `ALLOWED_ORIGINS`. Keep `APP_CHECK_ENFORCE=false` until App Check is wired and monitored.

<p align="center"><strong>5. Deploy</strong></p>

```bash
cd functions
npm install
cd ..
firebase deploy
```

<p align="center"><strong>6. Embed on your site</strong></p>

```html
<link rel="stylesheet" href="css/chat.css">
<script type="module" src="js/chat.js"></script>
```

Any element with `data-aichat-open` also opens the panel.

<h2 align="center">How It Works</h2>

```text
Browser widget
  POST /api/chat { question }
      |
      v
Firebase Cloud Function
  1. CORS and origin check
  2. Optional App Check
  3. Per-IP rate limit
  4. Question length and body validation
      |
      +--> FAQ hit: return canned answer with no model call
      |
      +--> FAQ miss: call Claude with SYSTEM_RULES and functions/knowledge/*.md
             |
             v
          safeAnswer()
             |
             v
Browser receives { answer, source }
```

The widget renders answers with `textContent`, not raw HTML. `safeAnswer()` also
flattens common Markdown patterns such as `[label](url)` and `**bold**`.

<h2 align="center">Safety Model</h2>

<div align="center">

<table>
  <thead>
    <tr>
      <th>Area</th>
      <th>Default Posture</th>
      <th>Why It Matters</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>API key</td><td>Stored as a Firebase secret and read server-side</td><td>The browser never receives the Anthropic key</td></tr>
    <tr><td>Grounding</td><td>Claude receives the controlled Markdown source block</td><td>The assistant has a single source of truth</td></tr>
    <tr><td>FAQ layer</td><td>Predictable questions resolve before the model call</td><td>Common answers are fast, free, and deterministic</td></tr>
    <tr><td>Output filter</td><td><code>safeAnswer()</code> runs after the model</td><td>Specific banned strings and phone shapes are blocked even if the model misbehaves</td></tr>
    <tr><td>Rendering</td><td>Plain text output</td><td>Model Markdown cannot inject HTML</td></tr>
    <tr><td>Abuse control</td><td>Origin checks, optional App Check, length caps, and rate limits</td><td>Reduces misuse of the public endpoint</td></tr>
  </tbody>
</table>

</div>

> [!IMPORTANT]
> Prompt instructions are not treated as the only defense. The template also
> uses model-independent checks before and after the Claude call.

<h2 align="center">Project Structure</h2>

```text
.
├── firebase.json            Hosting rewrite: /api/chat to the chat function
├── firestore.rules          Locks rate-limit collection to server-only access
├── .firebaserc              Firebase project id placeholder
├── functions/
│   ├── index.js             Admin initialization and chat export
│   ├── chat.js              FAQ, grounded Claude call, safeAnswer
│   ├── config.js            Model, token cap, question length, rate limits
│   ├── util.js              App Check, origin, rate limit, request helpers
│   ├── knowledge/           Replace these Markdown files with your source of truth
│   ├── .env.example         Local config template
│   ├── package.json
│   └── test-chat.mjs        Guardrail unit tests, no API key required
└── public/
    ├── index.html           Demo page
    ├── css/chat.css         Self-contained widget styles
    └── js/chat.js           Launcher, panel, and optional App Check client
```

<h2 align="center">Local Testing</h2>

```bash
cd functions
npm install
npm test
```

The tests cover the model-independent guardrails: `safeAnswer()` for banned
strings, phone shapes, Markdown flattening, and false-positive handling; and
`faqLookup()` for the FAQ path. Live grounded model behavior is exercised after
deployment.

<h2 align="center">Configuration Reference</h2>

<div align="center">

<table>
  <thead>
    <tr>
      <th>Constant</th>
      <th>Default</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><code>CHAT_MODEL</code></td><td><code>claude-haiku-4-5</code></td><td>Anthropic model id</td></tr>
    <tr><td><code>CHAT_MAX_TOKENS</code></td><td><code>1024</code></td><td>Caps response length and cost</td></tr>
    <tr><td><code>CHAT_MAX_QUESTION_LEN</code></td><td><code>1000</code></td><td>Server-side question length cap</td></tr>
    <tr><td><code>CHAT_RATE_LIMIT_WINDOW_MINUTES</code></td><td><code>10</code></td><td>Per-IP fixed window</td></tr>
    <tr><td><code>CHAT_RATE_LIMIT_MAX_PER_IP</code></td><td><code>20</code></td><td>Requests per IP per window</td></tr>
    <tr><td><code>SITE_ORIGIN</code> / <code>ALLOWED_ORIGINS</code></td><td><code>https://example.com</code></td><td>Allowed callers for <code>/api/chat</code></td></tr>
    <tr><td><code>APP_CHECK_ENFORCE</code></td><td><code>false</code></td><td><code>true</code> rejects missing or invalid App Check tokens</td></tr>
  </tbody>
</table>

</div>

<h2 align="center">Cost And Operations</h2>

<div align="center">

<table>
  <thead>
    <tr>
      <th>Signal</th>
      <th>Where To Look</th>
      <th>What It Tells You</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>FAQ vs model split</td><td><code>chat: answered</code> log line</td><td>How many requests avoided model tokens</td></tr>
    <tr><td>Token usage</td><td>Structured Cloud Logging fields</td><td>Input, output, cache-read, and cache-creation token counts</td></tr>
    <tr><td>Blocked abuse</td><td>Function warning logs</td><td>Origin, App Check, and rate-limit rejections</td></tr>
  </tbody>
</table>

</div>

<p align="center">
  FAQ hits cost no model tokens. Grounded model calls use a stable source block
  with Anthropic prompt caching metadata, so repeated bursts can benefit from
  cached-prefix pricing where supported by the provider.
</p>

<h2 align="center">License</h2>

<p align="center">
  AI Chat Widget is licensed under the MIT License. See <a href="LICENSE">LICENSE</a>.
</p>

// Central config for the AI chat widget functions.
// Override any value via environment variables at deploy time (see .env.example).

export const REGION = process.env.FUNCTIONS_REGION || "us-central1";

// Public site origin + the origins allowed to call /api/chat. Same-origin calls
// via Hosting rewrites send no Origin header and are allowed; this is
// defence-in-depth for cross-origin tries.
export const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://example.com";
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [SITE_ORIGIN];

// App Check: start in monitor mode (log failures, allow), flip to true to enforce.
export const APP_CHECK_ENFORCE = process.env.APP_CHECK_ENFORCE === "true";

export const RATE_LIMIT_COLLECTION = "rate_limits";

// --- AI chat ----------------------------------------------------------------
export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5";
export const CHAT_MAX_TOKENS = 1024; // caps cost and rambling
export const CHAT_MAX_QUESTION_LEN = 1000;

// Per-IP chat rate limit (its own short window).
export const CHAT_RATE_LIMIT_WINDOW_MINUTES = 10;
export const CHAT_RATE_LIMIT_MAX_PER_IP = 20;

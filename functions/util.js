import {
  ALLOWED_ORIGINS,
  APP_CHECK_ENFORCE,
  CHAT_RATE_LIMIT_MAX_PER_IP,
  CHAT_RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_COLLECTION,
} from "./config.js";
import { getAppCheck } from "firebase-admin/app-check";

// ---- request hardening -----------------------------------------------------

// Reject obvious cross-origin abuse. Same-origin calls via Hosting rewrites
// usually send no Origin header at all — those are allowed.
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin / server-to-server
  return ALLOWED_ORIGINS.includes(origin);
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.ip || "unknown";
}

// Verify the Firebase App Check token from the X-Firebase-AppCheck header.
// In monitor mode (APP_CHECK_ENFORCE=false) failures are logged but allowed,
// so you can watch metrics before turning on hard enforcement. App Check is
// optional — with no client site key configured, requests simply carry no token.
export async function appCheckOk(req, logger) {
  const token = req.headers["x-firebase-appcheck"];
  if (!token) {
    if (APP_CHECK_ENFORCE) return false;
    logger?.warn("App Check token missing (monitor mode — allowing)");
    return true;
  }
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch (err) {
    if (APP_CHECK_ENFORCE) return false;
    logger?.warn("App Check verify failed (monitor mode — allowing)", err?.message);
    return true;
  }
}

// ---- rate limiting ---------------------------------------------------------

// Fixed-window counter stored in Firestore, keyed by a stable id. Returns true
// when the request is within budget.
export async function underRateLimit(db, key, max, windowMinutes) {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const windowStart = data?.windowStart?.toMillis?.() ?? 0;
    const fresh = !data || now - windowStart > windowMs;
    const count = fresh ? 0 : data.count || 0;
    if (count >= max) return false;
    tx.set(
      ref,
      {
        count: count + 1,
        windowStart: fresh ? new Date(now) : data.windowStart,
        expiresAt: new Date(now + windowMs), // lets a TTL policy reap stale counters
      },
      { merge: true }
    );
    return true;
  });
}

export async function withinChatRateLimit(db, ip) {
  return underRateLimit(
    db,
    `chat:ip:${ip}`,
    CHAT_RATE_LIMIT_MAX_PER_IP,
    CHAT_RATE_LIMIT_WINDOW_MINUTES
  );
}

// ---- request/response helpers ----------------------------------------------

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck");
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.rawBody?.toString() || "{}");
  } catch {
    return {};
  }
}

// Trim + cap a free-text field; returns "" for non-strings.
export function clean(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

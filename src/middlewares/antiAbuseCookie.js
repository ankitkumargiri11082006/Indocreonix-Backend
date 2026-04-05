import crypto from "crypto";
import { env } from "../config/env.js";

function isValidCookieValue(value) {
  if (!value) return false;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 16 || trimmed.length > 128) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

export function antiAbuseCookie(req, res, next) {
  const existing = req.cookies?.ic_ab;
  if (isValidCookieValue(existing)) {
    req.antiAbuseId = existing.trim();
    return next();
  }

  const antiAbuseId = crypto.randomBytes(16).toString("hex");
  req.antiAbuseId = antiAbuseId;

  // Cross-site frontend -> API calls in production need SameSite=None; Secure.
  const secure = env.nodeEnv === "production";
  const sameSite = secure ? "none" : "lax";

  res.cookie("ic_ab", antiAbuseId, {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 180 * 24 * 60 * 60 * 1000,
  });

  next();
}

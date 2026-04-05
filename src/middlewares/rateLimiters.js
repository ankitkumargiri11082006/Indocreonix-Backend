import rateLimit from "express-rate-limit";

function rateLimitHandler(req, res, _next, options) {
  const resetTime = req.rateLimit?.resetTime
    ? new Date(req.rateLimit.resetTime).getTime()
    : null;

  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
    : undefined;

  res.status(options.statusCode).json({
    error: "RATE_LIMITED",
    message:
      typeof options.message === "string"
        ? options.message
        : "Too many requests, please try again later.",
    retryAfterSeconds,
  });
}

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message,
    handler: rateLimitHandler,
  });
}

export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please slow down.",
});

export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many login attempts. Please try again later.",
});

export const leadCreateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: "Too many submissions. Please try again later.",
});

export const careerApplicationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  message: "Too many applications from this network. Please try again later.",
});

export const onboardingDocsLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  message: "Too many document submissions. Please try again later.",
});

export const portalOtpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: "Too many OTP requests. Please try again later.",
});

export const portalAuthLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Too many authentication requests. Please try again later.",
});

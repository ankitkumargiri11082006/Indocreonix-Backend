import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import leadRoutes from "./routes/leadRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import careerRoutes from "./routes/careerRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import portalRoutes from "./routes/portalRoutes.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";

const app = express();

// Trust the first proxy (Render, Vercel, Nginx, etc) for accurate client IPs in rate limiters
app.set("trust proxy", 1);

const normalizeOrigin = (origin) => origin.replace(/\/+$/, "");

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);

  if (env.corsOrigins.includes(normalizedOrigin)) {
    return true;
  }

  if (env.nodeEnv !== "production") {
    const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
    if (localhostPattern.test(normalizedOrigin)) {
      return true;
    }
  }

  return env.corsOrigins.some((allowedOrigin) => {
    if (!allowedOrigin.includes("*")) {
      return false;
    }

    const escaped = allowedOrigin
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const wildcardRegex = new RegExp(`^${escaped}$`, "i");
    return wildcardRegex.test(normalizedOrigin);
  });
}

app.disable("x-powered-by");
app.set("etag", false);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan("dev", {
    skip: (_req, res) => res.statusCode === 304,
  }),
);

app.use("/api", (_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

app.get("/", (_req, res) => {
  res.json({
    message: "Indocreonix backend is running",
    docs: "/api/health",
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ status: "ok", service: "indocreonix-backend" });
});

app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/dashboard", "/dashboard"], dashboardRoutes);
app.use(["/api/settings", "/settings"], settingsRoutes);
app.use(["/api/media", "/media"], mediaRoutes);
app.use(["/api/users", "/users"], userRoutes);
app.use(["/api/leads", "/leads"], leadRoutes);
app.use(["/api/services", "/services"], serviceRoutes);
app.use(["/api/clients", "/clients"], clientRoutes);
app.use(["/api/projects", "/projects"], projectRoutes);
app.use(["/api/careers", "/careers"], careerRoutes);
app.use(["/api/audit-logs", "/audit-logs"], auditRoutes);
app.use(["/api/orders", "/orders"], orderRoutes);
app.use(["/api/portal", "/portal"], portalRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;

import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorMiddleware.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import { jobRouter, jobsRouter } from "./routes/jobRoutes.js";
import coachRoutes from "./routes/coachRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import latexRoutes from "./routes/latexRoutes.js";
import copilotRoutes from "./routes/copilotRoutes.js";
import knowledgeRoutes from "./routes/knowledgeRoutes.js";

export const app = express();

// Enable trust proxy for Render / Vercel / Cloudflare load balancers
app.set("trust proxy", 1);

const cleanClientUrl = (env.clientUrl || "").replace(/\/+$/, "");
const allowedOrigins = new Set(
  [cleanClientUrl, ...String(env.allowedOrigins || "").split(",")]
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Allow non-browser / server-to-server requests
  const cleanedOrigin = origin.replace(/\/+$/, "");

  if (allowedOrigins.has(cleanedOrigin)) return true;

  // Any localhost port is allowed only outside production.
  if (env.nodeEnv !== "production" && /^http:\/\/localhost:\d+$/i.test(cleanedOrigin)) return true;
  if (env.nodeEnv !== "production" && /^http:\/\/127\.0\.0\.1:\d+$/i.test(cleanedOrigin)) return true;

  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      console.warn(`[CORS] Rejected origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

import rateLimit from "express-rate-limit";

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: "Too many upload attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: "Too many AI engine queries. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

app.use("/api/resumes/upload", uploadLimiter);
app.use("/api/resumes/:resumeId/upload-pdf", uploadLimiter);
app.use("/api/analysis", aiLimiter);
app.use("/api/coach", aiLimiter);
app.use("/api/interviews", aiLimiter);
app.use("/api/copilot", aiLimiter);
app.use("/api/latex/compile", aiLimiter);
app.use("/api/job/fetch", aiLimiter);
app.use("/api/job/upload", uploadLimiter);

// Liveness: answers as soon as the process is up. Use this for the platform's
// health check when a database outage should not recycle a healthy container.
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Career Copilot API is running" });
});

// Readiness: fails while MongoDB is unavailable, so a deploy or a load balancer
// does not send traffic to an instance that cannot serve data.
app.get("/api/health/ready", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const database = states[mongoose.connection.readyState] || "unknown";
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    ready,
    database,
    databaseName: mongoose.connection?.db?.databaseName || null,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/job", jobRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/coach", coachRoutes);
app.use("/api/latex", latexRoutes);
app.use("/api/copilot", copilotRoutes);
app.use("/api/knowledge", knowledgeRoutes);
// TODO: Portfolio API is available; UI integration pending.
app.use("/api/portfolio", portfolioRoutes);

app.use(notFound);
app.use(errorHandler);

import cors from "cors";
import express from "express";
import helmet from "helmet";
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

export const app = express();

const allowedOrigins = new Set([env.clientUrl]);

const isAllowedLocalhost = (origin) => {
  return /^http:\/\/localhost:\d+$/i.test(origin || "");
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isAllowedLocalhost(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
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
  max: 120,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many upload attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Career Copilot API is running" });
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
// TODO: Portfolio API is available; UI integration pending.
app.use("/api/portfolio", portfolioRoutes);

app.use(notFound);
app.use(errorHandler);

import dotenv from "dotenv";

dotenv.config();

const requiredVars = ["MONGODB_URI", "JWT_SECRET", "GEMINI_API_KEY"];
const missingVars = requiredVars.filter((key) => !process.env[key]);

if (missingVars.length) {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

const secondaryVars = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"];
const missingSecondary = secondaryVars.filter((key) => !process.env[key]);

if (missingSecondary.length) {
  console.warn("\x1b[33m%s\x1b[0m", "┌─────────────────────────────────────────────────────────────────┐");
  console.warn("\x1b[33m%s\x1b[0m", "│ ⚠️  WARNING: MISSING SECONDARY ENVIRONMENT VARIABLES             │");
  console.warn("\x1b[33m%s\x1b[0m", "├─────────────────────────────────────────────────────────────────┤");
  missingSecondary.forEach((v) => {
    if (v === "RESEND_FROM_EMAIL") {
      console.warn("\x1b[33m%s\x1b[0m", "│ • RESEND_FROM_EMAIL not set → falling back to onboarding@resend.dev│");
      console.warn("\x1b[31m%s\x1b[0m", "│   ⛔ CRITICAL: resend.dev sender ONLY delivers to account owner.  │");
      console.warn("\x1b[31m%s\x1b[0m", "│   Other users will NOT receive emails until domain is verified.   │");
      console.warn("\x1b[33m%s\x1b[0m", "│   Fix: https://resend.com/domains  then set RESEND_FROM_EMAIL     │");
    } else {
      const padded = v.padEnd(25);
      console.warn("\x1b[33m%s\x1b[0m", `│ • ${padded} will be stubbed gracefully.           │`);
    }
  });
  console.warn("\x1b[33m%s\x1b[0m", "└─────────────────────────────────────────────────────────────────┘");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbUriStandard: process.env.MONGODB_URI_STANDARD || "",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "models/gemini-2.5-flash",
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5180",
  allowedOrigins: process.env.ALLOWED_ORIGINS || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "",
  // Off by default: the shared Resend sandbox sender cannot deliver to other
  // people, so enforcing verification before a domain is verified locks users out.
  requireEmailVerification: String(process.env.REQUIRE_EMAIL_VERIFICATION || "false").toLowerCase() === "true",
  atsWeights: process.env.ATS_WEIGHTS_JSON || "",
  latexCompileUrl: process.env.LATEX_COMPILE_URL || "",
  latexCompileToken: process.env.LATEX_COMPILE_TOKEN || "",
  latexBin: process.env.LATEX_BIN || "",
  latexAllowLocal: String(process.env.LATEX_ALLOW_LOCAL || "false").toLowerCase() === "true",
  latexTimeoutMs: Number(process.env.LATEX_TIMEOUT_MS || 45000),
  latexMaxSourceBytes: Number(process.env.LATEX_MAX_SOURCE_BYTES || 200000),
  latexMaxOutputBytes: Number(process.env.LATEX_MAX_OUTPUT_BYTES || 5 * 1024 * 1024),
  geminiTimeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 45000),
  jobFetchTimeoutMs: Number(process.env.JOB_FETCH_TIMEOUT_MS || 12000),
  // Wall-clock budget for parsing one uploaded PDF/DOCX in its worker thread.
  documentParseTimeoutMs: Number(process.env.DOCUMENT_PARSE_TIMEOUT_MS || 10000)
};

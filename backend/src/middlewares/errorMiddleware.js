import { env } from "../config/env.js";

export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const mapError = (err, res) => {
  if (err?.name === "CastError") {
    return { statusCode: 400, message: `Invalid value for ${err.path || "a field"}.`, code: "INVALID_IDENTIFIER" };
  }

  if (err?.name === "ValidationError" && err.errors) {
    const first = Object.values(err.errors)[0];
    return {
      statusCode: 400,
      message: first?.message || "Validation failed.",
      code: "VALIDATION_ERROR"
    };
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || "field";
    return { statusCode: 409, message: `That ${field} is already in use.`, code: "DUPLICATE_KEY" };
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return { statusCode: 413, message: "The uploaded file is too large.", code: "FILE_TOO_LARGE" };
  }

  // Remaining multer limits (part/field counts, unexpected fields, header size).
  if (typeof err?.code === "string" && err.code.startsWith("LIMIT_")) {
    return { statusCode: 400, message: "That upload is not a valid single-file form.", code: "UPLOAD_REJECTED" };
  }
  if (err?.name === "MulterError") {
    return { statusCode: 400, message: "That upload is not a valid single-file form.", code: "UPLOAD_REJECTED" };
  }

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  return { statusCode, message: err.message || "Server Error", code: err.code };
};

export const errorHandler = (err, req, res, next) => {
  const { statusCode, message, code } = mapError(err, res);

  console.error("[API_ERROR]", {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    code,
    message
  });

  const payload = {
    success: false,
    message,
    code: code || undefined
  };

  // Structured details are only exposed for caller-facing failures.
  if (Array.isArray(err.errors)) payload.errors = err.errors;
  if (err.log && statusCode < 500) payload.log = String(err.log).slice(-4000);
  if (code && String(code).startsWith("JD_FETCH")) payload.hint = "Paste the job description instead.";

  res.status(statusCode).json(payload);
};

export const isProduction = () => env.nodeEnv === "production";

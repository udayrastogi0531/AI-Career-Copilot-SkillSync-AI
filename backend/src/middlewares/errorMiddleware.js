export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  console.error("[API_ERROR]", {
    path: req.originalUrl,
    method: req.method,
    statusCode,
    code: err.code,
    message: err.message,
    stack: err.stack
  });

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    code: err.code || undefined
  });
};

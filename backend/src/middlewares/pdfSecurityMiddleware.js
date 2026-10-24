const startsWith = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);

/**
 * Verify the real file signature. MIME headers and extensions are
 * client-controlled; the first bytes are what the parser will consume.
 */
export const fileSignatureMiddleware = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const buffer = req.file.buffer;
  if (!buffer || buffer.length < 4) {
    return res.status(400).json({ success: false, message: "Invalid or empty file" });
  }

  const mimetype = String(req.file.mimetype || "").toLowerCase();

  if (mimetype === "application/pdf") {
    if (!startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
      return res.status(400).json({ success: false, message: "Invalid PDF file signature" });
    }
    return next();
  }

  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) && !startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) {
      return res.status(400).json({ success: false, message: "Invalid DOCX file signature" });
    }
    return next();
  }

  if (mimetype === "text/plain") {
    // Reject binary content masquerading as text.
    const sample = buffer.subarray(0, 1024);
    let binaryBytes = 0;
    for (const byte of sample) {
      if (byte === 0) return res.status(400).json({ success: false, message: "Invalid text file" });
      if (byte < 7 || (byte > 13 && byte < 32)) binaryBytes += 1;
    }
    if (binaryBytes / sample.length > 0.05) {
      return res.status(400).json({ success: false, message: "Invalid text file" });
    }
    return next();
  }

  return res.status(400).json({ success: false, message: "Unsupported file type" });
};

// Backwards-compatible name used by existing resume routes.
export const pdfSecurityMiddleware = fileSignatureMiddleware;

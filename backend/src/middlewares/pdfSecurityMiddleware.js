export const pdfSecurityMiddleware = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  if (req.file.mimetype === "application/pdf") {
    const buffer = req.file.buffer;
    if (!buffer || buffer.length < 4) {
      return res.status(400).json({ success: false, message: "Invalid PDF" });
    }

    const isPDF =
      buffer[0] === 0x25 && // '%'
      buffer[1] === 0x50 && // 'P'
      buffer[2] === 0x44 && // 'D'
      buffer[3] === 0x46;   // 'F'

    if (!isPDF) {
      return res.status(400).json({ success: false, message: "Invalid PDF" });
    }
  }

  next();
};

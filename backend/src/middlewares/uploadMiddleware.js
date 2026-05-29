import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export const uploadPdf = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimes.has(file.mimetype)) {
      const err = new Error("Only PDF or DOCX files are allowed");
      err.statusCode = 400;
      return cb(err);
    }
    return cb(null, true);
  }
});

import multer from "multer";

const storage = multer.memoryStorage();

const resumeMimes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const jobMimes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

const makeUploader = (allowedMimes, maxBytes, label) =>
  multer({
    storage,
    limits: {
      fileSize: maxBytes,
      files: 1,
      // A multipart body can carry far more than a file: cap the other parts so
      // a crafted form cannot spend memory on fields, headers or boundaries.
      fields: 4,
      fieldSize: 64 * 1024,
      parts: 8,
      headerPairs: 100
    },
    fileFilter: (req, file, cb) => {
      if (!allowedMimes.has(file.mimetype)) {
        const err = new Error(label);
        err.statusCode = 400;
        return cb(err);
      }
      return cb(null, true);
    }
  });

export const uploadPdf = makeUploader(resumeMimes, 8 * 1024 * 1024, "Only PDF or DOCX files are allowed");

export const uploadJobDoc = makeUploader(
  jobMimes,
  5 * 1024 * 1024,
  "Only PDF, DOCX, or TXT job descriptions are allowed"
);

export const allowedResumeMimeTypes = resumeMimes;

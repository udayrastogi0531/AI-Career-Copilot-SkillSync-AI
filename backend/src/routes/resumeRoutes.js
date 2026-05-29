import { Router } from "express";
import {
  createResumeController,
  deleteResumeController,
  getResumeController,
  listResumesController,
  uploadResumePdfDirectController,
  updateResumeController,
  uploadResumePdfController
} from "../controllers/resumeController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadPdf } from "../middlewares/uploadMiddleware.js";
import { pdfSecurityMiddleware } from "../middlewares/pdfSecurityMiddleware.js";

const router = Router();

router.use(protect);

router.get("/", listResumesController);
router.post("/", createResumeController);
router.get("/:resumeId", getResumeController);
router.put("/:resumeId", updateResumeController);
router.delete("/:resumeId", deleteResumeController);
router.post("/upload", uploadPdf.single("resume"), pdfSecurityMiddleware, uploadResumePdfDirectController);
router.post("/:resumeId/upload-pdf", uploadPdf.single("resumePdf"), pdfSecurityMiddleware, uploadResumePdfController);

export default router;

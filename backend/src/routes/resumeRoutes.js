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
import {
  createResumeVersionController,
  getResumeVersionController,
  listResumeVersionsController,
  regenerateLatexController,
  restoreResumeVersionController,
  saveLatexController
} from "../controllers/latexController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadPdf } from "../middlewares/uploadMiddleware.js";
import { fileSignatureMiddleware } from "../middlewares/pdfSecurityMiddleware.js";

const router = Router();

router.use(protect);

router.get("/", listResumesController);
router.post("/", createResumeController);
router.get("/:resumeId", getResumeController);
router.put("/:resumeId", updateResumeController);
router.delete("/:resumeId", deleteResumeController);
router.post("/upload", uploadPdf.single("resume"), fileSignatureMiddleware, uploadResumePdfDirectController);
router.post("/:resumeId/upload-pdf", uploadPdf.single("resumePdf"), fileSignatureMiddleware, uploadResumePdfController);

router.put("/:resumeId/latex", saveLatexController);
router.post("/:resumeId/latex/regenerate", regenerateLatexController);
router.get("/:resumeId/versions", listResumeVersionsController);
router.post("/:resumeId/versions", createResumeVersionController);
router.get("/:resumeId/versions/:versionId", getResumeVersionController);
router.post("/:resumeId/versions/:versionId/restore", restoreResumeVersionController);

export default router;

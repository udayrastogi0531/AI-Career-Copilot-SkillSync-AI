import { Router } from "express";
import {
  analysisHistoryController,
  coverLetterController,
  coverLetterHistoryController,
  jobMatchController,
  resumeAnalysisController,
  skillGapController,
  updateCoverLetterController
} from "../controllers/analysisController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);

router.post("/resume/:resumeId", resumeAnalysisController);
router.post("/job-match", jobMatchController);
router.post("/skill-gap", skillGapController);
router.post("/generate-cover-letter", coverLetterController);
router.get("/cover-letters", coverLetterHistoryController);
router.patch("/cover-letters/:coverLetterId", updateCoverLetterController);
router.get("/history", analysisHistoryController);

export default router;

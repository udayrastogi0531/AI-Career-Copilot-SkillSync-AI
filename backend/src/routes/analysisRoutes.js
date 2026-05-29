import { Router } from "express";
import {
	analysisHistoryController,
	improveResumeController,
	jobMatchController,
	skillGapController,
	resumeAnalysisController,
	coverLetterController
} from "../controllers/analysisController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);

router.post("/resume/:resumeId", resumeAnalysisController);
router.post("/job-match", jobMatchController);
router.post("/skill-gap", skillGapController);
router.post("/improve-resume", improveResumeController);
router.post("/generate-cover-letter", coverLetterController);
router.get("/history", analysisHistoryController);

export default router;

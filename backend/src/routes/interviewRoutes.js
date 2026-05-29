import { Router } from "express";
import {
  evaluateInterviewController,
  generateInterviewController,
  interviewHistoryController,
  improveInterviewController,
  listInterviewSessionsController,
  voiceInterviewController
} from "../controllers/interviewController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);

router.get("/", listInterviewSessionsController);
router.get("/history", interviewHistoryController);
router.post("/generate", generateInterviewController);
router.post("/voice-evaluate", voiceInterviewController);
router.post("/:sessionId/evaluate", evaluateInterviewController);
router.post("/:sessionId/improve", improveInterviewController);

export default router;

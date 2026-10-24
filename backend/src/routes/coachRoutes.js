import { Router } from "express";
import { clearCoachHistoryController, coachChatController, coachHistoryController } from "../controllers/coachController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.post("/chat", coachChatController);
router.get("/history", coachHistoryController);
router.delete("/history", clearCoachHistoryController);

export default router;

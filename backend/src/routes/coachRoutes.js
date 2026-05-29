import { Router } from "express";
import { coachChatController } from "../controllers/coachController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.post("/chat", coachChatController);

export default router;

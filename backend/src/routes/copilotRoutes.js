import { Router } from "express";
import { applyController, proposeController } from "../controllers/copilotController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.post("/propose", proposeController);
router.post("/apply", applyController);

export default router;

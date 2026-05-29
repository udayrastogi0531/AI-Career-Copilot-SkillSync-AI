import { Router } from "express";
import { dashboardStatsController } from "../controllers/dashboardController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/stats", dashboardStatsController);

export default router;

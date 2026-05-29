import { Router } from "express";
import { generatePortfolioController } from "../controllers/portfolioController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.post("/generate", generatePortfolioController);

export default router;

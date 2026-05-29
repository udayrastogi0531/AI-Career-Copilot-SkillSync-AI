import { Router } from "express";
import { getProfileController, updateProfileController } from "../controllers/profileController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/", getProfileController);
router.patch("/", updateProfileController);

export default router;

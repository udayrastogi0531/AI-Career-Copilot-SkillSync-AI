import { Router } from "express";
import {
	forgotPassword,
	googleLogin,
	login,
	resetPasswordController,
	signup,
	validateResetPassword,
	verifyEmailController,
	resendVerificationController
} from "../controllers/authController.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", validateResetPassword);
router.post("/reset-password", resetPasswordController);
router.get("/verify-email", verifyEmailController);
router.post("/resend-verification", resendVerificationController);

export default router;

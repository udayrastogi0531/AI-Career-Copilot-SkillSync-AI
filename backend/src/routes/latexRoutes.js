import { Router } from "express";
import {
  buildLatexController,
  compileLatexController,
  latexTemplatesController
} from "../controllers/latexController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/templates", latexTemplatesController);
router.post("/compile", compileLatexController);
router.post("/build/:resumeId", buildLatexController);

export default router;

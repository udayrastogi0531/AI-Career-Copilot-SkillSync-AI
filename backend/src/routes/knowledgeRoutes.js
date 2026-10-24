import { Router } from "express";
import {
  deleteDocumentController,
  ingestDocumentController,
  listDocumentsController,
  syncCuratedController
} from "../controllers/knowledgeController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(protect);
router.get("/documents", listDocumentsController);
router.post("/documents", ingestDocumentController);
router.delete("/documents/:documentId", deleteDocumentController);
router.post("/sync", syncCuratedController);

export default router;

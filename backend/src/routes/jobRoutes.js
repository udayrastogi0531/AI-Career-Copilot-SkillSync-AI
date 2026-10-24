import { Router } from "express";
import {
  createJobController,
  deleteJobController,
  deleteJobDescriptionController,
  fetchJobController,
  listJobDescriptionsController,
  listJobsController,
  parseJobController,
  updateJobController,
  uploadJobController
} from "../controllers/jobController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadJobDoc } from "../middlewares/uploadMiddleware.js";
import { fileSignatureMiddleware } from "../middlewares/pdfSecurityMiddleware.js";

const jobRouter = Router();
const jobsRouter = Router();

jobRouter.use(protect);
jobRouter.post("/fetch", fetchJobController);
jobRouter.post("/parse", parseJobController);
jobRouter.post("/upload", uploadJobDoc.single("jobDocument"), fileSignatureMiddleware, uploadJobController);
jobRouter.get("/descriptions", listJobDescriptionsController);
jobRouter.delete("/descriptions/:jobDescriptionId", deleteJobDescriptionController);

jobsRouter.use(protect);
jobsRouter.get("/", listJobsController);
jobsRouter.post("/", createJobController);
jobsRouter.patch("/:jobId", updateJobController);
jobsRouter.delete("/:jobId", deleteJobController);

export { jobRouter, jobsRouter };

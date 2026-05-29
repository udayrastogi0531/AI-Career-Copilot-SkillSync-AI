import { Router } from "express";
import {
  createJobController,
  deleteJobController,
  fetchJobController,
  listJobsController,
  updateJobController
} from "../controllers/jobController.js";
import { protect } from "../middlewares/authMiddleware.js";

const jobRouter = Router();
const jobsRouter = Router();

jobRouter.use(protect);
jobRouter.post("/fetch", fetchJobController);

jobsRouter.use(protect);
jobsRouter.get("/", listJobsController);
jobsRouter.post("/", createJobController);
jobsRouter.patch("/:jobId", updateJobController);
jobsRouter.delete("/:jobId", deleteJobController);

export { jobRouter, jobsRouter };

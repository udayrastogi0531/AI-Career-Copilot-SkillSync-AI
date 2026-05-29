import { asyncHandler } from "../utils/asyncHandler.js";
import { fetchJobFromUrl } from "../services/jobFetchService.js";
import {
  createJobApplication,
  deleteJobApplication,
  listJobApplications,
  updateJobApplication
} from "../services/jobService.js";

export const fetchJobController = asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400);
    throw new Error("url is required");
  }

  const job = await fetchJobFromUrl(url);
  res.json({ success: true, job });
});

export const createJobController = asyncHandler(async (req, res) => {
  const { company, role } = req.body;
  if (!company || !role) {
    res.status(400);
    throw new Error("company and role are required");
  }

  const job = await createJobApplication(req.user.id, req.body);
  res.status(201).json({ success: true, job });
});

export const listJobsController = asyncHandler(async (req, res) => {
  const jobs = await listJobApplications(req.user.id);
  const remindersDue = jobs.filter((item) => item.reminder_due).length;

  res.json({
    success: true,
    jobs,
    insights: {
      remindersDue,
      followUps: jobs.filter((item) => item.follow_up_suggestion).slice(0, 5).map((item) => ({
        jobId: item._id,
        company: item.company,
        role: item.role,
        suggestion: item.follow_up_suggestion
      }))
    }
  });
});

export const updateJobController = asyncHandler(async (req, res) => {
  const job = await updateJobApplication(req.user.id, req.params.jobId, req.body);
  res.json({ success: true, job });
});

export const deleteJobController = asyncHandler(async (req, res) => {
  await deleteJobApplication(req.user.id, req.params.jobId);
  res.json({ success: true, message: "Job entry deleted" });
});

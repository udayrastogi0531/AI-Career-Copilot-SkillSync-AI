import { asyncHandler } from "../utils/asyncHandler.js";
import { fetchJobFromUrl } from "../services/jobFetchService.js";
import {
  deleteJobDescription,
  extractTextFromJobFile,
  listJobDescriptions,
  parseAndStoreJobDescription
} from "../services/jobDescriptionService.js";
import { parseJobDescription } from "../services/jdParser.js";
import {
  createJobApplication,
  deleteJobApplication,
  listJobApplications,
  updateJobApplication
} from "../services/jobService.js";

export const fetchJobController = asyncHandler(async (req, res) => {
  const { url, resumeId } = req.body || {};
  if (!url) {
    res.status(400);
    throw new Error("url is required");
  }

  const job = await fetchJobFromUrl(url);
  const { record } = await parseAndStoreJobDescription(req.user.id, {
    rawText: job.description,
    sourceType: "url",
    sourceUrl: job.fetchedFrom || url,
    resumeId: resumeId || null,
    parsed: job
  });

  res.json({
    success: true,
    job: { ...job, jobDescriptionId: String(record._id) }
  });
});

export const parseJobController = asyncHandler(async (req, res) => {
  const { text, resumeId, save = false } = req.body || {};
  if (!text || String(text).trim().length < 100) {
    res.status(400);
    throw new Error("Paste at least a few sentences of the job description.");
  }

  const parsed = parseJobDescription(text, { sourceType: "pasted" });

  if (save) {
    const { record } = await parseAndStoreJobDescription(req.user.id, {
      rawText: text,
      sourceType: "pasted",
      resumeId: resumeId || null,
      parsed
    });
    return res.json({ success: true, job: parsed, jobDescriptionId: String(record._id) });
  }

  return res.json({ success: true, job: parsed });
});

export const uploadJobController = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("A PDF, DOCX, or TXT job description is required.");
  }

  const text = await extractTextFromJobFile(req.file);
  const parsed = parseJobDescription(text, { sourceType: "upload" });
  const { record } = await parseAndStoreJobDescription(req.user.id, {
    rawText: text,
    sourceType: "upload",
    resumeId: req.body?.resumeId || null,
    parsed
  });

  res.status(201).json({ success: true, job: parsed, jobDescriptionId: String(record._id) });
});

export const listJobDescriptionsController = asyncHandler(async (req, res) => {
  const descriptions = await listJobDescriptions(req.user.id, req.query.limit);
  res.json({ success: true, descriptions });
});

export const deleteJobDescriptionController = asyncHandler(async (req, res) => {
  await deleteJobDescription(req.user.id, req.params.jobDescriptionId);
  res.json({ success: true, message: "Job description deleted" });
});

export const createJobController = asyncHandler(async (req, res) => {
  const { company, role } = req.body || {};
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
      followUps: jobs
        .filter((item) => item.follow_up_suggestion)
        .slice(0, 5)
        .map((item) => ({
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

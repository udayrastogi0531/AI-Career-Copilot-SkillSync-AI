import { asyncHandler } from "../utils/asyncHandler.js";
import {
  analyzeJobMatch,
  analyzeResume,
  analyzeSkillGap,
  generateCoverLetter,
  listAnalysisHistory,
  listCoverLetters,
  updateCoverLetter
} from "../services/analysisService.js";

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() !== "false";
};

export const resumeAnalysisController = asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  if (!resumeId) {
    res.status(400);
    throw new Error("resumeId is required");
  }

  const result = await analyzeResume(req.user.id, resumeId, {
    jobDescription: req.body?.jobDescription,
    jobDescriptionId: req.body?.jobDescriptionId,
    useAI: parseBoolean(req.body?.useAI, true)
  });
  res.json({ success: true, result });
});

export const jobMatchController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription, jobDescriptionId } = req.body || {};
  if (!resumeId || (!jobDescription && !jobDescriptionId)) {
    res.status(400);
    throw new Error("resumeId and either jobDescription or jobDescriptionId are required");
  }

  const result = await analyzeJobMatch(req.user.id, resumeId, {
    jobDescription,
    jobDescriptionId,
    useAI: parseBoolean(req.body?.useAI, true)
  });
  res.json({ success: true, result });
});

export const analysisHistoryController = asyncHandler(async (req, res) => {
  const history = await listAnalysisHistory(req.user.id, req.query.limit);
  res.json({ success: true, history });
});

export const skillGapController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription, jobDescriptionId } = req.body || {};
  if (!resumeId || (!jobDescription && !jobDescriptionId)) {
    res.status(400);
    throw new Error("resumeId and either jobDescription or jobDescriptionId are required");
  }

  const result = await analyzeSkillGap(req.user.id, resumeId, { jobDescription, jobDescriptionId });
  res.json({ success: true, result });
});

export const coverLetterController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription, jobDescriptionId, tone, role, company } = req.body || {};
  if (!resumeId || (!jobDescription && !jobDescriptionId)) {
    res.status(400);
    throw new Error("resumeId and either jobDescription or jobDescriptionId are required");
  }

  const result = await generateCoverLetter(req.user.id, resumeId, {
    jobDescription,
    jobDescriptionId,
    tone,
    role,
    company
  });
  res.json({ success: true, result });
});

export const coverLetterHistoryController = asyncHandler(async (req, res) => {
  const letters = await listCoverLetters(req.user.id, req.query.limit);
  res.json({ success: true, letters });
});

export const updateCoverLetterController = asyncHandler(async (req, res) => {
  const letter = await updateCoverLetter(req.user.id, req.params.coverLetterId, req.body?.content);
  res.json({ success: true, letter });
});

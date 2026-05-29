import { asyncHandler } from "../utils/asyncHandler.js";
import { analyzeJobMatch, analyzeResume, analyzeSkillGap, improveResume, listAnalysisHistory, generateCoverLetter } from "../services/analysisService.js";

export const resumeAnalysisController = asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  if (!resumeId) {
    res.status(400);
    throw new Error("resumeId is required");
  }

  const result = await analyzeResume(req.user.id, resumeId);
  res.json({ success: true, result });
});

export const jobMatchController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription } = req.body;

  if (!resumeId || !jobDescription) {
    res.status(400);
    throw new Error("resumeId and jobDescription are required");
  }

  const result = await analyzeJobMatch(req.user.id, resumeId, jobDescription);
  res.json({ success: true, result });
});

export const analysisHistoryController = asyncHandler(async (req, res) => {
  const history = await listAnalysisHistory(req.user.id, req.query.limit);
  res.json({ success: true, history });
});

export const improveResumeController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription } = req.body;
  if (!resumeId) {
    res.status(400);
    throw new Error("resumeId is required");
  }

  const result = await improveResume(req.user.id, resumeId, jobDescription);
  res.json({ success: true, result });
});

export const skillGapController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription } = req.body;

  if (!resumeId || !jobDescription) {
    res.status(400);
    throw new Error("resumeId and jobDescription are required");
  }

  const result = await analyzeSkillGap(req.user.id, resumeId, jobDescription);
  res.json({ success: true, result });
});

export const coverLetterController = asyncHandler(async (req, res) => {
  const { resumeId, jobDescription } = req.body;
  if (!resumeId || !jobDescription) {
    res.status(400);
    throw new Error("resumeId and jobDescription are required");
  }

  const result = await generateCoverLetter(req.user.id, resumeId, jobDescription);
  res.json({ success: true, result });
});

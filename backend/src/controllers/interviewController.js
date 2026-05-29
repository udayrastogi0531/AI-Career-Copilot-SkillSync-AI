import { asyncHandler } from "../utils/asyncHandler.js";
import {
  evaluateVoiceInterview,
  evaluateInterview,
  generateInterview,
  improveInterview,
  listInterviewSessions
} from "../services/interviewService.js";

export const generateInterviewController = asyncHandler(async (req, res) => {
  const { resumeId, company, role, interviewMode } = req.body;
  if (!resumeId) {
    res.status(400);
    throw new Error("resumeId is required");
  }

  const session = await generateInterview(req.user.id, resumeId, {
    company,
    role,
    interviewMode
  });
  res.status(201).json({ success: true, session });
});

export const evaluateInterviewController = asyncHandler(async (req, res) => {
  const { answers } = req.body;
  const session = await evaluateInterview(req.user.id, req.params.sessionId, answers);
  res.json({ success: true, session });
});

export const improveInterviewController = asyncHandler(async (req, res) => {
  const { improvedAnswers } = req.body;
  const result = await improveInterview(req.user.id, req.params.sessionId, improvedAnswers);
  res.json({ success: true, ...result });
});

export const listInterviewSessionsController = asyncHandler(async (req, res) => {
  const sessions = await listInterviewSessions(req.user.id);
  res.json({ success: true, sessions });
});

export const interviewHistoryController = asyncHandler(async (req, res) => {
  const sessions = await listInterviewSessions(req.user.id);
  res.json({ success: true, history: sessions });
});

export const voiceInterviewController = asyncHandler(async (req, res) => {
  const { resumeId, question, transcript, durationSec } = req.body;
  if (!resumeId || !question || !transcript) {
    res.status(400);
    throw new Error("resumeId, question and transcript are required");
  }

  const result = await evaluateVoiceInterview(req.user.id, { resumeId, question, transcript, durationSec });
  res.json({ success: true, result });
});

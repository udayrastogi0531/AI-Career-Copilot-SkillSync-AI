import { asyncHandler } from "../utils/asyncHandler.js";
import { applyResumeProposals, proposeResumeChanges } from "../services/resumeCopilotService.js";

export const proposeController = asyncHandler(async (req, res) => {
  const { resumeId, action, selectedText, jobDescription, latexLog } = req.body || {};
  if (!resumeId || !action) {
    res.status(400);
    throw new Error("resumeId and action are required");
  }

  const result = await proposeResumeChanges(req.user.id, resumeId, {
    action,
    selectedText,
    jobDescription,
    latexLog
  });
  res.json({ success: true, result });
});

export const applyController = asyncHandler(async (req, res) => {
  const { resumeId, proposals } = req.body || {};
  if (!resumeId || !Array.isArray(proposals)) {
    res.status(400);
    throw new Error("resumeId and proposals[] are required");
  }

  const result = await applyResumeProposals(req.user.id, resumeId, { proposals });
  res.json({ success: true, result });
});

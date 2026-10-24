import { asyncHandler } from "../utils/asyncHandler.js";
import { CoachMessage } from "../models/CoachMessage.js";
import { JobDescription } from "../models/JobDescription.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { careerCoachReplyWithAI } from "../services/aiService.js";
import { retrieveKnowledge, syncCuratedKnowledge } from "../services/knowledgeService.js";

export const coachChatController = asyncHandler(async (req, res) => {
  const { message, resumeId, jobDescriptionId } = req.body || {};
  const question = String(message || "").trim();

  if (!question) {
    res.status(400);
    throw new Error("message is required");
  }
  if (question.length > 4000) {
    res.status(400);
    throw new Error("message must be 4,000 characters or fewer");
  }

  const [user, resume, job] = await Promise.all([
    User.findById(req.user.id).select("personalization stats"),
    resumeId
      ? Resume.findOne({ _id: resumeId, userId: req.user.id }).select("summary skills title")
      : Resume.findOne({ userId: req.user.id }).sort({ updatedAt: -1 }).select("summary skills title"),
    jobDescriptionId
      ? JobDescription.findOne({ _id: jobDescriptionId, userId: req.user.id }).select("title company parsed")
      : Promise.resolve(null)
  ]);

  // The curated base is synced at most once per knowledge version.
  let retrieval = { sources: [], retrieval: "none" };
  try {
    await syncCuratedKnowledge();
  } catch (error) {
    console.warn("[COACH] Curated knowledge sync failed:", error.message);
  }
  try {
    retrieval = await retrieveKnowledge(req.user.id, question);
  } catch (error) {
    console.warn("[COACH] Retrieval failed:", error.message);
  }

  const result = await careerCoachReplyWithAI(question, {
    sources: retrieval.sources,
    user: {
      name: user?.name,
      personalization: user?.personalization || {},
      stats: user?.stats || {},
      resumeSummary: resume?.summary || "",
      resumeSkills: resume?.skills || [],
      activeJob: job
        ? {
            title: job.title,
            company: job.company,
            requiredSkills: job.parsed?.requiredSkills || []
          }
        : null
    }
  });

  await CoachMessage.create([
    { userId: req.user.id, role: "user", content: question },
    {
      userId: req.user.id,
      role: "assistant",
      content: result.answer,
      actions: result.actions,
      citations: result.citations.map((citation) => ({
        title: citation.title,
        url: citation.url,
        quote: citation.quote
      })),
      retrieval: retrieval.retrieval
    }
  ]);

  res.json({
    success: true,
    result: {
      ...result,
      retrieval: retrieval.retrieval,
      sources: retrieval.sources.map((source) => ({
        title: source.title,
        url: source.url,
        kind: source.kind,
        score: source.score,
        excerpt: String(source.content || "").slice(0, 240)
      }))
    }
  });
});

export const coachHistoryController = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const messages = await CoachMessage.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("role content actions citations retrieval createdAt");

  res.json({ success: true, messages: messages.reverse() });
});

export const clearCoachHistoryController = asyncHandler(async (req, res) => {
  await CoachMessage.deleteMany({ userId: req.user.id });
  res.json({ success: true, message: "Coach history cleared" });
});

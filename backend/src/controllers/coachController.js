import { asyncHandler } from "../utils/asyncHandler.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";
import { careerCoachReplyWithAI } from "../services/aiService.js";

export const coachChatController = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400);
    throw new Error("message is required");
  }

  const [latestResume, user] = await Promise.all([
    Resume.findOne({ userId: req.user.id }).sort({ updatedAt: -1 }),
    User.findById(req.user.id).select("personalization stats")
  ]);

  const contextPrompt = [
    `User message: ${message}`,
    `User stats: ${JSON.stringify(user?.stats || {})}`,
    `User personalization: ${JSON.stringify(user?.personalization || {})}`,
    `Latest resume summary: ${latestResume?.summary || ""}`,
    `Latest resume skills: ${JSON.stringify(latestResume?.skills || [])}`
  ].join("\n");

  const result = await careerCoachReplyWithAI(contextPrompt);
  res.json({ success: true, result });
});

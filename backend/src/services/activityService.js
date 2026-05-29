import { Activity } from "../models/Activity.js";
import { Analysis } from "../models/Analysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";

export const trackActivity = async (userId, type, data = {}) => {
  await Activity.create({
    userId,
    type,
    data
  });
};

export const recomputeUserStats = async (userId) => {
  const [totalResumes, interviewsTaken, resumeAnalyses] = await Promise.all([
    Resume.countDocuments({ userId }),
    InterviewSession.countDocuments({ userId }),
    Analysis.find({ userId, analysisType: "resume" }).select("result.score")
  ]);

  const scores = resumeAnalyses
    .map((item) => Number(item?.result?.score))
    .filter((value) => Number.isFinite(value));

  const avgATSScore = scores.length
    ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1))
    : 0;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "stats.totalResumes": totalResumes,
        "stats.avgATSScore": avgATSScore,
        "stats.interviewsTaken": interviewsTaken
      }
    }
  );

  return {
    totalResumes,
    avgATSScore,
    interviewsTaken
  };
};

export const getActivityHistory = async (userId, type, limit = 20) => {
  return Activity.find({ userId, type })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100));
};

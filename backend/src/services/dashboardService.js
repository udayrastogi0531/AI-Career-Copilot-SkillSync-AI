import { Activity } from "../models/Activity.js";
import { Analysis } from "../models/Analysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Resume } from "../models/Resume.js";
import { User } from "../models/User.js";

export const getDashboardStats = async (userId) => {
  const [
    resumesCount,
    analysesCount,
    interviewsCount,
    latestResumeAnalysis,
    latestJobMatch,
    jobMatchesCount,
    coverLetterCount,
    resumeAnalyses,
    interviews,
    jobMatches,
    user,
    atsActivities,
    jobMatchActivities,
    interviewActivities
  ] = await Promise.all([
    Resume.countDocuments({ userId }),
    Analysis.countDocuments({ userId }),
    InterviewSession.countDocuments({ userId }),
    Analysis.findOne({ userId, analysisType: "resume" }).sort({ createdAt: -1 }),
    Analysis.findOne({ userId, analysisType: "job-match" }).sort({ createdAt: -1 }),
    Analysis.countDocuments({ userId, analysisType: "job-match" }),
    Analysis.countDocuments({ userId, analysisType: "cover-letter" }),
    Analysis.find({ userId, analysisType: "resume" }).sort({ createdAt: -1 }).limit(10),
    InterviewSession.find({ userId }).sort({ createdAt: -1 }).limit(10),
    Analysis.find({ userId, analysisType: "job-match" }).sort({ createdAt: -1 }).limit(10),
    User.findById(userId).select("stats"),
    Activity.find({ userId, type: "ATS" }).sort({ createdAt: -1 }).limit(20),
    Activity.find({ userId, type: "JOB_MATCH" }).sort({ createdAt: -1 }).limit(20),
    Activity.find({ userId, type: "INTERVIEW" }).sort({ createdAt: -1 }).limit(20)
  ]);

  const avgResumeScore = calculateAverage(
    resumeAnalyses
      .map((item) => Number(item?.result?.score))
      .filter((score) => Number.isFinite(score))
  );

  const resumeTrend = resumeAnalyses
    .map((item) => ({ date: item.createdAt, score: Number(item?.result?.score || 0) }))
    .reverse();

  const interviewTrend = interviews
    .map((session) => {
      const previousScore = Number(session.improvementLoop?.[0]?.previousScore ?? session.evaluation?.overallScore ?? 0);
      const currentScore = Number(session.evaluation?.overallScore ?? previousScore);
      return {
        sessionId: session._id,
        previousScore,
        currentScore,
        delta: Number((currentScore - previousScore).toFixed(1)),
        updatedAt: session.updatedAt
      };
    })
    .reverse();

  const averageImprovementDelta = calculateAverage(interviewTrend.map((item) => item.delta));
  const averageJobMatch = calculateAverage(
    jobMatches
      .map((item) => Number(item?.result?.match_percentage))
      .filter((score) => Number.isFinite(score))
  );

  const jobMatchTrend = jobMatches
    .map((item) => ({ date: item.createdAt, score: Number(item?.result?.match_percentage || 0) }))
    .reverse();

  const smartSuggestions = buildSmartSuggestions({
    avgResumeScore,
    averageJobMatch,
    interviewsCount,
    jobMatchActivities,
    personalization: user?.personalization || {}
  });

  const recentAnalyses = await Analysis.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("analysisType result createdAt");

  const recentInterviews = interviews.slice(0, 10).map((session) => ({
    sessionId: session._id,
    score: session.evaluation?.overallScore ?? null,
    improvementCount: session.improvementLoop?.length || 0,
    updatedAt: session.updatedAt
  }));

  return {
    resumesCount,
    analysesCount,
    jobMatchesCount,
    interviewsCount,
    userStats: user?.stats || {
      totalResumes: resumesCount,
      avgATSScore: avgResumeScore,
      interviewsTaken: interviewsCount
    },
    latestResumeScore: latestResumeAnalysis?.result?.score ?? null,
    latestJobMatch: latestJobMatch?.result?.match_percentage ?? null,
    averageJobMatch,
    avgResumeScore,
    averageImprovementDelta,
    resumeTrend,
    jobMatchTrend,
    interviewTrend,
    smartSuggestions,
    history: {
      recentAnalyses,
      recentInterviews,
      atsHistory: atsActivities,
      jobMatchHistory: jobMatchActivities,
      interviewHistory: interviewActivities,
      coverLetterCount
    }
  };
};

const calculateAverage = (values) => {
  if (!values.length) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(1));
};

const buildSmartSuggestions = ({ avgResumeScore, averageJobMatch, interviewsCount, jobMatchActivities, personalization }) => {
  const suggestions = [];

  if (avgResumeScore < 70) {
    suggestions.push("Improve ATS score by strengthening summary and measurable impact bullets.");
  }

  if (averageJobMatch < 65) {
    suggestions.push("Focus on role-specific skill alignment before applying.");
  }

  if (interviewsCount < 3) {
    suggestions.push("Take at least 3 mock interviews this week to improve confidence.");
  }

  const missingSkillFrequency = new Map();
  for (const item of jobMatchActivities || []) {
    const missing = Array.isArray(item?.data?.missing_skills) ? item.data.missing_skills : [];
    for (const skill of missing) {
      const key = String(skill).trim();
      if (!key) continue;
      missingSkillFrequency.set(key, (missingSkillFrequency.get(key) || 0) + 1);
    }
  }

  const topMissingSkill = [...missingSkillFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topMissingSkill) {
    suggestions.push(`You should learn ${topMissingSkill} next based on recent job matches.`);
  }

  const preferredRole = Array.isArray(personalization?.targetRoles) ? personalization.targetRoles[0] : "";
  if (preferredRole) {
    suggestions.push(`Tailor your next resume version for ${preferredRole} role keywords and impact statements.`);
  }

  return suggestions.slice(0, 5);
};

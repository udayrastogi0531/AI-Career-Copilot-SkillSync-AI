import { InterviewSession } from "../models/InterviewSession.js";
import { Resume } from "../models/Resume.js";
import {
  evaluateVoiceTranscriptWithAI,
  evaluateImprovedAnswersWithAI,
  evaluateInterviewAnswersWithAI,
  generateInterviewQuestionsWithAI
} from "./aiService.js";
import { recomputeUserStats, trackActivity } from "./activityService.js";

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const generateInterview = async (userId, resumeId, context = {}) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw createServiceError("Resume not found", 404);
  }

  const { questions, questionSet, adaptiveMode } = await generateInterviewQuestionsWithAI({
    resumeInput: resume.toObject(),
    company: context.company,
    role: context.role,
    interviewMode: context.interviewMode
  });

  const session = await InterviewSession.create({
    userId,
    resumeId,
    company: String(context.company || "").trim(),
    role: String(context.role || "").trim(),
    interviewMode: String(context.interviewMode || "behavioral").trim(),
    questions,
    questionMeta: questionSet,
    adaptiveMode,
    answers: questions.map(() => "")
  });

  await trackActivity(userId, "INTERVIEW", {
    sessionId: session._id,
    resumeId,
    event: "generated",
    totalQuestions: questions.length
  });
  await recomputeUserStats(userId);

  return session;
};

export const evaluateInterview = async (userId, sessionId, answers) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId }).populate("resumeId");
  if (!session) {
    throw createServiceError("Interview session not found", 404);
  }

  if (!Array.isArray(answers) || answers.length !== session.questions.length) {
    throw createServiceError("Answers array must match number of questions", 400);
  }

  const evaluation = await evaluateInterviewAnswersWithAI({
    resumeInput: session.resumeId.toObject(),
    questions: session.questions,
    answers
  });

  session.answers = answers;
  session.evaluation = {
    overallScore: evaluation.score,
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    perQuestion: evaluation.per_question
  };

  await session.save();

  await trackActivity(userId, "INTERVIEW", {
    sessionId: session._id,
    resumeId: session.resumeId?._id || session.resumeId,
    event: "evaluated",
    score: evaluation.score
  });

  return session;
};

export const improveInterview = async (userId, sessionId, improvedAnswers) => {
  const session = await InterviewSession.findOne({ _id: sessionId, userId });
  if (!session) {
    throw createServiceError("Interview session not found", 404);
  }

  if (!session.evaluation || !session.answers.length) {
    throw createServiceError("Evaluate initial interview answers before improvement loop", 400);
  }

  if (!Array.isArray(improvedAnswers) || improvedAnswers.length !== session.questions.length) {
    throw createServiceError("Improved answers array must match number of questions", 400);
  }

  const improved = await evaluateImprovedAnswersWithAI({
    previousEvaluation: session.evaluation,
    questions: session.questions,
    oldAnswers: session.answers,
    newAnswers: improvedAnswers
  });

  const previousScore = Number(session.evaluation.overallScore || 0);

  session.answers = improvedAnswers;
  session.evaluation.overallScore = improved.score;
  session.evaluation.strengths = improved.strengths;
  session.evaluation.improvements = improved.improvements;
  session.improvementLoop.push({
    previousScore,
    newScore: improved.score,
    summary: improved.summary
  });

  await session.save();

  await trackActivity(userId, "INTERVIEW", {
    sessionId: session._id,
    resumeId: session.resumeId,
    event: "improved",
    score: improved.score,
    previousScore
  });

  return {
    session,
    improvementSummary: {
      previousScore,
      newScore: improved.score,
      summary: improved.summary
    }
  };
};

export const listInterviewSessions = async (userId) => {
  return InterviewSession.find({ userId }).sort({ updatedAt: -1 });
};

export const evaluateVoiceInterview = async (userId, { resumeId, question, transcript, durationSec }) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw createServiceError("Resume not found", 404);
  }

  const result = await evaluateVoiceTranscriptWithAI({ question, transcript });
  const voiceMetrics = analyzeVoiceTranscript(transcript, durationSec);

  const confidenceScore = calculateConfidenceScore({
    baseScore: result.score,
    fillerCount: voiceMetrics.fillerWordCount,
    speakingWpm: voiceMetrics.speakingSpeedWpm
  });

  const confidence = confidenceScore >= 8 ? "high" : confidenceScore >= 6 ? "good" : "low";

  const finalResult = {
    ...result,
    confidence,
    confidence_score: confidenceScore,
    filler_words: voiceMetrics.fillerWordCount,
    filler_breakdown: voiceMetrics.fillerBreakdown,
    speaking_speed_wpm: voiceMetrics.speakingSpeedWpm,
    improvement_tips: buildVoiceImprovementTips(voiceMetrics, confidenceScore)
  };

  await trackActivity(userId, "INTERVIEW", {
    event: "voice-evaluated",
    resumeId,
    score: finalResult.score,
    confidence: finalResult.confidence,
    filler_words: finalResult.filler_words,
    speaking_speed_wpm: finalResult.speaking_speed_wpm
  });

  return finalResult;
};

const analyzeVoiceTranscript = (transcript, durationSec) => {
  const text = String(transcript || "").toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const fillers = ["um", "uh", "like", "you know", "actually", "basically"];

  const fillerBreakdown = {};
  let fillerWordCount = 0;

  for (const filler of fillers) {
    const pattern = new RegExp(`\\b${filler.replace(/\s+/g, "\\s+")}\\b`, "g");
    const count = (text.match(pattern) || []).length;
    if (count > 0) {
      fillerBreakdown[filler] = count;
      fillerWordCount += count;
    }
  }

  const safeDuration = Number(durationSec) > 0 ? Number(durationSec) : Math.max(20, words.length * 0.45);
  const speakingSpeedWpm = Math.round((words.length / safeDuration) * 60);

  return {
    fillerWordCount,
    fillerBreakdown,
    speakingSpeedWpm
  };
};

const calculateConfidenceScore = ({ baseScore, fillerCount, speakingWpm }) => {
  let score = Number(baseScore || 0);

  if (fillerCount > 10) score -= 2;
  else if (fillerCount > 5) score -= 1;

  if (speakingWpm < 90 || speakingWpm > 190) score -= 1;

  return Math.max(0, Math.min(10, Number(score.toFixed(1))));
};

const buildVoiceImprovementTips = (metrics, confidenceScore) => {
  const tips = [];

  if (metrics.fillerWordCount > 6) {
    tips.push("Reduce filler words by pausing briefly before key points.");
  }
  if (metrics.speakingSpeedWpm < 100) {
    tips.push("Increase speaking pace slightly to sound more confident.");
  }
  if (metrics.speakingSpeedWpm > 180) {
    tips.push("Slow down to improve clarity and structure.");
  }
  if (confidenceScore < 6) {
    tips.push("Use STAR format to deliver structured and confident responses.");
  }

  return tips;
};

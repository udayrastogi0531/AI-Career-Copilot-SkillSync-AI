import { Analysis } from "../models/Analysis.js";
import { CoverLetter } from "../models/CoverLetter.js";
import { Resume } from "../models/Resume.js";
import { env } from "../config/env.js";
import {
  generateAtsNarrative,
  generateCoverLetterWithAI,
  generateJobMatchNarrative
} from "./aiService.js";
import { ATS_ENGINE_VERSION, computeAtsScore } from "./atsEngine.js";
import { computeJobMatch, JOB_MATCH_ENGINE_VERSION } from "./jobMatchEngine.js";
import { resolveJobDescription } from "./jobDescriptionService.js";
import { parseJobDescription } from "./jdParser.js";
import { recomputeUserStats, trackActivity } from "./activityService.js";

const serviceError = (message, statusCode = 404) => Object.assign(new Error(message), { statusCode });

const parseConfiguredWeights = () => {
  if (!env.atsWeights) return {};
  try {
    const parsed = JSON.parse(env.atsWeights);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.warn("[ATS] ATS_WEIGHTS_JSON is not valid JSON; default weights will be used.");
    return {};
  }
};

const findResume = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw serviceError("Resume not found");
  return resume;
};

const aiFailure = (error) => ({
  available: false,
  code: error?.code || "AI_PROVIDER_FAILED",
  message: error?.message || "AI commentary is unavailable."
});

export const analyzeResume = async (userId, resumeId, options = {}) => {
  const resume = await findResume(userId, resumeId);

  const jobInput = await resolveJobDescription(userId, {
    jobDescriptionId: options.jobDescriptionId,
    jobDescription: options.jobDescription
  });

  const deterministic = computeAtsScore({
    resume: resume.toObject(),
    parsedJob: jobInput?.parsed || (options.jobDescription ? parseJobDescription(options.jobDescription) : null),
    jobDescription: jobInput?.rawText || options.jobDescription || "",
    weights: parseConfiguredWeights()
  });

  const report = {
    ...deterministic,
    jobDescriptionId: jobInput?.id ? String(jobInput.id) : null,
    ai: { available: false }
  };

  if (options.useAI !== false) {
    try {
      const narrative = await generateAtsNarrative({ resume: resume.toObject(), deterministic });
      report.ai = { available: true };
      if (narrative.recruiter_feedback) report.recruiter_feedback = narrative.recruiter_feedback;
      report.ai_strengths = narrative.strengths;
      report.ai_improvements = narrative.improvements;
      report.ai_rewrite_suggestions = narrative.rewrite_suggestions;
    } catch (error) {
      report.ai = aiFailure(error);
      console.warn("[ATS] AI narrative unavailable:", error.code || error.message);
    }
  }

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "resume",
    result: report,
    jobDescription: String(jobInput?.rawText || options.jobDescription || "").slice(0, 30000),
    jobDescriptionId: jobInput?.id || null,
    engineVersion: ATS_ENGINE_VERSION,
    inputHash: deterministic.inputHash
  });

  await trackActivity(userId, "ATS", {
    resumeId,
    score: report.score,
    inputHash: report.inputHash,
    issues: report.warnings || []
  });
  await recomputeUserStats(userId);

  return report;
};

export const analyzeJobMatch = async (userId, resumeId, options = {}) => {
  const resume = await findResume(userId, resumeId);
  const jobInput = await resolveJobDescription(userId, {
    jobDescriptionId: options.jobDescriptionId,
    jobDescription: options.jobDescription
  });

  if (!jobInput) {
    throw serviceError("A job description or jobDescriptionId is required.", 400);
  }

  const deterministic = computeJobMatch({
    resume: resume.toObject(),
    jobDescription: jobInput.rawText,
    parsedJob: jobInput.parsed
  });

  const result = {
    ...deterministic,
    jobDescriptionId: jobInput.id ? String(jobInput.id) : null,
    ai: { available: false }
  };

  if (options.useAI !== false) {
    try {
      const narrative = await generateJobMatchNarrative({
        resume: resume.toObject(),
        job: { description: jobInput.rawText, ...jobInput.parsed },
        deterministic
      });
      result.recommendation = narrative.recommendation;
      result.transferable_strengths = narrative.transferable_strengths;
      result.interview_focus = narrative.interview_focus;
      result.ai = { available: true };
    } catch (error) {
      result.ai = aiFailure(error);
      result.recommendation =
        "Deterministic match computed. AI commentary is unavailable, so review the requirement matrix and gaps below.";
      console.warn("[JOB_MATCH] AI narrative unavailable:", error.code || error.message);
    }
  } else {
    result.recommendation =
      "Deterministic match computed. Review the requirement matrix, missing skills, and roadmap.";
  }

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "job-match",
    result,
    jobDescription: jobInput.rawText.slice(0, 30000),
    jobDescriptionId: jobInput.id || null,
    engineVersion: JOB_MATCH_ENGINE_VERSION
  });

  await trackActivity(userId, "JOB_MATCH", {
    resumeId,
    match_percentage: result.match_percentage,
    missing_skills: result.missing_skills || []
  });

  return result;
};

export const analyzeSkillGap = async (userId, resumeId, options = {}) => {
  const resume = await findResume(userId, resumeId);
  const jobInput = await resolveJobDescription(userId, {
    jobDescriptionId: options.jobDescriptionId,
    jobDescription: options.jobDescription
  });
  if (!jobInput) throw serviceError("A job description or jobDescriptionId is required.", 400);

  const match = computeJobMatch({
    resume: resume.toObject(),
    jobDescription: jobInput.rawText,
    parsedJob: jobInput.parsed
  });

  const result = {
    engineVersion: match.engineVersion,
    jobDescriptionId: jobInput.id ? String(jobInput.id) : null,
    match_percentage: match.match_percentage,
    missing_skills: match.missing_skills,
    preferred_gaps: match.preferred_gaps,
    critical_gaps: match.critical_gaps,
    matched_skills: match.matched_skills,
    matched_keywords: match.matched_keywords,
    missing_keywords: match.missing_keywords,
    requirements: match.requirements,
    evidence: match.evidence,
    roadmap: match.roadmap,
    project_suggestions: match.project_suggestions,
    next_best_skill: match.next_best_skill,
    generatedAt: match.generatedAt
  };

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "skill-gap",
    result,
    jobDescription: jobInput.rawText.slice(0, 30000),
    jobDescriptionId: jobInput.id || null,
    engineVersion: JOB_MATCH_ENGINE_VERSION
  });

  return result;
};

export const listAnalysisHistory = async (userId, limit = 20) => {
  return Analysis.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100))
    .select("analysisType result.score result.match_percentage result.inputHash createdAt resumeId jobDescriptionId");
};

const collectNumbers = (text) => {
  const matches = String(text || "").match(/\b\d+(?:\.\d+)?%?\b|\$\s?\d[\d,.]*/g) || [];
  return new Set(matches.map((match) => match.replace(/\s+/g, "").toLowerCase()));
};

export const generateCoverLetter = async (userId, resumeId, options = {}) => {
  const resume = await findResume(userId, resumeId);
  const jobInput = await resolveJobDescription(userId, {
    jobDescriptionId: options.jobDescriptionId,
    jobDescription: options.jobDescription
  });
  if (!jobInput) throw serviceError("A job description or jobDescriptionId is required.", 400);

  const tone = ["professional", "concise", "technical", "enthusiastic"].includes(options.tone)
    ? options.tone
    : "professional";

  const result = await generateCoverLetterWithAI({
    resumeInput: resume.toObject(),
    jobDescription: jobInput.rawText,
    tone,
    role: options.role || jobInput.parsed?.title || "",
    company: options.company || jobInput.parsed?.company || ""
  });

  const knownNumbers = new Set([
    ...collectNumbers(JSON.stringify(resume.toObject())),
    ...collectNumbers(jobInput.rawText)
  ]);
  const introducedNumbers = [...collectNumbers(result.letter)].filter((number) => !knownNumbers.has(number));
  const warnings = introducedNumbers.length
    ? [
        `The generated letter contains numeric claims that are not in your resume or the job description: ${introducedNumbers.join(
          ", "
        )}. Remove or verify them before sending.`
      ]
    : [];

  const record = await CoverLetter.create({
    userId,
    resumeId,
    jobDescriptionId: jobInput.id || null,
    tone,
    role: options.role || jobInput.parsed?.title || "",
    company: options.company || jobInput.parsed?.company || "",
    jobDescription: jobInput.rawText,
    content: result.letter,
    highlights: result.highlights,
    model: env.geminiModel
  });

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "cover-letter",
    result: { letter: result.letter, highlights: result.highlights, tone, warnings },
    jobDescription: jobInput.rawText.slice(0, 30000),
    jobDescriptionId: jobInput.id || null
  });

  return {
    id: String(record._id),
    letter: result.letter,
    highlights: result.highlights,
    tone,
    wordCount: result.wordCount,
    warnings,
    role: record.role,
    company: record.company
  };
};

export const listCoverLetters = async (userId, limit = 20) => {
  return CoverLetter.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 50))
    .select("tone role company content highlights createdAt resumeId jobDescriptionId");
};

export const updateCoverLetter = async (userId, coverLetterId, content) => {
  const letter = await CoverLetter.findOne({ _id: coverLetterId, userId });
  if (!letter) throw serviceError("Cover letter not found");
  const text = String(content || "").trim();
  if (!text) throw serviceError("Cover letter content is required.", 400);
  if (text.length > 20000) throw serviceError("Cover letter is too long.", 413);
  letter.content = text;
  await letter.save();
  return letter;
};

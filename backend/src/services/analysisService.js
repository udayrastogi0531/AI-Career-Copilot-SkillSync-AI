import { Analysis } from "../models/Analysis.js";
import { Resume } from "../models/Resume.js";
import { analyzeResumeWithAI, buildSkillGapRoadmapWithAI, improveResumeWithAI, jobMatchWithAI, generateCoverLetterWithAI } from "./aiService.js";
import { recomputeUserStats, trackActivity } from "./activityService.js";

export const analyzeResume = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }

  const result = await analyzeResumeWithAI(resume.toObject());
  const diagnostics = computeAtsDiagnostics(resume.toObject(), result);

  const finalResult = {
    ...result,
    score: diagnostics.weightedScore,
    score_breakdown: diagnostics.breakdown,
    issues: diagnostics.issues,
    suggestions: [...new Set([...(result.improvements || []), ...diagnostics.suggestions])]
  };

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "resume",
    result: finalResult
  });

  await trackActivity(userId, "ATS", {
    resumeId,
    score: finalResult.score,
    issues: finalResult.issues || [],
    suggestions: finalResult.suggestions || []
  });
  await recomputeUserStats(userId);

  return finalResult;
};

export const analyzeJobMatch = async (userId, resumeId, jobDescription) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }

  const result = await jobMatchWithAI({
    resumeInput: resume.toObject(),
    jobDescription
  });

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "job-match",
    result,
    jobDescription
  });

  await trackActivity(userId, "JOB_MATCH", {
    resumeId,
    match_percentage: result.match_percentage,
    missing_skills: result.missing_skills || []
  });

  return result;
};

export const listAnalysisHistory = async (userId, limit = 20) => {
  const rows = await Analysis.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 20, 100))
    .select("analysisType result createdAt resumeId");

  return rows;
};

export const improveResume = async (userId, resumeId, jobDescription = "") => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }

  const improved = await improveResumeWithAI({
    resumeInput: resume.toObject(),
    jobDescription
  });

  const enhancedExperience = mergeExperienceBullets(resume.experience, improved.improved_experience_bullets);

  const updatedPayload = {
    summary: improved.improved_summary || resume.summary,
    skills: [...new Set([...(resume.skills || []), ...improved.improved_skills])],
    experience: enhancedExperience
  };

  Object.assign(resume, updatedPayload);
  await resume.save();

  const result = {
    ...improved,
    resume: resume.toObject()
  };

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "resume-improve",
    result,
    jobDescription
  });

  await recomputeUserStats(userId);

  return result;
};

export const analyzeSkillGap = async (userId, resumeId, jobDescription) => {
  const jobMatch = await analyzeJobMatch(userId, resumeId, jobDescription);
  const missingSkills = Array.isArray(jobMatch.missing_skills) ? jobMatch.missing_skills : [];

  const aiRoadmap = await buildSkillGapRoadmapWithAI(missingSkills);
  const fallbackRoadmap = buildFallbackRoadmap(missingSkills);

  const roadmap = aiRoadmap.roadmap.length ? aiRoadmap.roadmap : fallbackRoadmap;

  return {
    missing_skills: missingSkills,
    roadmap,
    next_best_skill: aiRoadmap.next_best_skill || roadmap[0]?.skill || ""
  };
};

export const generateCoverLetter = async (userId, resumeId, jobDescription) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }

  const result = await generateCoverLetterWithAI({
    resumeInput: resume.toObject(),
    jobDescription
  });

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "cover-letter",
    result,
    jobDescription
  });

  return result;
};

const computeAtsDiagnostics = (resumeInput, aiResult) => {
  const skills = Array.isArray(resumeInput?.skills) ? resumeInput.skills : [];
  const sections = {
    summary: Boolean(String(resumeInput?.summary || "").trim()),
    experience: Array.isArray(resumeInput?.experience) && resumeInput.experience.length > 0,
    education: Array.isArray(resumeInput?.education) && resumeInput.education.length > 0,
    projects: Array.isArray(resumeInput?.projects) && resumeInput.projects.length > 0,
    certifications: Array.isArray(resumeInput?.certifications) && resumeInput.certifications.length > 0,
    links: Array.isArray(resumeInput?.links) && resumeInput.links.length > 0
  };

  const parsedText = String(resumeInput?.parsedText || "").trim();
  const wordCount = parsedText.split(/\s+/).filter(Boolean).length;

  // KEYWORDS SCORE (40%) - Based on skill density and keyword matching
  const keywordDensity = Math.min(1, skills.length / 14);
  const keywordScore = Math.round(keywordDensity * 100);
  const keywordRelevance = calculateKeywordRelevance(parsedText, skills);

  // SKILLS MATCH (30%) - Overlap with resume content
  const skillsMatchScore = Math.round(keywordRelevance * 100);

  // EXPERIENCE SCORE (20%)
  const experienceScore = scoreExperienceStrength(resumeInput?.experience || []);

  // FORMAT SCORE (10%) - Content length, structure, formatting
  const formatScore = scoreFormatting(wordCount, sections);

  // Calculate weighted score with new weights
  const weightedScore = Math.round(
    keywordScore * 0.25 +        // Keywords: 25%
    skillsMatchScore * 0.25 +    // Skills: 25%
    experienceScore * 0.30 +     // Experience: 30%
    formatScore * 0.20           // Format: 20%
  );

  const issues = [];
  const suggestions = [];

  // Keywords analysis
  if (skills.length < 6) {
    issues.push("Low number of technical skills listed");
    suggestions.push("Add at least 8-10 relevant technical skills.");
  }

  // Sections analysis
  const completedSections = Object.values(sections).filter(Boolean).length;
  if (completedSections < 4) {
    issues.push("Missing key resume sections");
    suggestions.push("Add missing sections: summary, experience, education, projects.");
  }

  // Experience analysis
  if (!sections.experience) {
    issues.push("No professional experience found");
    suggestions.push("Add work experience with quantifiable achievements.");
  }

  // Content length analysis
  if (wordCount < 100) {
    issues.push("Resume content is too short");
    suggestions.push("Expand your resume to 200-400 words with specific achievements and metrics.");
  }
  if (wordCount > 800) {
    issues.push("Resume content is too long");
    suggestions.push("Condense to 200-400 words. ATS systems can miss content on second page.");
  }

  // Grammar check
  const grammarScore = estimateGrammarScore(parsedText || String(resumeInput?.summary || ""));
  if (grammarScore < 70) {
    issues.push("Possible grammar or readability issues detected");
    suggestions.push("Review sentence structure, eliminate passive voice, use action verbs.");
  }

  // Format check
  if (formatScore < 60) {
    issues.push("Format or structure issues detected");
    suggestions.push("Use simple formatting. Avoid tables, graphics, and special characters.");
  }

  return {
    breakdown: {
      keywords: keywordScore,
      skills_match: skillsMatchScore,
      experience_strength: experienceScore,
      format: formatScore,
      sections: Math.round((completedSections / 6) * 100),
      grammar: grammarScore
    },
    weightedScore,
    issues,
    suggestions
  };
};

const calculateKeywordRelevance = (text, skills) => {
  const lowerText = String(text || "").toLowerCase();
  const matchedSkills = skills.filter((skill) =>
    lowerText.includes(String(skill || "").toLowerCase())
  ).length;
  return skills.length > 0 ? Math.min(1, matchedSkills / skills.length) : 0;
};

const scoreFormatting = (wordCount, sections) => {
  let score = 70;

  // Word count quality
  if (wordCount >= 200 && wordCount <= 400) {
    score += 20;
  } else if (wordCount >= 150 && wordCount <= 450) {
    score += 15;
  } else if (wordCount >= 100 && wordCount <= 500) {
    score += 10;
  } else if (wordCount < 100) {
    score -= 20;
  } else if (wordCount > 600) {
    score -= 15;
  }

  // Section completeness bonus
  const sectionCount = Object.values(sections).filter(Boolean).length;
  score += (sectionCount / 6) * 10;

  return Math.max(30, Math.min(100, score));
};

const scoreExperienceStrength = (experience = []) => {
  if (!Array.isArray(experience) || !experience.length) {
    return 30;
  }

  let score = Math.min(100, experience.length * 20);
  const descriptions = experience.map((item) => String(item?.description || ""));
  const bulletLike = descriptions.filter((line) => /[-•]/.test(line)).length;
  const metricCount = descriptions.join(" ").match(/\d+%|\$\d+|\d+\+|\d+x/gi)?.length || 0;

  score += bulletLike * 8;
  score += Math.min(25, metricCount * 5);

  return Math.max(30, Math.min(100, score));
};

const estimateGrammarScore = (text) => {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return 50;
  }

  const sentences = normalized.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) {
    return 55;
  }

  let penalty = 0;
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length > 35) {
      penalty += 6;
    }
    if (!/^[A-Z]/.test(sentence)) {
      penalty += 4;
    }
  }

  const repeatedPunctuation = (normalized.match(/[!?]{2,}|\.{3,}/g) || []).length;
  penalty += repeatedPunctuation * 3;

  return Math.max(45, 100 - penalty);
};

const mergeExperienceBullets = (experience = [], bullets = []) => {
  if (!Array.isArray(experience) || !experience.length || !Array.isArray(bullets) || !bullets.length) {
    return experience;
  }

  const mergedText = bullets.slice(0, 8).map((line) => `- ${line}`).join("\n");

  return experience.map((entry, index) => {
    if (index === 0) {
      return {
        ...entry,
        description: mergedText
      };
    }
    return entry;
  });
};

const buildFallbackRoadmap = (missingSkills = []) => {
  return missingSkills.slice(0, 6).map((skill) => ({
    skill,
    resources: [
      `YouTube: ${skill} full course`,
      `Roadmap.sh: ${skill.toLowerCase().replace(/\s+/g, "-")}`,
      `Official docs for ${skill}`
    ],
    timeline: "2-4 weeks"
  }));
};

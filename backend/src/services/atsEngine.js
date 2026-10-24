import crypto from "node:crypto";
import { extractSkills, matchSkills, normalizeSkill } from "../utils/skillDictionary.js";
import { parseJobDescription, requirementCoverage } from "./jdParser.js";

export const ATS_ENGINE_VERSION = "2.0.0";

/**
 * Default weights. They are relative: dimensions that are not applicable
 * (for example education when the JD states no requirement) are removed and
 * the remaining weights are renormalised. This keeps the formula explainable
 * and reproducible instead of silently scoring missing data as zero.
 */
export const DEFAULT_ATS_WEIGHTS = Object.freeze({
  required_skills: 0.28,
  keyword_coverage: 0.2,
  preferred_skills: 0.08,
  experience_alignment: 0.15,
  role_alignment: 0.08,
  education_alignment: 0.04,
  section_completeness: 0.06,
  formatting: 0.06,
  achievement_evidence: 0.05
});

const DIMENSION_LABELS = {
  required_skills: "Required skill match",
  keyword_coverage: "Required keyword coverage",
  preferred_skills: "Preferred skill match",
  experience_alignment: "Experience alignment",
  role_alignment: "Role alignment",
  education_alignment: "Education alignment",
  section_completeness: "Resume section completeness",
  formatting: "Formatting and parsing quality",
  achievement_evidence: "Achievement evidence"
};

const STOPWORDS = new Set(
  `a an and are as at be by for from has have in is it its of on or that the this to was were will with you your our we they their`.split(
    /\s+/
  )
);

const ACTION_VERBS = new Set(
  `built led designed developed implemented launched delivered architected improved reduced increased optimized automated created migrated mentored managed owned drove scaled shipped analyzed established streamlined secured integrated negotiated coordinated`.split(
    /\s+/
  )
);

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value) => Math.round(clamp(value));

const normalizeWhitespace = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const flattenResumeText = (resume = {}) => {
  const parts = [
    resume.fullName,
    resume.email,
    resume.phone,
    resume.summary,
    ...(resume.skills || []),
    ...(resume.experience || []).flatMap((entry) => [entry.role, entry.company, entry.description]),
    ...(resume.education || []).flatMap((entry) => [entry.institution, entry.degree, entry.fieldOfStudy]),
    ...(resume.projects || []).flatMap((entry) => [entry.name, entry.description, ...(entry.technologies || [])]),
    ...(resume.certifications || []).flatMap((entry) => [entry.credential, entry.issuer]),
    ...(resume.achievements || []).flatMap((entry) => [entry.title, entry.description]),
    ...(resume.publications || []).flatMap((entry) => [entry.title, entry.publisher]),
    ...(resume.volunteer || []).flatMap((entry) => [entry.organization, entry.role, entry.description]),
    ...(resume.hackathons || []).flatMap((entry) => [entry.name, entry.project, entry.award]),
    ...(resume.awards || []).flatMap((entry) => [entry.title, entry.issuer]),
    ...(resume.links || []).flatMap((entry) => [entry.label, entry.url]),
    resume.parsedText
  ];

  return parts.filter(Boolean).map(String).join("\n").trim();
};

export const collectResumeSkills = (resume = {}) => {
  const declared = (resume.skills || [])
    .map((skill) => normalizeSkill(skill) || String(skill || "").trim())
    .filter(Boolean);
  const inferred = extractSkills(flattenResumeText(resume));
  return [...new Set([...declared, ...inferred])];
};

const parseYear = (value) => {
  const match = String(value || "").match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

export const estimateResumeExperienceYears = (experience = [], now = new Date()) => {
  if (!Array.isArray(experience) || !experience.length) {
    return { years: 0, datedRoles: 0, totalRoles: 0, hasDates: false };
  }

  const currentYear = now.getFullYear();
  const ranges = [];
  let datedRoles = 0;

  for (const entry of experience) {
    const start = parseYear(entry?.startDate);
    const endText = String(entry?.endDate || "");
    const isCurrent = /present|current|now|ongoing/i.test(endText);
    const end = isCurrent ? currentYear : parseYear(endText);

    if (start && end && end >= start) {
      ranges.push([start, end]);
      datedRoles += 1;
    } else if (start && !endText) {
      ranges.push([start, currentYear]);
      datedRoles += 1;
    }
  }

  if (!ranges.length) {
    return { years: 0, datedRoles: 0, totalRoles: experience.length, hasDates: false };
  }

  ranges.sort((a, b) => a[0] - b[0]);
  let totalMonths = 0;
  let [rangeStart, rangeEnd] = ranges[0];

  for (const [start, end] of ranges.slice(1)) {
    if (start <= rangeEnd + 1) {
      rangeEnd = Math.max(rangeEnd, end);
    } else {
      totalMonths += (rangeEnd - rangeStart) * 12;
      rangeStart = start;
      rangeEnd = end;
    }
  }
  totalMonths += (rangeEnd - rangeStart) * 12;

  return {
    years: Math.round((totalMonths / 12) * 10) / 10,
    datedRoles,
    totalRoles: experience.length,
    hasDates: true
  };
};

const roleTokens = (value) =>
  new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9+# ]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );

export const scoreRoleAlignment = (resume = {}, jobTitle = "") => {
  const target = roleTokens(jobTitle);
  if (!target.size) return null;

  const candidates = [
    ...(resume.experience || []).map((entry) => entry?.role),
    ...(resume.experience || []).map((entry) => entry?.company),
    resume.title
  ].filter(Boolean);

  if (!candidates.length) return 0;

  let best = 0;
  for (const candidate of candidates) {
    const tokens = roleTokens(candidate);
    if (!tokens.size) continue;
    const overlap = [...target].filter((token) => tokens.has(token)).length;
    const union = new Set([...target, ...tokens]).size;
    best = Math.max(best, union ? overlap / union : 0);
  }

  // Seniority words carry a lot of signal in titles.
  const seniority = ["intern", "junior", "mid", "senior", "lead", "staff", "principal", "director", "head"];
  const targetSeniority = seniority.find((word) => String(jobTitle).toLowerCase().includes(word));
  if (targetSeniority) {
    const hasSeniority = candidates.some((candidate) => String(candidate).toLowerCase().includes(targetSeniority));
    if (hasSeniority) best = Math.min(1, best + 0.15);
  }

  return round(best * 100);
};

export const scoreExperienceAlignment = (resume = {}, requirement = {}) => {
  const estimate = estimateResumeExperienceYears(resume.experience || []);
  const required = Number(requirement?.minYears) || 0;

  if (!required) {
    // No explicit requirement: score the depth of evidence instead.
    if (!estimate.totalRoles) return { score: 0, explanation: "No work experience was found on the resume." };
    return {
      score: round(Math.min(100, 40 + estimate.years * 8 + estimate.datedRoles * 5)),
      explanation: "No explicit experience requirement in the JD; scored on documented role depth."
    };
  }

  if (!estimate.hasDates) {
    return {
      score: 35,
      explanation: `The JD asks for ${required}+ years, but your roles have no usable start/end dates. Add dates so this can be verified.`
    };
  }

  const ratio = estimate.years / required;
  const score = ratio >= 1 ? 100 : Math.max(10, ratio * 100);
  return {
    score: round(score),
    explanation: `Approximately ${estimate.years} years of dated experience against a ${required}+ year requirement.`
  };
};

const scoreEducation = (resume = {}, requirement = {}) => {
  const rank = Number(requirement?.rank) || 0;
  if (!rank) return null;

  const educationText = (resume.education || [])
    .flatMap((entry) => [entry.degree, entry.fieldOfStudy, entry.institution])
    .join(" ")
    .toLowerCase();

  const levels = [
    { rank: 5, pattern: /ph\.?d|doctorate|doctoral/ },
    { rank: 4, pattern: /master|m\.?s\.?c?\b|mba|m\.?eng/ },
    { rank: 3, pattern: /bachelor|b\.?s\.?c?\b|b\.?eng|undergraduate/ },
    { rank: 2, pattern: /associate/ },
    { rank: 1, pattern: /high school|secondary school|ged/ }
  ];

  const highest = levels.find((level) => level.pattern.test(educationText));
  if (!highest) {
    return { score: 20, explanation: `The JD asks for a ${requirement.level} qualification; no matching education was found.` };
  }

  const score = highest.rank >= rank ? 100 : Math.max(25, (highest.rank / rank) * 100);
  const fieldMatch = requirement.field
    ? educationText.includes(String(requirement.field).toLowerCase())
    : false;

  return {
    score: round(fieldMatch ? Math.min(100, score + 5) : score),
    explanation: `Highest detected qualification: rank ${highest.rank} against required rank ${rank}${
      requirement.field ? ` (field: ${requirement.field})` : ""
    }.`
  };
};

const scoreSections = (resume = {}) => {
  const checks = {
    contact: Boolean(normalizeWhitespace(resume.email) || normalizeWhitespace(resume.phone)),
    summary: Boolean(normalizeWhitespace(resume.summary)),
    skills: Array.isArray(resume.skills) && resume.skills.length >= 3,
    experience: Array.isArray(resume.experience) && resume.experience.some((entry) => normalizeWhitespace(entry?.description)),
    education: Array.isArray(resume.education) && resume.education.length > 0,
    projects: Array.isArray(resume.projects) && resume.projects.length > 0
  };
  const complete = Object.values(checks).filter(Boolean).length;
  return {
    score: round((complete / Object.keys(checks).length) * 100),
    checks,
    explanation: `${complete} of ${Object.keys(checks).length} core sections have usable content.`
  };
};

const buildFormattingWarnings = (resume = {}, resumeText = "") => {
  const warnings = [];
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const descriptionText = (resume.experience || []).map((entry) => String(entry?.description || "")).join("\n");

  if (!normalizeWhitespace(resume.email) && !normalizeWhitespace(resume.phone)) {
    warnings.push({ code: "NO_CONTACT", severity: "high", message: "Add an email address and phone number so recruiters can reach you." });
  }
  if (wordCount < 150) {
    warnings.push({ code: "TOO_SHORT", severity: "high", message: `Resume text is only ~${wordCount} words. Most ATS parses need at least 200.` });
  }
  if (wordCount > 950) {
    warnings.push({ code: "TOO_LONG", severity: "medium", message: `Resume text is ~${wordCount} words. Trim to the most relevant evidence.` });
  }
  if (!descriptionText.trim()) {
    warnings.push({ code: "NO_EXPERIENCE_DETAIL", severity: "high", message: "Experience entries have no descriptions, so ATS keyword matching has little to read." });
  } else if (!/[-•*\n]/.test(descriptionText)) {
    warnings.push({ code: "NO_BULLETS", severity: "medium", message: "Use short bullet lines in experience descriptions; dense paragraphs parse poorly." });
  }

  const longBullets = descriptionText
    .split(/\n|(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.split(/\s+/).length > 45);
  if (longBullets.length) {
    warnings.push({ code: "LONG_BULLETS", severity: "medium", message: `${longBullets.length} bullet(s) exceed 45 words. Split or shorten them.` });
  }

  if (/\t|\|{2,}/.test(resumeText)) {
    warnings.push({ code: "LAYOUT_MARKERS", severity: "medium", message: "Table or tab markers were detected. Export a single-column PDF for reliable parsing." });
  }

  const emojiCount = (resumeText.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (emojiCount) {
    warnings.push({ code: "EMOJI", severity: "low", message: "Emoji and icon glyphs may be stripped by ATS parsers." });
  }

  const undatedRoles = (resume.experience || []).filter((entry) => !parseYear(entry?.startDate) && !parseYear(entry?.endDate)).length;
  if (undatedRoles) {
    warnings.push({ code: "UNDATED_ROLES", severity: "medium", message: `${undatedRoles} experience entr${undatedRoles === 1 ? "y has" : "ies have"} no dates. Add start/end years.` });
  }

  const score = clamp(100 - warnings.reduce((total, warning) => {
    if (warning.severity === "high") return total + 20;
    if (warning.severity === "medium") return total + 10;
    return total + 4;
  }, 0), 25, 100);

  return { warnings, score: round(score) };
};

const splitEvidenceLines = (resume = {}) => {
  const lines = [];
  for (const entry of resume.experience || []) {
    for (const line of String(entry?.description || "").split(/\n|(?<=[.!?])\s+/)) {
      if (line.trim()) lines.push(line.trim());
    }
  }
  for (const entry of resume.projects || []) {
    if (entry?.description) lines.push(String(entry.description).trim());
  }
  return lines;
};

const scoreAchievements = (resume = {}) => {
  const lines = splitEvidenceLines(resume);
  if (!lines.length) {
    return { score: 0, metricLines: 0, actionLines: 0, totalLines: 0, explanation: "No experience or project bullet lines found." };
  }

  const metricLines = lines.filter((line) => /\b\d+(\.\d+)?\s?%|\$\s?\d|(?:\d+(\.\d+)?x)\b|reduced|increased|saved|improved by/i.test(line));
  const actionLines = lines.filter((line) => {
    const first = line.replace(/^[-•*]\s*/, "").split(/\s+/)[0]?.toLowerCase() || "";
    return ACTION_VERBS.has(first);
  });

  const metricRatio = metricLines.length / lines.length;
  const actionRatio = actionLines.length / lines.length;
  const score = clamp(metricRatio * 65 + actionRatio * 35);

  return {
    score: round(score),
    metricLines: metricLines.length,
    actionLines: actionLines.length,
    totalLines: lines.length,
    explanation: `${metricLines.length} of ${lines.length} lines contain measurable outcomes; ${actionLines.length} start with a strong action verb.`
  };
};

const scoreKeywordCoverage = (keywords = [], resumeText = "") => {
  if (!keywords.length) return null;
  const text = String(resumeText || "").toLowerCase();
  const skillSet = new Set(extractSkills(text).map((skill) => skill.toLowerCase()));

  const matched = [];
  const missing = [];
  for (const keyword of keywords) {
    const cleaned = normalizeWhitespace(keyword).toLowerCase();
    if (!cleaned) continue;
    const isPresent = skillSet.has(cleaned) || text.includes(cleaned);
    if (isPresent) matched.push(keyword);
    else missing.push(keyword);
  }

  if (!matched.length && !missing.length) return null;
  return {
    score: round((matched.length / (matched.length + missing.length)) * 100),
    matched,
    missing
  };
};

const normalizeWeights = (input = {}) => {
  const weights = { ...DEFAULT_ATS_WEIGHTS };
  for (const key of Object.keys(DEFAULT_ATS_WEIGHTS)) {
    const value = Number(input?.[key]);
    if (Number.isFinite(value) && value >= 0) {
      weights[key] = value;
    }
  }
  if (Object.values(weights).reduce((sum, value) => sum + value, 0) <= 0) {
    return { ...DEFAULT_ATS_WEIGHTS };
  }
  return weights;
};

const stableInputHash = (payload) =>
  crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);

/**
 * Compute an explainable ATS report.
 *
 * @param {object} params
 * @param {object} params.resume  Canonical resume document (plain object).
 * @param {string} [params.jobDescription] Raw JD text. Omit for resume-only mode.
 * @param {object} [params.parsedJob] Already parsed JD from jdParser.
 * @param {object} [params.weights] Partial weight overrides.
 */
export const computeAtsScore = ({ resume = {}, jobDescription = "", parsedJob = null, weights = {} } = {}) => {
  const resumeText = flattenResumeText(resume);
  const resumeSkills = collectResumeSkills(resume);
  const parsed = parsedJob || (String(jobDescription || "").trim() ? parseJobDescription(jobDescription) : null);
  const mode = parsed ? "job-targeted" : "resume-only";
  const effectiveWeights = normalizeWeights(weights);

  const dimensions = {};
  let requirementMatrix = { rows: [], passed: 0, total: 0 };

  if (parsed) {
    const skillMatch = matchSkills(parsed.requiredSkills, resumeSkills);
    const preferredMatch = matchSkills(parsed.preferredSkills, resumeSkills);
    const keywordCoverage = scoreKeywordCoverage(parsed.keywords, resumeText);
    const coverage = requirementCoverage(
      [...(parsed.requiredQualifications || []), ...(parsed.responsibilities || [])].slice(0, 30),
      resumeText
    );

    dimensions.required_skills = {
      score: parsed.requiredSkills.length
        ? round((skillMatch.matched.length / parsed.requiredSkills.length) * 100)
        : null,
      explanation: parsed.requiredSkills.length
        ? `${skillMatch.matched.length} of ${parsed.requiredSkills.length} required skills were found in the resume.`
        : "The JD lists no recognisable required skills.",
      matched: skillMatch.matched,
      missing: skillMatch.missing
    };

    dimensions.keyword_coverage = keywordCoverage
      ? {
          score: keywordCoverage.score,
          explanation: `${keywordCoverage.matched.length} of ${
            keywordCoverage.matched.length + keywordCoverage.missing.length
          } JD keywords appear in the resume.`,
          matched: keywordCoverage.matched,
          missing: keywordCoverage.missing
        }
      : { score: null, explanation: "No keywords could be extracted from the JD.", matched: [], missing: [] };

    dimensions.preferred_skills = {
      score: parsed.preferredSkills.length
        ? round((preferredMatch.matched.length / parsed.preferredSkills.length) * 100)
        : null,
      explanation: parsed.preferredSkills.length
        ? `${preferredMatch.matched.length} of ${parsed.preferredSkills.length} preferred skills were found.`
        : "The JD lists no preferred skills.",
      matched: preferredMatch.matched,
      missing: preferredMatch.missing
    };

    dimensions.experience_alignment = scoreExperienceAlignment(resume, parsed.experience);
    const roleScore = scoreRoleAlignment(resume, parsed.title);
    dimensions.role_alignment = roleScore === null
      ? null
      : {
          score: roleScore,
          explanation: parsed.title
            ? `Compared your role titles with the target title "${parsed.title}".`
            : "The JD has no identifiable title."
        };
    dimensions.education_alignment = scoreEducation(resume, parsed.education);

    // Requirement-by-requirement table is returned separately for the UI.
    requirementMatrix = coverage;
  } else {
    dimensions.required_skills = { score: null, explanation: "No job description supplied; skill coverage is not scored.", matched: [], missing: [] };
    dimensions.keyword_coverage = { score: null, explanation: "No job description supplied; keyword coverage is not scored.", matched: [], missing: [] };
    dimensions.preferred_skills = { score: null, explanation: "No job description supplied.", matched: [], missing: [] };
    dimensions.experience_alignment = scoreExperienceAlignment(resume, {});
    dimensions.role_alignment = null;
    dimensions.education_alignment = null;
  }

  dimensions.section_completeness = scoreSections(resume);
  const formatting = buildFormattingWarnings(resume, resumeText);
  dimensions.formatting = { score: formatting.score, explanation: `${formatting.warnings.length} formatting/parsing warning(s).` };
  dimensions.achievement_evidence = scoreAchievements(resume);

  const applicable = Object.entries(dimensions).filter(([, value]) => value && value.score !== null && Number.isFinite(value.score));
  const totalWeight = applicable.reduce((sum, [key]) => sum + (effectiveWeights[key] || 0), 0);
  const overallScore = totalWeight
    ? round(applicable.reduce((sum, [key, value]) => sum + value.score * (effectiveWeights[key] || 0), 0) / totalWeight)
    : 0;

  const breakdown = {};
  for (const [key, value] of Object.entries(dimensions)) {
    if (!value) continue;
    breakdown[key] = {
      label: DIMENSION_LABELS[key],
      score: value.score,
      weight: value.score === null ? 0 : Number(((effectiveWeights[key] || 0) / (totalWeight || 1)).toFixed(4)),
      applicable: value.score !== null,
      explanation: value.explanation
    };
  }

  const matchedSkills = parsed
    ? [...new Set([...(dimensions.required_skills.matched || []), ...(dimensions.preferred_skills.matched || [])])]
    : resumeSkills;
  const missingSkills = parsed
    ? [...new Set([...(dimensions.required_skills.missing || []), ...(dimensions.preferred_skills.missing || [])])]
    : [];
  const matchedKeywords = dimensions.keyword_coverage?.matched || [];
  const missingKeywords = dimensions.keyword_coverage?.missing || [];

  const recommendations = [];
  for (const skill of missingSkills.slice(0, 8)) {
    recommendations.push({
      priority: dimensions.required_skills?.missing?.includes(skill) ? "high" : "medium",
      category: "skills",
      message: `Add verifiable evidence for ${skill} if you have used it; otherwise treat it as a learning gap.`
    });
  }
  for (const keyword of missingKeywords.slice(0, 8)) {
    recommendations.push({
      priority: "medium",
      category: "keywords",
      message: `The JD uses "${keyword}" but your resume does not. Reuse the employer's wording only where it truthfully describes your work.`
    });
  }
  for (const warning of formatting.warnings) {
    recommendations.push({ priority: warning.severity, category: "formatting", message: warning.message });
  }
  if (!(resume.projects || []).length) {
    recommendations.push({ priority: "low", category: "sections", message: "Add 1–2 relevant projects with technologies and measurable outcomes." });
  }
  if (parsed && requirementMatrix.total && requirementMatrix.passed < requirementMatrix.total) {
    recommendations.push({
      priority: "medium",
      category: "requirements",
      message: `Only ${requirementMatrix.passed} of ${requirementMatrix.total} requirement lines have matching evidence. Review the requirement matrix.`
    });
  }

  const grammar = round((dimensions.formatting.score * 0.6 + dimensions.section_completeness.score * 0.4));
  const atsConfidence = round(
    (dimensions.formatting.score + dimensions.section_completeness.score + (dimensions.keyword_coverage?.score ?? 60)) / 3
  );
  const recruiterReadability = round((dimensions.achievement_evidence.score + dimensions.section_completeness.score + grammar) / 3);

  const feedbackParts = [];
  if (parsed) {
    feedbackParts.push(
      `Required skill coverage is ${dimensions.required_skills.score ?? "not applicable"}% and keyword coverage is ${
        dimensions.keyword_coverage.score ?? "not applicable"
      }%.`
    );
  } else {
    feedbackParts.push("This is a resume-only scan. Add a job description for targeted keyword and skill scoring.");
  }
  feedbackParts.push(
    `${missingSkills.length} missing skill(s) and ${missingKeywords.length} missing keyword(s) were identified.`
  );
  if (formatting.warnings.length) {
    feedbackParts.push(`Resolve ${formatting.warnings.length} formatting warning(s) before applying.`);
  }

  const hash = stableInputHash({
    resumeText,
    resumeSkills,
    jd: parsed ? { title: parsed.title, requiredSkills: parsed.requiredSkills, keywords: parsed.keywords } : null,
    weights: effectiveWeights,
    engine: ATS_ENGINE_VERSION
  });

  return {
    engine: "skillsync-deterministic-ats",
    engineVersion: ATS_ENGINE_VERSION,
    mode,
    score: overallScore,
    overallScore,
    inputHash: hash,
    weights: Object.fromEntries(
      Object.entries(effectiveWeights).map(([key, value]) => [key, Number((value / (totalWeight || 1)).toFixed(4))])
    ),
    scoreBreakdown: breakdown,
    // Backwards-compatible flat breakdown used by the existing analyzer UI.
    score_breakdown: {
      keywords: dimensions.keyword_coverage?.score ?? 0,
      skills_match: dimensions.required_skills?.score ?? 0,
      experience_strength: dimensions.experience_alignment?.score ?? 0,
      format: dimensions.formatting.score,
      sections: dimensions.section_completeness.score,
      grammar
    },
    matchedSkills: [...new Set(matchedSkills)],
    missingSkills,
    matchedKeywords,
    missingKeywords,
    preferredMatched: dimensions.preferred_skills?.matched || [],
    preferredMissing: dimensions.preferred_skills?.missing || [],
    requirements: requirementMatrix.rows,
    requirementSummary: { passed: requirementMatrix.passed, total: requirementMatrix.total },
    warnings: formatting.warnings,
    issues: formatting.warnings.map((warning) => warning.message),
    recommendations,
    suggestions: recommendations.map((recommendation) => recommendation.message),
    ats_confidence: atsConfidence,
    recruiter_readability: recruiterReadability,
    recruiter_feedback: feedbackParts.join(" "),
    job: parsed
      ? {
          title: parsed.title,
          company: parsed.company,
          location: parsed.location,
          requiredSkills: parsed.requiredSkills,
          preferredSkills: parsed.preferredSkills,
          keywords: parsed.keywords,
          experience: parsed.experience,
          education: parsed.education,
          parserVersion: parsed.parserVersion
        }
      : null,
    generatedAt: new Date().toISOString()
  };
};

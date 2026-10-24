import { extractSkills, getSkillCategory, matchSkills } from "../utils/skillDictionary.js";
import { parseJobDescription, requirementCoverage } from "./jdParser.js";
import {
  collectResumeSkills,
  flattenResumeText,
  scoreExperienceAlignment,
  scoreRoleAlignment
} from "./atsEngine.js";

export const JOB_MATCH_ENGINE_VERSION = "1.0.0";

const RESOURCE_LIBRARY = {
  React: ["https://react.dev/learn"],
  "Node.js": ["https://nodejs.org/en/learn"],
  TypeScript: ["https://www.typescriptlang.org/docs/handbook/intro.html"],
  JavaScript: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript"],
  Python: ["https://docs.python.org/3/tutorial/"],
  Java: ["https://dev.java/learn/"],
  Go: ["https://go.dev/tour/"],
  Rust: ["https://doc.rust-lang.org/book/"],
  "C++": ["https://en.cppreference.com/w/"],
  SQL: ["https://www.postgresql.org/docs/current/tutorial.html"],
  PostgreSQL: ["https://www.postgresql.org/docs/current/tutorial.html"],
  MongoDB: ["https://www.mongodb.com/docs/manual/tutorial/"],
  Redis: ["https://redis.io/docs/latest/develop/"],
  Docker: ["https://docs.docker.com/get-started/"],
  Kubernetes: ["https://kubernetes.io/docs/tutorials/"],
  AWS: ["https://docs.aws.amazon.com/"],
  Azure: ["https://learn.microsoft.com/en-us/azure/"],
  "Google Cloud": ["https://cloud.google.com/docs"],
  Terraform: ["https://developer.hashicorp.com/terraform/tutorials"],
  "CI/CD": ["https://docs.github.com/en/actions"],
  GraphQL: ["https://graphql.org/learn/"],
  "REST APIs": ["https://developer.mozilla.org/en-US/docs/Glossary/REST"],
  "Unit Testing": ["https://martinfowler.com/testing/"],
  "Integration Testing": ["https://martinfowler.com/articles/practical-test-pyramid.html"],
  "Test Automation": ["https://playwright.dev/docs/intro"],
  "System Design": ["https://github.com/donnemartin/system-design-primer"],
  Security: ["https://owasp.org/www-project-top-ten/"],
  "Machine Learning": ["https://developers.google.com/machine-learning/crash-course"],
  LLMs: ["https://www.promptingguide.ai/"],
  RAG: ["https://python.langchain.com/docs/tutorials/rag/"]
};

const PROJECT_IDEAS = {
  React: "Build a small dashboard that fetches from a public API and handles loading, error, and empty states.",
  "Node.js": "Build a REST service with authentication, input validation, and integration tests.",
  TypeScript: "Add strict TypeScript to an existing JavaScript project and eliminate all `any` types in one module.",
  Docker: "Containerise a small API and database, then document the compose workflow.",
  Kubernetes: "Deploy a containerised service to a local cluster with health checks and resource limits.",
  AWS: "Deploy a small serverless endpoint with logging, alarms, and least-privilege IAM.",
  PostgreSQL: "Design a normalised schema and benchmark three query plans before and after indexing.",
  MongoDB: "Model a document schema with embedded versus referenced data and measure read performance.",
  GraphQL: "Add a GraphQL layer in front of an existing REST API and compare payload sizes.",
  "CI/CD": "Add a pipeline that runs lint, tests, and a build on every pull request.",
  Redis: "Add caching to a read-heavy endpoint and measure the p95 latency change.",
  "System Design": "Write a design document for a URL shortener covering storage, caching, and failure modes.",
  Security: "Run an OWASP checklist against one of your existing projects and fix the issues you find.",
  RAG: "Build a document Q&A prototype with a small evaluation set and cited answers.",
  LLMs: "Build a structured-output extraction tool and evaluate it on a labelled sample."
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const resumeLines = (resume = {}) => {
  const lines = [];
  const push = (text, source) => {
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (cleaned.length > 2) lines.push({ text: cleaned, source });
  };

  push(resume.summary, "summary");
  for (const skill of resume.skills || []) push(skill, "skills");
  for (const entry of resume.experience || []) {
    push([entry.role, entry.company].filter(Boolean).join(" at "), "experience");
    for (const line of String(entry.description || "").split(/\n|(?<=[.!?])\s+/)) push(line, "experience");
  }
  for (const entry of resume.projects || []) {
    push([entry.name, ...(entry.technologies || [])].filter(Boolean).join(" — "), "projects");
    push(entry.description, "projects");
  }
  for (const entry of resume.education || []) push([entry.degree, entry.fieldOfStudy, entry.institution].filter(Boolean).join(", "), "education");
  for (const entry of resume.certifications || []) push([entry.credential, entry.issuer].filter(Boolean).join(", "), "certifications");
  return lines;
};

const evidenceForSkill = (skill, lines) => {
  const target = String(skill || "").toLowerCase();
  const matches = lines.filter((line) => line.text.toLowerCase().includes(target));
  if (matches.length) return matches.slice(0, 2).map((line) => line.text);
  return [];
};

const frequencyOf = (term, text) => {
  const haystack = String(text || "").toLowerCase();
  const needle = String(term || "").toLowerCase();
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
};

const timelineFor = (skill) => {
  const category = getSkillCategory(skill);
  const timelines = {
    language: "4–6 weeks",
    frontend: "3–5 weeks",
    backend: "3–5 weeks",
    database: "2–4 weeks",
    cloud: "4–6 weeks",
    devops: "3–5 weeks",
    ai: "6–10 weeks",
    data: "4–6 weeks",
    testing: "2–3 weeks",
    design: "3–4 weeks",
    product: "3–4 weeks",
    soft: "2–4 weeks",
    other: "3–5 weeks"
  };
  return timelines[category] || "3–5 weeks";
};

const buildRoadmap = (gapSkills = [], jdText = "") => {
  const ranked = [...gapSkills]
    .map((skill) => ({ skill, frequency: frequencyOf(skill, jdText) }))
    .sort((a, b) => b.frequency - a.frequency || a.skill.localeCompare(b.skill));

  return ranked.slice(0, 8).map(({ skill, frequency }, index) => ({
    priority: index + 1,
    skill,
    category: getSkillCategory(skill),
    jdMentions: frequency,
    resources: RESOURCE_LIBRARY[skill] || [],
    timeline: timelineFor(skill),
    project: PROJECT_IDEAS[skill] || `Build a small, documented project that demonstrates ${skill} and measure one concrete outcome.`
  }));
};

const buildEvidence = ({ requiredSkills, preferredSkills, resume, lines }) => {
  const evidence = {};
  for (const skill of unique([...requiredSkills, ...preferredSkills])) {
    const snippets = evidenceForSkill(skill, lines);
    evidence[skill] = snippets;
  }
  return evidence;
};

/**
 * Deterministic job match. The same resume and JD always produce the same
 * numbers under the same parser version.
 */
export const computeJobMatch = ({ resume, jobDescription = "", parsedJob = null }) => {
  const parsed = parsedJob || parseJobDescription(jobDescription);
  const resumeSkills = collectResumeSkills(resume);
  const resumeText = flattenResumeText(resume);
  const lines = resumeLines(resume);

  const required = matchSkills(parsed.requiredSkills, resumeSkills);
  const preferred = matchSkills(parsed.preferredSkills, resumeSkills);
  const keywordCoverage = requirementCoverage(parsed.keywords.slice(0, 40), resumeText);

  const requiredScore = parsed.requiredSkills.length
    ? Math.round((required.matched.length / parsed.requiredSkills.length) * 100)
    : null;
  const preferredScore = parsed.preferredSkills.length
    ? Math.round((preferred.matched.length / parsed.preferredSkills.length) * 100)
    : null;
  const keywordScore = parsed.keywords.length
    ? Math.round((keywordCoverage.passed / Math.max(parsed.keywords.length, 1)) * 100)
    : null;

  const experience = scoreExperienceAlignment(resume, parsed.experience);
  const roleScore = scoreRoleAlignment(resume, parsed.title);

  const dimensions = [
    { key: "required_skills", score: requiredScore, weight: 0.55 },
    { key: "keywords", score: keywordScore, weight: 0.2 },
    { key: "preferred_skills", score: preferredScore, weight: 0.1 },
    { key: "experience", score: experience.score, weight: 0.1 },
    { key: "role", score: roleScore, weight: 0.05 }
  ].filter((dimension) => dimension.score !== null && Number.isFinite(dimension.score));

  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const matchPercentage = totalWeight
    ? Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score * dimension.weight, 0) / totalWeight)
    : 0;

  const gapSkills = unique([...required.missing, ...preferred.missing]);
  const roadmap = buildRoadmap(gapSkills, parsed.description);
  const evidence = buildEvidence({ requiredSkills: parsed.requiredSkills, preferredSkills: parsed.preferredSkills, resume, lines });

  const criticalGaps = required.missing
    .map((skill) => ({ skill, jdMentions: frequencyOf(skill, parsed.description) }))
    .sort((a, b) => b.jdMentions - a.jdMentions)
    .slice(0, 6);

  const requirementRows = requirementCoverage(
    [...(parsed.requiredQualifications || []), ...(parsed.responsibilities || [])].slice(0, 30),
    resumeText
  ).rows.map((row) => {
    const matchedEvidence = unique(
      row.skills.length
        ? row.skills.flatMap((skill) => evidenceForSkill(skill, lines))
        : lines
            .filter((line) =>
              String(row.requirement)
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .filter((word) => word.length > 4)
                .some((word) => line.text.toLowerCase().includes(word))
            )
            .map((line) => line.text)
            .slice(0, 1)
    );
    return {
      requirement: row.requirement,
      status: row.passed ? "met" : "gap",
      skills: row.skills,
      matchedSkills: row.matchedSkills,
      wordCoverage: row.wordCoverage,
      evidence: matchedEvidence.slice(0, 2)
    };
  });

  return {
    engine: "skillsync-deterministic-job-match",
    engineVersion: JOB_MATCH_ENGINE_VERSION,
    match_percentage: matchPercentage,
    score_breakdown: Object.fromEntries(
      dimensions.map((dimension) => [
        dimension.key,
        {
          score: dimension.score,
          weight: Number((dimension.weight / totalWeight).toFixed(4))
        }
      ])
    ),
    skill_match: requiredScore,
    keyword_match: keywordScore,
    preferred_match: preferredScore,
    experience_alignment: experience,
    role_alignment: roleScore,
    matched_skills: required.matched,
    missing_skills: required.missing,
    preferred_matched: preferred.matched,
    preferred_gaps: preferred.missing,
    critical_gaps: criticalGaps,
    matched_keywords: parsed.keywords.filter((keyword) => resumeText.toLowerCase().includes(keyword.toLowerCase())),
    missing_keywords: parsed.keywords.filter((keyword) => !resumeText.toLowerCase().includes(keyword.toLowerCase())),
    evidence,
    requirements: requirementRows,
    requirement_summary: {
      met: requirementRows.filter((row) => row.status === "met").length,
      total: requirementRows.length
    },
    roadmap,
    project_suggestions: roadmap.map((item) => ({ skill: item.skill, idea: item.project })),
    next_best_skill: roadmap[0]?.skill || "",
    job: {
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      requiredSkills: parsed.requiredSkills,
      preferredSkills: parsed.preferredSkills,
      experience: parsed.experience,
      education: parsed.education,
      keywords: parsed.keywords,
      parserVersion: parsed.parserVersion
    },
    parserVersion: parsed.parserVersion,
    matchedSkillsFromResume: resumeSkills,
    generatedAt: new Date().toISOString()
  };
};

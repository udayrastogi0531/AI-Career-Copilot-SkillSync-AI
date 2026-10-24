import { Analysis } from "../models/Analysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Resume } from "../models/Resume.js";
import { normalizeSkill } from "../utils/skillDictionary.js";
import { recomputeUserStats } from "./activityService.js";
import { buildLatexFromResume } from "./latexTemplates.js";
import { createResumeVersion } from "./resumeVersionService.js";
import { DOCX_MIME, PDF_MIME, extractDocumentText } from "./documentParser.js";

// Fields a client may edit. Ownership, ids, timestamps, parsed text, and LaTeX
// storage are deliberately excluded and handled by dedicated services.
const EDITABLE_FIELDS = [
  "title",
  "fullName",
  "email",
  "phone",
  "summary",
  "skills",
  "experience",
  "education",
  "projects",
  "certifications",
  "links",
  "achievements",
  "publications",
  "volunteer",
  "hackathons",
  "languages",
  "awards"
];

const TEXT_LIMITS = {
  title: 140,
  fullName: 120,
  email: 160,
  phone: 40,
  summary: 5000
};

const pickResumeFields = (payload = {}) => {
  const result = {};
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] === undefined) continue;

    if (field in TEXT_LIMITS) {
      const value = String(payload[field] ?? "").trim();
      result[field] = value.slice(0, TEXT_LIMITS[field]);
      continue;
    }

    if (field === "skills") {
      result.skills = normalizeSkills(payload.skills);
      continue;
    }

    if (!Array.isArray(payload[field])) {
      throw Object.assign(new Error(`${field} must be an array`), { statusCode: 400 });
    }
    if (payload[field].length > 60) {
      throw Object.assign(new Error(`${field} has too many entries`), { statusCode: 400 });
    }
    result[field] = payload[field];
  }
  return result;
};

export const createResume = async (userId, payload = {}) => {
  const sanitized = pickResumeFields(payload);
  if (!sanitized.title) {
    throw Object.assign(new Error("Resume title is required"), { statusCode: 400 });
  }

  const resume = await Resume.create({
    ...sanitized,
    userId,
    skills: sanitized.skills || [],
    latexSource: buildLatexFromResume(sanitized, sanitized.templateId || "ats-classic"),
    templateId: "ats-classic",
    latexMode: "auto"
  });

  await recomputeUserStats(userId);

  return resume;
};

export const updateResume = async (userId, resumeId, payload = {}) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw Object.assign(new Error("Resume not found"), { statusCode: 404 });
  }

  const sanitized = pickResumeFields(payload);
  if (!Object.keys(sanitized).length) {
    throw Object.assign(new Error("No editable resume fields were supplied"), { statusCode: 400 });
  }

  Object.assign(resume, sanitized);

  // Canonical resume data is the source of truth in auto mode. Manual LaTeX
  // is preserved until the user explicitly regenerates it.
  if (resume.latexMode !== "manual" || !resume.latexSource) {
    resume.latexSource = buildLatexFromResume(resume.toObject(), resume.templateId || "ats-classic");
    resume.latexMode = "auto";
  }

  await resume.save();

  if (payload.saveVersion) {
    await createResumeVersion(userId, resume, {
      label: String(payload.versionLabel || "Manual save").slice(0, 120),
      reason: "manual"
    });
  }

  return resume;
};

export const listResumesByUser = async (userId) => {
  return Resume.find({ userId }).sort({ updatedAt: -1 });
};

export const getResumeById = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw Object.assign(new Error("Resume not found"), { statusCode: 404 });
  }
  return resume;
};

export const parseAndStoreResumeFile = async (userId, resumeId, file) => {
  const fileBuffer = file?.buffer;
  const mimeType = String(file?.mimetype || "").toLowerCase();

  if (!fileBuffer || !mimeType) {
    const err = new Error("Resume file is required");
    err.statusCode = 400;
    throw err;
  }
  if (![PDF_MIME, DOCX_MIME].includes(mimeType)) {
    const err = new Error("Only PDF or DOCX files are allowed");
    err.statusCode = 400;
    throw err;
  }

  // Ownership is checked before any parsing work is spent on the file. When no
  // resume id is supplied the record is only created after a successful parse,
  // so a rejected upload never leaves an empty resume behind.
  const existing = resumeId ? await getResumeById(userId, resumeId) : null;

  const parsed = await extractDocumentText({
    buffer: fileBuffer,
    mimeType,
    filename: file.originalname,
    maxBytes: 8 * 1024 * 1024
  });
  const parsedText = parsed.text;

  const extracted = extractStructuredResumeData(parsedText);

  const resume = existing || new Resume({ userId, title: "Uploaded Resume", templateId: "ats-classic" });
  resume.parsedText = parsedText;

  if (!resume.summary && extracted.summary) {
    resume.summary = extracted.summary;
  }

  if (!resume.summary && parsedText) {
    resume.summary = parsedText.slice(0, 1000).trim();
  }

  if (!resume.email && extracted.email) {
    resume.email = extracted.email;
  }

  if (!resume.phone && extracted.phone) {
    resume.phone = extracted.phone;
  }

  if ((!resume.skills || !resume.skills.length) && extracted.skills.length) {
    resume.skills = extracted.skills;
  }

  if ((!resume.experience || !resume.experience.length) && extracted.experience.length) {
    resume.experience = extracted.experience.map((line) => ({
      company: "",
      role: "",
      startDate: "",
      endDate: "",
      description: line
    }));
  }

  if ((!resume.education || !resume.education.length) && extracted.education.length) {
    resume.education = extracted.education.map((line) => ({
      institution: line,
      degree: "",
      fieldOfStudy: "",
      graduationYear: ""
    }));
  }

  if ((!resume.projects || !resume.projects.length) && extracted.projects.length) {
    resume.projects = extracted.projects.map((line) => ({
      name: line,
      description: "",
      technologies: []
    }));
  }

  if (resume.latexMode !== "manual" || !resume.latexSource) {
    resume.latexSource = buildLatexFromResume(resume.toObject(), resume.templateId || "ats-classic");
    resume.latexMode = "auto";
  }

  await resume.save();
  if (!existing) {
    await recomputeUserStats(userId);
  }
  return resume;
};

export const parseAndStoreResumePdf = async (userId, resumeId, fileBuffer) => {
  return parseAndStoreResumeFile(userId, resumeId, {
    buffer: fileBuffer,
    mimetype: "application/pdf"
  });
};

export const deleteResume = async (userId, resumeId) => {
  const resume = await Resume.findOneAndDelete({ _id: resumeId, userId });
  if (!resume) {
    throw Object.assign(new Error("Resume not found"), { statusCode: 404 });
  }

  await Promise.all([
    Analysis.deleteMany({ userId, resumeId }),
    InterviewSession.deleteMany({ userId, resumeId })
  ]);

  await recomputeUserStats(userId);

  return { deleted: true };
};

const normalizeSkills = (skills) => {
  if (!skills) return [];

  const list = Array.isArray(skills)
    ? skills
    : String(skills)
        .split(",")
        .map((skill) => skill.trim());

  const seen = new Set();
  const result = [];
  for (const raw of list.slice(0, 100)) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    const canonical = normalizeSkill(value) || value;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
};

const extractStructuredResumeData = (text) => {
  const plainText = String(text || "").replace(/\r/g, "").trim();
  const lowerText = plainText.toLowerCase();

  const emailMatch = plainText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  const phoneMatch = plainText.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/);

  const knownSkills = [
    "javascript",
    "typescript",
    "react",
    "node",
    "node.js",
    "express",
    "mongodb",
    "sql",
    "python",
    "java",
    "aws",
    "docker",
    "kubernetes",
    "git",
    "redis",
    "graphql",
    "rest",
    "next.js",
    "html",
    "css",
    "tailwind"
  ];

  const skills = knownSkills
    .filter((skill) => lowerText.includes(skill))
    .map((skill) => (skill === "node.js" ? "Node.js" : skill === "next.js" ? "Next.js" : skill))
    .map((skill) => {
      const normalized = String(skill);
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    });

  const summary = plainText
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 40 && line.length < 320 && !line.includes("@"));

  const experience = extractSectionLines(plainText, "experience");
  const education = extractSectionLines(plainText, "education");
  const projects = extractSectionLines(plainText, "projects");

  return {
    email: emailMatch?.[0] || "",
    phone: phoneMatch?.[0] || "",
    summary: summary || "",
    skills: [...new Set(skills)],
    experience,
    education,
    projects
  };
};

const extractSectionLines = (text, sectionName) => {
  const lower = text.toLowerCase();
  const sections = ["summary", "experience", "education", "projects", "skills", "certifications"];
  const sectionIndex = lower.indexOf(sectionName);
  if (sectionIndex === -1) {
    return [];
  }

  const following = sections
    .filter((name) => name !== sectionName)
    .map((name) => ({ name, idx: lower.indexOf(name, sectionIndex + sectionName.length) }))
    .filter((item) => item.idx !== -1)
    .sort((a, b) => a.idx - b.idx);

  const endIndex = following[0]?.idx || text.length;
  const chunk = text.slice(sectionIndex + sectionName.length, endIndex);

  return chunk
    .split(/\n|•|\u2022|-\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 6)
    .slice(0, 6);
};

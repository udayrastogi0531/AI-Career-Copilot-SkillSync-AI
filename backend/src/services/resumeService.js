import mammoth from "mammoth";
import pdf from "pdf-parse";
import { Analysis } from "../models/Analysis.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Resume } from "../models/Resume.js";
import { recomputeUserStats } from "./activityService.js";

export const createResume = async (userId, payload) => {
  const resume = await Resume.create({
    ...payload,
    userId,
    skills: normalizeSkills(payload.skills)
  });

  await recomputeUserStats(userId);

  return resume;
};

export const updateResume = async (userId, resumeId, payload) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }

  Object.assign(resume, {
    ...payload,
    skills: payload.skills ? normalizeSkills(payload.skills) : resume.skills
  });

  await resume.save();
  return resume;
};

export const listResumesByUser = async (userId) => {
  return Resume.find({ userId }).sort({ updatedAt: -1 });
};

export const getResumeById = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new Error("Resume not found");
  }
  return resume;
};

export const parseAndStoreResumeFile = async (userId, resumeId, file) => {
  const resume = await getResumeById(userId, resumeId);
  const fileBuffer = file?.buffer;
  const mimeType = String(file?.mimetype || "").toLowerCase();

  if (!fileBuffer || !mimeType) {
    const err = new Error("Resume file is required");
    err.statusCode = 400;
    throw err;
  }

  let parsedText;

  try {
    if (mimeType === "application/pdf") {
      const parsed = await pdf(fileBuffer);
      parsedText = String(parsed?.text || "");
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const parsed = await mammoth.extractRawText({ buffer: fileBuffer });
      parsedText = String(parsed?.value || "");
    } else {
      const err = new Error("Only PDF or DOCX files are allowed");
      err.statusCode = 400;
      throw err;
    }
  } catch (error) {
    const err = new Error("Invalid resume file");
    err.statusCode = 400;
    throw err;
  }

  const extracted = extractStructuredResumeData(parsedText);

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

  await resume.save();
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
    throw new Error("Resume not found");
  }

  await Promise.all([
    Analysis.deleteMany({ userId, resumeId }),
    InterviewSession.deleteMany({ userId, resumeId })
  ]);

  await recomputeUserStats(userId);

  return { deleted: true };
};

const normalizeSkills = (skills) => {
  if (!skills) {
    return [];
  }

  if (Array.isArray(skills)) {
    return skills.map((skill) => String(skill).trim()).filter(Boolean);
  }

  return String(skills)
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
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

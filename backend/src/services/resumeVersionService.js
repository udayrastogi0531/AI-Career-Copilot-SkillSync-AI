import { Resume } from "../models/Resume.js";
import { ResumeVersion } from "../models/ResumeVersion.js";
import { buildLatexFromResume } from "./latexTemplates.js";

const MAX_VERSIONS_PER_RESUME = 40;

const snapshotFields = [
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
  "awards",
  "parsedText",
  "latexSource",
  "templateId",
  "latexMode"
];

const buildSnapshot = (resume) => {
  const plain = typeof resume.toObject === "function" ? resume.toObject() : resume;
  const snapshot = {};
  for (const field of snapshotFields) {
    if (plain[field] !== undefined) snapshot[field] = plain[field];
  }
  return JSON.parse(JSON.stringify(snapshot));
};

export const createResumeVersion = async (userId, resume, { label = "Manual save", reason = "manual" } = {}) => {
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });

  const version = await ResumeVersion.create({
    userId,
    resumeId: resume._id,
    label: String(label || "Manual save").slice(0, 120),
    reason,
    snapshot: buildSnapshot(resume),
    latexSource: resume.latexSource || "",
    templateId: resume.templateId || "ats-classic"
  });

  const count = await ResumeVersion.countDocuments({ userId, resumeId: resume._id });
  if (count > MAX_VERSIONS_PER_RESUME) {
    const stale = await ResumeVersion.find({ userId, resumeId: resume._id })
      .sort({ createdAt: 1 })
      .limit(count - MAX_VERSIONS_PER_RESUME)
      .select("_id");
    await ResumeVersion.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  }

  return version;
};

export const listResumeVersions = async (userId, resumeId, limit = 30) => {
  const resume = await Resume.findOne({ _id: resumeId, userId }).select("_id");
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });

  const versions = await ResumeVersion.find({ userId, resumeId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 50))
    .select("label reason templateId createdAt updatedAt");

  return versions;
};

export const getResumeVersion = async (userId, resumeId, versionId) => {
  const version = await ResumeVersion.findOne({ _id: versionId, userId, resumeId });
  if (!version) throw Object.assign(new Error("Resume version not found"), { statusCode: 404 });
  return version;
};

export const restoreResumeVersion = async (userId, resumeId, versionId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });

  const version = await getResumeVersion(userId, resumeId, versionId);

  // Snapshot the current state first so a restore is itself reversible.
  await createResumeVersion(userId, resume, {
    label: "Before restore",
    reason: "restore"
  });

  for (const field of snapshotFields) {
    if (version.snapshot?.[field] !== undefined) {
      resume[field] = version.snapshot[field];
    }
  }

  await resume.save();

  await createResumeVersion(userId, resume, {
    label: `Restored: ${version.label}`,
    reason: "restore"
  });

  return resume;
};

export const saveResumeLatex = async (userId, resumeId, payload = {}) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });

  const source = String(payload.latexSource ?? resume.latexSource ?? "");
  if (source.length > 200_000) {
    throw Object.assign(new Error("LaTeX source is too large"), { statusCode: 413 });
  }

  resume.latexSource = source;
  if (payload.templateId) resume.templateId = String(payload.templateId).slice(0, 60);
  if (payload.latexMode === "auto" || payload.latexMode === "manual") {
    resume.latexMode = payload.latexMode;
  } else if (source) {
    resume.latexMode = "manual";
  }

  await resume.save();

  if (payload.createVersion) {
    await createResumeVersion(userId, resume, {
      label: String(payload.label || "LaTeX save").slice(0, 120),
      reason: "manual"
    });
  }

  return resume;
};

export const regenerateResumeLatex = async (userId, resumeId, templateId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });

  const targetTemplate = String(templateId || resume.templateId || "ats-classic");
  resume.latexSource = buildLatexFromResume(resume.toObject(), targetTemplate);
  resume.templateId = targetTemplate;
  resume.latexMode = "auto";
  await resume.save();
  return resume;
};

export const ensureLatexSource = async (resume) => {
  if (!resume.latexSource || resume.latexMode === "auto") {
    return {
      ...resume.toObject(),
      latexSource: resume.latexSource || buildLatexFromResume(resume.toObject(), resume.templateId)
    };
  }
  return resume.toObject();
};

import { asyncHandler } from "../utils/asyncHandler.js";
import { Resume } from "../models/Resume.js";
import { compileLatex, getCompilerStatus, LatexCompileError } from "../services/latexService.js";
import { LATEX_TEMPLATES, buildLatexFromResume } from "../services/latexTemplates.js";
import {
  createResumeVersion,
  getResumeVersion,
  listResumeVersions,
  regenerateResumeLatex,
  restoreResumeVersion,
  saveResumeLatex
} from "../services/resumeVersionService.js";

const ownedResume = async (userId, resumeId) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw Object.assign(new Error("Resume not found"), { statusCode: 404 });
  return resume;
};

const sanitizeLog = (log) =>
  String(log || "")
    .replace(/[A-Za-z]:\\[^\s"'()]+/g, "[local-path]")
    .replace(/\/(?:tmp|var\/folders)\/[^\s"'()]+/g, "[tmp-path]")
    .slice(-6000);

export const latexTemplatesController = asyncHandler(async (req, res) => {
  res.json({ success: true, templates: LATEX_TEMPLATES, compiler: getCompilerStatus() });
});

export const compileLatexController = asyncHandler(async (req, res) => {
  const { source, resumeId, templateId } = req.body || {};

  let latexSource = typeof source === "string" ? source : "";
  let resume = null;

  if (!latexSource.trim() && resumeId) {
    resume = await ownedResume(req.user.id, resumeId);
    latexSource = buildLatexFromResume(resume.toObject(), templateId || resume.templateId);
  }

  if (!latexSource.trim()) {
    res.status(400);
    throw new Error("Provide LaTeX source or a resumeId.");
  }

  try {
    const result = await compileLatex(latexSource);

    if (resume) {
      resume.lastCompiledAt = new Date();
      if (!resume.latexSource) {
        resume.latexSource = latexSource;
        await resume.save();
      } else {
        await Resume.updateOne({ _id: resume._id, userId: req.user.id }, { $set: { lastCompiledAt: new Date() } });
      }
    }

    res.json({
      success: true,
      pdfBase64: result.pdf.toString("base64"),
      pageCount: result.pageCount,
      engine: result.engine,
      durationMs: result.durationMs,
      bytes: result.pdf.length,
      source: latexSource
    });
  } catch (error) {
    if (error instanceof LatexCompileError) {
      return res.status(error.statusCode || 422).json({
        success: false,
        code: error.code,
        message: error.message,
        errors: error.errors || [],
        log: sanitizeLog(error.log)
      });
    }
    throw error;
  }
});

export const buildLatexController = asyncHandler(async (req, res) => {
  const resume = await ownedResume(req.user.id, req.params.resumeId);
  const source = buildLatexFromResume(resume.toObject(), req.body?.templateId || resume.templateId);
  res.json({ success: true, source, templateId: req.body?.templateId || resume.templateId || "ats-classic" });
});

export const saveLatexController = asyncHandler(async (req, res) => {
  const { latexSource, templateId, latexMode, createVersion, label } = req.body || {};
  if (typeof latexSource !== "string") {
    res.status(400);
    throw new Error("latexSource is required");
  }

  const resume = await saveResumeLatex(req.user.id, req.params.resumeId, {
    latexSource,
    templateId,
    latexMode,
    createVersion,
    label
  });

  res.json({ success: true, resume });
});

export const regenerateLatexController = asyncHandler(async (req, res) => {
  const resume = await regenerateResumeLatex(req.user.id, req.params.resumeId, req.body?.templateId);
  res.json({ success: true, resume });
});

export const listResumeVersionsController = asyncHandler(async (req, res) => {
  const versions = await listResumeVersions(req.user.id, req.params.resumeId, req.query.limit);
  res.json({ success: true, versions });
});

export const getResumeVersionController = asyncHandler(async (req, res) => {
  const version = await getResumeVersion(req.user.id, req.params.resumeId, req.params.versionId);
  res.json({ success: true, version });
});

export const restoreResumeVersionController = asyncHandler(async (req, res) => {
  const resume = await restoreResumeVersion(req.user.id, req.params.resumeId, req.params.versionId);
  res.json({ success: true, resume });
});

export const createResumeVersionController = asyncHandler(async (req, res) => {
  const resume = await ownedResume(req.user.id, req.params.resumeId);
  const version = await createResumeVersion(req.user.id, resume, {
    label: req.body?.label || "Manual save",
    reason: "manual"
  });
  res.status(201).json({ success: true, version });
});

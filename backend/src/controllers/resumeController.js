import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createResume,
  deleteResume,
  getResumeById,
  listResumesByUser,
  parseAndStoreResumeFile,
  updateResume
} from "../services/resumeService.js";

const allowedResumeMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export const createResumeController = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) {
    res.status(400);
    throw new Error("Resume title is required");
  }

  const resume = await createResume(req.user.id, req.body);
  res.status(201).json({ success: true, resume });
});

export const updateResumeController = asyncHandler(async (req, res) => {
  const resume = await updateResume(req.user.id, req.params.resumeId, req.body);
  res.json({ success: true, resume });
});

export const listResumesController = asyncHandler(async (req, res) => {
  const resumes = await listResumesByUser(req.user.id);
  res.json({ success: true, resumes });
});

export const getResumeController = asyncHandler(async (req, res) => {
  const resume = await getResumeById(req.user.id, req.params.resumeId);
  res.json({ success: true, resume });
});

export const uploadResumePdfController = async (req, res, next) => {
  try {
    if (!req.file || !allowedResumeMimeTypes.has(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only PDF or DOCX files are allowed"
      });
    }

    const resume = await parseAndStoreResumeFile(req.user.id, req.params.resumeId, req.file);
    return res.json({ success: true, resume });
  } catch (error) {
    return next(error);
  }
};

export const uploadResumePdfDirectController = async (req, res, next) => {
  try {
    if (!req.file || !allowedResumeMimeTypes.has(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only PDF or DOCX files are allowed"
      });
    }

    let targetResumeId = req.body?.resumeId;

    if (!targetResumeId) {
      const resumes = await listResumesByUser(req.user.id);
      const latest = resumes?.[0];
      if (latest?._id) {
        targetResumeId = String(latest._id);
      }
    }

    if (!targetResumeId) {
      const created = await createResume(req.user.id, {
        title: "Uploaded Resume",
        summary: "",
        skills: []
      });
      targetResumeId = String(created._id);
    }

    const resume = await parseAndStoreResumeFile(req.user.id, targetResumeId, req.file);
    return res.status(201).json({ success: true, resume });
  } catch (error) {
    return next(error);
  }
};

export const deleteResumeController = asyncHandler(async (req, res) => {
  await deleteResume(req.user.id, req.params.resumeId);
  res.json({ success: true, message: "Resume deleted" });
});

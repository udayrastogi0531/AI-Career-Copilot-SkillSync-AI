import { JobDescription } from "../models/JobDescription.js";
import { DOCX_MIME, PDF_MIME, TEXT_MIME, extractDocumentText } from "./documentParser.js";
import { parseJobDescription } from "./jdParser.js";

const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const validateRawText = (value) => {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (text.length < 100) {
    throw serviceError("The job description is too short. Paste at least a few sentences.");
  }
  if (text.length > 30000) {
    throw serviceError("The job description is too long. Limit it to 30,000 characters.");
  }
  return text;
};

export const extractTextFromJobFile = async (file) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  if (!file?.buffer) throw serviceError("A job description file is required.");
  if (![PDF_MIME, DOCX_MIME, TEXT_MIME].includes(mimeType)) {
    throw serviceError("Job description uploads must be PDF, DOCX, or TXT.", 400);
  }

  const parsed = await extractDocumentText({
    buffer: file.buffer,
    mimeType,
    filename: file.originalname,
    maxBytes: 5 * 1024 * 1024
  });
  return parsed.text;
};

export const parseAndStoreJobDescription = async (
  userId,
  { rawText, sourceType = "pasted", sourceUrl = "", resumeId = null, parsed = null }
) => {
  const text = validateRawText(rawText);
  const parsedJob = parsed || parseJobDescription(text, { sourceType, url: sourceUrl });

  const record = await JobDescription.create({
    userId,
    resumeId: resumeId || null,
    title: parsedJob.title || "",
    company: parsedJob.company || "",
    location: parsedJob.location || "",
    sourceType,
    sourceUrl,
    rawText: text,
    parsed: parsedJob,
    parserVersion: parsedJob.parserVersion || ""
  });

  return { record, parsed: parsedJob };
};

export const getOwnedJobDescription = async (userId, jobDescriptionId) => {
  const record = await JobDescription.findOne({ _id: jobDescriptionId, userId });
  if (!record) throw serviceError("Job description not found", 404);
  return record;
};

export const listJobDescriptions = async (userId, limit = 25) => {
  return JobDescription.find({ userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 25, 50))
    .select("title company location sourceType sourceUrl parserVersion createdAt updatedAt resumeId");
};

export const deleteJobDescription = async (userId, jobDescriptionId) => {
  const record = await JobDescription.findOneAndDelete({ _id: jobDescriptionId, userId });
  if (!record) throw serviceError("Job description not found", 404);
  return { deleted: true };
};

/**
 * Resolve a JD from either a saved id or raw text. Ownership is always checked.
 */
export const resolveJobDescription = async (userId, { jobDescriptionId, jobDescription } = {}) => {
  if (jobDescriptionId) {
    const record = await getOwnedJobDescription(userId, jobDescriptionId);
    return {
      id: record._id,
      rawText: record.rawText,
      parsed: record.parsed,
      sourceType: record.sourceType,
      sourceUrl: record.sourceUrl
    };
  }

  if (jobDescription && String(jobDescription).trim()) {
    const text = validateRawText(jobDescription);
    return {
      id: null,
      rawText: text,
      parsed: parseJobDescription(text),
      sourceType: "pasted",
      sourceUrl: ""
    };
  }

  return null;
};

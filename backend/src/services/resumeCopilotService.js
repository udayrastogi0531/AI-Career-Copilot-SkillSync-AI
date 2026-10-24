import { Resume } from "../models/Resume.js";
import { Analysis } from "../models/Analysis.js";
import { generateResumeProposals, RESUME_ACTIONS } from "./aiService.js";
import { createResumeVersion } from "./resumeVersionService.js";
import { buildLatexFromResume } from "./latexTemplates.js";
import { normalizeSkill } from "../utils/skillDictionary.js";

const serviceError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

export const proposeResumeChanges = async (userId, resumeId, payload = {}) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw serviceError("Resume not found", 404);

  const action = String(payload.action || "").trim();
  if (!RESUME_ACTIONS.includes(action)) {
    throw serviceError(`action must be one of: ${RESUME_ACTIONS.join(", ")}`);
  }

  const proseActions = new Set(["tailor_to_job", "improve_bullet", "missing_keywords", "shorten_one_page"]);
  const jobDescription = String(payload.jobDescription || "").trim();
  if (proseActions.has(action) && !jobDescription && action !== "improve_bullet") {
    // tailor / keywords genuinely need a JD; shortens can work without one.
    if (action !== "shorten_one_page") {
      throw serviceError("A job description is required for this action.");
    }
  }
  if (action === "improve_bullet" && !String(payload.selectedText || "").trim()) {
    throw serviceError("Select the bullet you want to improve first.");
  }
  if (action === "explain_latex" && !String(payload.latexLog || "").trim()) {
    throw serviceError("Compile the document first so there is a LaTeX error log to explain.");
  }

  const result = await generateResumeProposals({
    resume: resume.toObject(),
    action,
    selectedText: payload.selectedText,
    jobDescription,
    latexLog: payload.latexLog
  });

  await Analysis.create({
    userId,
    resumeId,
    analysisType: "resume-improve",
    jobDescription,
    result: {
      action,
      proposals: result.proposals,
      warnings: result.warnings,
      applied: false
    }
  });

  return {
    ...result,
    action,
    resumeId: String(resume._id),
    canonicalResume: resume.toObject()
  };
};

const replaceOnce = (haystack, before, after) => {
  const source = String(haystack || "");
  const needle = String(before || "");
  if (!needle) return null;
  if (source.trim() === needle.trim()) return after;
  if (!source.includes(needle)) return null;
  return source.replace(needle, after);
};

const applyToArrayField = (resume, section, proposal) => {
  const collection = section === "experience" ? resume.experience : resume.projects;
  const index = Number(proposal.index);
  if (!Number.isInteger(index) || index < 0 || index >= collection.length) {
    return { ok: false, reason: `Index ${proposal.index} is out of range for ${section}.` };
  }

  const entry = collection[index];
  if (proposal.before) {
    const replaced = replaceOnce(entry.description, proposal.before, proposal.after);
    if (replaced !== null) {
      entry.description = replaced;
      return { ok: true };
    }
    if (entry.description && String(entry.description).trim() === String(proposal.before).trim()) {
      entry.description = proposal.after;
      return { ok: true };
    }
    return { ok: false, reason: `The original text for ${section}[${index}] was not found; the resume may have changed.` };
  }

  entry.description = proposal.after;
  return { ok: true };
};

/**
 * Apply only proposals the user explicitly approved. Every mutation is
 * validated against the current document; no request body is trusted as a
 * whole resume update.
 */
export const applyResumeProposals = async (userId, resumeId, payload = {}) => {
  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) throw serviceError("Resume not found", 404);

  const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
  if (!proposals.length) throw serviceError("No approved proposals were supplied.");
  if (proposals.length > 20) throw serviceError("Too many proposals in one request.");

  const applied = [];
  const skipped = [];

  for (const raw of proposals) {
    const section = String(raw?.section || "").toLowerCase();
    const after = String(raw?.after || "").trim();
    const before = String(raw?.before || "").trim();

    if (!after) {
      skipped.push({ section, reason: "Empty replacement text." });
      continue;
    }
    if (after.length > 4000) {
      skipped.push({ section, reason: "Replacement text is too long." });
      continue;
    }

    if (section === "summary") {
      if (before && resume.summary && String(resume.summary).trim() !== before) {
        skipped.push({ section, reason: "The summary changed since the proposal was generated." });
        continue;
      }
      resume.summary = after;
      applied.push({ section });
      continue;
    }

    if (section === "skills") {
      const newSkills = after
        .split(/[,\n;]+/)
        .map((skill) => normalizeSkill(skill) || skill.trim())
        .filter(Boolean);
      const existing = new Set((resume.skills || []).map((skill) => String(skill).toLowerCase()));
      for (const skill of newSkills) {
        if (!existing.has(skill.toLowerCase())) {
          resume.skills.push(skill);
          existing.add(skill.toLowerCase());
        }
      }
      applied.push({ section, added: newSkills });
      continue;
    }

    if (section === "experience" || section === "projects") {
      const result = applyToArrayField(resume, section, { ...raw, before, after });
      if (result.ok) applied.push({ section, index: raw.index });
      else skipped.push({ section, reason: result.reason });
      continue;
    }

    if (section === "note") {
      skipped.push({ section, reason: "Explanatory notes are not applied to the resume." });
    }
  }

  if (!applied.length) {
    return { resume: resume.toObject(), applied, skipped, versionCreated: false };
  }

  await createResumeVersion(userId, resume, {
    label: "Before AI changes",
    reason: "ai-apply"
  });

  if (resume.latexMode === "auto") {
    resume.latexSource = buildLatexFromResume(resume.toObject(), resume.templateId || "ats-classic");
  }

  await resume.save();

  return {
    resume: resume.toObject(),
    applied,
    skipped,
    versionCreated: true,
    latexRegenerated: resume.latexMode === "auto"
  };
};

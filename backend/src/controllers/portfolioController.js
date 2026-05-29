import { asyncHandler } from "../utils/asyncHandler.js";
import { Resume } from "../models/Resume.js";

export const generatePortfolioController = asyncHandler(async (req, res) => {
  const { resumeId } = req.body;
  if (!resumeId) {
    res.status(400);
    throw new Error("resumeId is required");
  }

  const resume = await Resume.findOne({ _id: resumeId, userId: req.user.id });
  if (!resume) {
    res.status(404);
    throw new Error("Resume not found");
  }

  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${resume.fullName || "Portfolio"}</title></head><body style="font-family:Arial,sans-serif;max-width:900px;margin:20px auto;color:#0f172a"><h1>${resume.fullName || "Your Name"}</h1><p>${resume.email || ""} ${resume.phone ? `| ${resume.phone}` : ""}</p><h2>Summary</h2><p>${resume.summary || ""}</p><h2>Skills</h2><ul>${(resume.skills || []).map((s) => `<li>${s}</li>`).join("")}</ul></body></html>`;

  res.json({
    success: true,
    portfolio: {
      title: `${resume.fullName || "Portfolio"} Portfolio`,
      html
    }
  });
});

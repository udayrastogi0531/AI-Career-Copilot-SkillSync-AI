import { JobApplication } from "../models/JobApplication.js";

export const createJobApplication = async (userId, payload) => {
  const record = await JobApplication.create({
    userId,
    company: payload.company,
    role: payload.role,
    status: payload.status || "applied",
    date: payload.date || new Date(),
    jobUrl: payload.jobUrl || "",
    description: payload.description || "",
    notes: payload.notes || ""
  });

  return record;
};

export const listJobApplications = async (userId) => {
  const jobs = await JobApplication.find({ userId }).sort({ updatedAt: -1 });
  return jobs.map((job) => {
    const ageDays = Math.floor((Date.now() - new Date(job.date).getTime()) / (1000 * 60 * 60 * 24));
    const reminderDue = job.status === "applied" && ageDays >= 7;

    return {
      ...job.toObject(),
      reminder_due: reminderDue,
      follow_up_suggestion: buildFollowUpSuggestion(job.status, ageDays)
    };
  });
};

export const updateJobApplication = async (userId, jobId, payload) => {
  const record = await JobApplication.findOne({ _id: jobId, userId });
  if (!record) {
    throw new Error("Job entry not found");
  }

  if (payload.company !== undefined) record.company = String(payload.company || "").trim();
  if (payload.role !== undefined) record.role = String(payload.role || "").trim();
  if (payload.status !== undefined) record.status = payload.status;
  if (payload.date !== undefined) record.date = payload.date;
  if (payload.jobUrl !== undefined) record.jobUrl = String(payload.jobUrl || "").trim();
  if (payload.description !== undefined) record.description = String(payload.description || "").trim();
  if (payload.notes !== undefined) record.notes = String(payload.notes || "").trim();

  await record.save();
  return record;
};

export const deleteJobApplication = async (userId, jobId) => {
  const deleted = await JobApplication.findOneAndDelete({ _id: jobId, userId });
  if (!deleted) {
    throw new Error("Job entry not found");
  }
  return { deleted: true };
};

const buildFollowUpSuggestion = (status, ageDays) => {
  if (status === "applied" && ageDays >= 7) {
    return "Send a polite follow-up email to recruiter and highlight role-fit achievements.";
  }
  if (status === "interview") {
    return "Prepare company-specific stories and send thank-you note within 24 hours.";
  }
  if (status === "offer") {
    return "Review compensation, growth path, and role scope before accepting.";
  }
  if (status === "rejected") {
    return "Ask for feedback and refine missing skills in your roadmap.";
  }
  return "Keep updating status and set next action for this application.";
};

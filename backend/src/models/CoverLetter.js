import mongoose from "mongoose";

const coverLetterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      required: true,
      index: true
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDescription",
      default: null
    },
    tone: {
      type: String,
      enum: ["professional", "concise", "technical", "enthusiastic"],
      default: "professional"
    },
    role: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    jobDescription: { type: String, default: "" },
    content: { type: String, required: true },
    highlights: [{ type: String }],
    model: { type: String, default: "" }
  },
  { timestamps: true }
);

coverLetterSchema.index({ userId: 1, createdAt: -1 });

export const CoverLetter = mongoose.model("CoverLetter", coverLetterSchema);

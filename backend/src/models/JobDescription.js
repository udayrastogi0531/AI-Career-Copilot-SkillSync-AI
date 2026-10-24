import mongoose from "mongoose";

const jobDescriptionSchema = new mongoose.Schema(
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
      default: null,
      index: true
    },
    title: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    sourceType: {
      type: String,
      enum: ["pasted", "upload", "url"],
      default: "pasted"
    },
    sourceUrl: { type: String, trim: true, default: "" },
    rawText: { type: String, required: true },
    parsed: { type: mongoose.Schema.Types.Mixed, required: true },
    parserVersion: { type: String, default: "" }
  },
  { timestamps: true }
);

jobDescriptionSchema.index({ userId: 1, createdAt: -1 });

export const JobDescription = mongoose.model("JobDescription", jobDescriptionSchema);

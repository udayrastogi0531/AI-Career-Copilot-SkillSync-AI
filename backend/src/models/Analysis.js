import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
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
    analysisType: {
      type: String,
      enum: ["resume", "job-match", "skill-gap", "resume-improve", "cover-letter", "workflow"],
      required: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    jobDescription: {
      type: String,
      default: ""
    },
    jobDescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobDescription",
      default: null
    },
    engineVersion: { type: String, default: "" },
    inputHash: { type: String, default: "", index: true }
  },
  { timestamps: true }
);

analysisSchema.index({ userId: 1, analysisType: 1, createdAt: -1 });

export const Analysis = mongoose.model("Analysis", analysisSchema);

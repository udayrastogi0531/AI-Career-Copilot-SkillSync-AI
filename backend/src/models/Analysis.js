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
      enum: ["resume", "job-match", "resume-improve", "cover-letter"],
      required: true
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    jobDescription: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

analysisSchema.index({ userId: 1, analysisType: 1, createdAt: -1 });

export const Analysis = mongoose.model("Analysis", analysisSchema);

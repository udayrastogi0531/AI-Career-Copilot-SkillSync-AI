import mongoose from "mongoose";

const resumeVersionSchema = new mongoose.Schema(
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
    label: {
      type: String,
      trim: true,
      default: "Manual save"
    },
    reason: {
      type: String,
      enum: ["manual", "autosave", "ai-apply", "restore", "import", "template-change"],
      default: "manual"
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    latexSource: {
      type: String,
      default: ""
    },
    templateId: {
      type: String,
      default: "ats-classic"
    }
  },
  { timestamps: true }
);

resumeVersionSchema.index({ userId: 1, resumeId: 1, createdAt: -1 });

export const ResumeVersion = mongoose.model("ResumeVersion", resumeVersionSchema);

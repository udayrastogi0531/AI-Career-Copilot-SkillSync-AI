import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    company: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      // "applied" / "interview" / "offer" are kept for existing records;
      // the tracker UI uses the richer values below.
      enum: [
        "saved",
        "applied",
        "interviewing",
        "interview",
        "offered",
        "offer",
        "rejected"
      ],
      default: "saved",
      index: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    jobUrl: {
      type: String,
      trim: true,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

export const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);

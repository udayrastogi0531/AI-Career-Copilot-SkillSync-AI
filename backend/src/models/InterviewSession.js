import mongoose from "mongoose";

const answerReviewSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 10 },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    feedback: { type: String, default: "" }
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
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
    company: { type: String, trim: true, default: "" },
    role: { type: String, trim: true, default: "" },
    interviewMode: { type: String, trim: true, default: "behavioral" },
    questions: [{ type: String, required: true }],
    questionMeta: [
      {
        question: { type: String, required: true },
        difficulty: {
          type: String,
          enum: ["Easy", "Medium", "Hard"],
          default: "Medium"
        }
      }
    ],
    adaptiveMode: {
      type: String,
      default: "Adaptive interview system"
    },
    answers: [{ type: String, default: "" }],
    evaluation: {
      overallScore: { type: Number, min: 0, max: 10 },
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      perQuestion: [answerReviewSchema]
    },
    improvementLoop: [
      {
        previousScore: { type: Number, min: 0, max: 10 },
        newScore: { type: Number, min: 0, max: 10 },
        summary: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

export const InterviewSession = mongoose.model("InterviewSession", interviewSessionSchema);

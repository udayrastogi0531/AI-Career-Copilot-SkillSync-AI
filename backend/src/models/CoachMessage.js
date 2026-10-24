import mongoose from "mongoose";

const coachMessageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    content: { type: String, required: true },
    actions: [{ type: String }],
    citations: [
      {
        title: String,
        url: String,
        quote: String
      }
    ],
    retrieval: { type: String, default: "" }
  },
  { timestamps: true }
);

coachMessageSchema.index({ userId: 1, createdAt: -1 });

export const CoachMessage = mongoose.model("CoachMessage", coachMessageSchema);

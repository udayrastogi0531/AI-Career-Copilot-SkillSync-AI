import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String, default: "" },
    stats: {
      totalResumes: {
        type: Number,
        default: 0
      },
      avgATSScore: {
        type: Number,
        default: 0
      },
      interviewsTaken: {
        type: Number,
        default: 0
      }
    },
    personalization: {
      experienceLevel: {
        type: String,
        enum: ["student", "junior", "mid", "senior"],
        default: "junior"
      },
      targetRoles: [{ type: String, trim: true }],
      targetIndustries: [{ type: String, trim: true }],
      focusSkills: [{ type: String, trim: true }]
    },
    profile: {
      photoUrl: { type: String, trim: true, default: "" },
      headline: { type: String, trim: true, default: "" },
      bio: { type: String, trim: true, default: "" },
      location: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      linkedin: { type: String, trim: true, default: "" },
      github: { type: String, trim: true, default: "" },
      portfolio: { type: String, trim: true, default: "" },
      skills: [{ type: String, trim: true }],
      education: [{ type: String, trim: true }],
      experience: [{ type: String, trim: true }],
      careerGoal: { type: String, trim: true, default: "" }
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);

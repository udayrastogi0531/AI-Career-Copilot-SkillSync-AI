import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema(
  {
    company: { type: String, trim: true },
    role: { type: String, trim: true },
    startDate: { type: String, trim: true },
    endDate: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true },
    degree: { type: String, trim: true },
    fieldOfStudy: { type: String, trim: true },
    graduationYear: { type: String, trim: true }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    technologies: [{ type: String, trim: true }]
  },
  { _id: false }
);

const certificationSchema = new mongoose.Schema(
  {
    credential: { type: String, trim: true },
    issuer: { type: String, trim: true },
    issueDate: { type: String, trim: true },
    expirationDate: { type: String, trim: true }
  },
  { _id: false }
);

const linkSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    url: { type: String, trim: true }
  },
  { _id: false }
);

const achievementSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    date: { type: String, trim: true }
  },
  { _id: false }
);

const publicationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    publisher: { type: String, trim: true },
    date: { type: String, trim: true },
    link: { type: String, trim: true }
  },
  { _id: false }
);

const volunteerSchema = new mongoose.Schema(
  {
    organization: { type: String, trim: true },
    role: { type: String, trim: true },
    date: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  { _id: false }
);

const hackathonSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    project: { type: String, trim: true },
    date: { type: String, trim: true },
    award: { type: String, trim: true }
  },
  { _id: false }
);

const languageSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    level: { type: String, trim: true }
  },
  { _id: false }
);

const awardSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    issuer: { type: String, trim: true },
    date: { type: String, trim: true }
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    summary: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    experience: [experienceSchema],
    education: [educationSchema],
    projects: [projectSchema],
    certifications: [certificationSchema],
    links: [linkSchema],
    achievements: [achievementSchema],
    publications: [publicationSchema],
    volunteer: [volunteerSchema],
    hackathons: [hackathonSchema],
    languages: [languageSchema],
    awards: [awardSchema],
    parsedText: { type: String, default: "" }
  },
  { timestamps: true }
);

export const Resume = mongoose.model("Resume", resumeSchema);

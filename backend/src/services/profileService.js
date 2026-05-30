import { User } from "../models/User.js";

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select("name email isVerified stats personalization profile createdAt updatedAt");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const updateProfile = async (userId, payload) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (payload.name !== undefined) {
    user.name = String(payload.name || "").trim() || user.name;
  }

  const personalization = payload.personalization || {};

  if (personalization.experienceLevel !== undefined) {
    user.personalization.experienceLevel = personalization.experienceLevel;
  }
  if (personalization.targetRoles !== undefined) {
    user.personalization.targetRoles = normalizeStringArray(personalization.targetRoles);
  }
  if (personalization.targetIndustries !== undefined) {
    user.personalization.targetIndustries = normalizeStringArray(personalization.targetIndustries);
  }
  if (personalization.focusSkills !== undefined) {
    user.personalization.focusSkills = normalizeStringArray(personalization.focusSkills);
  }

  const profile = payload.profile || {};

  if (profile.photoUrl !== undefined) {
    user.profile.photoUrl = String(profile.photoUrl || "").trim();
  }
  if (profile.headline !== undefined) {
    user.profile.headline = String(profile.headline || "").trim();
  }
  if (profile.bio !== undefined) {
    user.profile.bio = String(profile.bio || "").trim();
  }
  if (profile.location !== undefined) {
    user.profile.location = String(profile.location || "").trim();
  }
  if (profile.phone !== undefined) {
    user.profile.phone = String(profile.phone || "").trim();
  }
  if (profile.linkedin !== undefined) {
    user.profile.linkedin = String(profile.linkedin || "").trim();
  }
  if (profile.github !== undefined) {
    user.profile.github = String(profile.github || "").trim();
  }
  if (profile.portfolio !== undefined) {
    user.profile.portfolio = String(profile.portfolio || "").trim();
  }
  if (profile.skills !== undefined) {
    user.profile.skills = normalizeStringArray(profile.skills);
  }
  if (profile.education !== undefined) {
    user.profile.education = normalizeStringArray(profile.education);
  }
  if (profile.experience !== undefined) {
    user.profile.experience = normalizeStringArray(profile.experience);
  }
  if (profile.careerGoal !== undefined) {
    user.profile.careerGoal = String(profile.careerGoal || "").trim();
  }

  await user.save();
  return user;
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

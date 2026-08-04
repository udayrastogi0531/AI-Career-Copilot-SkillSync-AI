import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

const createAuthError = (message, statusCode = 400, code = undefined) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

export const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw createAuthError("An account with this email address already exists. Please log in.", 400, "EMAIL_EXISTS");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const user = await User.create({
    name: String(name || "").trim(),
    email: normalizedEmail,
    password: hashedPassword,
    isVerified: false,
    verificationToken: token
  });

  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw createAuthError("Invalid email address or password", 401, "INVALID_CREDENTIALS");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw createAuthError("Invalid email address or password", 401, "INVALID_CREDENTIALS");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTION MODE: Re-enable this block after custom domain is verified in
  //   Resend (https://resend.com/domains) and RESEND_FROM_EMAIL is set in .env
  //   Uncomment the block below to enforce mandatory email verification on login.
  // ─────────────────────────────────────────────────────────────────────────
  // if (!user.isVerified) {
  //   throw createAuthError("Please verify your email address before logging in.", 403, "EMAIL_UNVERIFIED");
  // }
  // ─────────────────────────────────────────────────────────────────────────

  return buildAuthResponse(user);
};

export const createPasswordResetToken = async ({ email }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw createAuthError("Account not found for this email address", 404, "USER_NOT_FOUND");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  return { rawToken, user };
};

export const validateResetToken = async ({ token }) => {
  const hashedToken = crypto.createHash("sha256").update(String(token || "")).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() }
  });

  if (!user) {
    throw createAuthError("Reset token is invalid or has expired", 400, "INVALID_TOKEN");
  }

  return user;
};

export const resetPassword = async ({ token, newPassword }) => {
  if (String(newPassword || "").length < 8) {
    throw createAuthError("Password must be at least 8 characters long", 400, "WEAK_PASSWORD");
  }

  const user = await validateResetToken({ token });
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = "";
  user.resetPasswordExpires = null;
  await user.save();

  return buildAuthResponse(user);
};

export const buildAuthResponse = (user) => {
  const token = jwt.sign({ userId: user._id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isVerified: user.isVerified
    },
    token
  };
};


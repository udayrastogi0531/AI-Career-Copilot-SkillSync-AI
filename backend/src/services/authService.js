import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

export const registerUser = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(32).toString("hex");
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    isVerified: false,
    verificationToken: token
  });

  return { user, token };
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTION MODE: Re-enable this block after custom domain is verified in
  //   Resend (https://resend.com/domains) and RESEND_FROM_EMAIL is set in .env
  //   Uncomment the block below to enforce mandatory email verification on login.
  // ─────────────────────────────────────────────────────────────────────────
  // if (!user.isVerified) {
  //   const error = new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
  //   error.statusCode = 403;
  //   error.code = "EMAIL_UNVERIFIED";
  //   throw error;
  // }
  // ─────────────────────────────────────────────────────────────────────────

  return buildAuthResponse(user);
};

export const createPasswordResetToken = async ({ email }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error("Account not found for this email");
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
    throw new Error("Reset token is invalid or has expired");
  }

  return user;
};

export const resetPassword = async ({ token, newPassword }) => {
  if (String(newPassword || "").length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }

  const user = await validateResetToken({ token });
  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = "";
  user.resetPasswordExpires = null;
  await user.save();

  return buildAuthResponse(user);
};

const createAuthError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
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
      isVerified: user.isVerified  // Required for frontend verification banner
    },
    token
  };
};

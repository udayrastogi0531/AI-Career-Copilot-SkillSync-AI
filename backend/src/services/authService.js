import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

const googleClient = new OAuth2Client();

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

  if (!user.isVerified) {
    const error = new Error("Please verify your email address before logging in. Check your inbox for the verification link.");
    error.statusCode = 403;
    error.code = "EMAIL_UNVERIFIED";
    throw error;
  }

  return buildAuthResponse(user);
};

export const loginWithGoogle = async ({ idToken }) => {
  if (!idToken) {
    throw createAuthError("Google token is required", 400, "GOOGLE_TOKEN_MISSING");
  }

  if (!env.googleClientId) {
    throw createAuthError("Google auth is not configured on server", 503, "GOOGLE_AUTH_NOT_CONFIGURED");
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId
    });
  } catch {
    throw createAuthError("Invalid Google token", 401, "GOOGLE_TOKEN_INVALID");
  }

  const payload = ticket.getPayload();
  const email = String(payload?.email || "").toLowerCase().trim();
  const name = String(payload?.name || "Google User").trim();

  if (!email) {
    throw createAuthError("Google account email is unavailable", 400, "GOOGLE_EMAIL_MISSING");
  }

  let user = await User.findOne({ email });

  if (!user) {
    const randomPassword = await bcrypt.hash(`${email}:${Date.now()}`, 8);
    user = await User.create({
      name,
      email,
      password: randomPassword,
      authProvider: "google",
      isVerified: true
    });
  } else if (!user.authProvider) {
    user.authProvider = "local";
    user.isVerified = true;
    await user.save();
  } else if (!user.isVerified) {
    user.isVerified = true;
    await user.save();
  }

  return buildAuthResponse(user);
};

export const createPasswordResetToken = async ({ email }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error("Account not found for this email");
  }

  if (user.authProvider === "google") {
    throw new Error("This account uses Google sign-in. Use Google to log in.");
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

const buildAuthResponse = (user) => {
  const token = jwt.sign({ userId: user._id }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email
    },
    token
  };
};

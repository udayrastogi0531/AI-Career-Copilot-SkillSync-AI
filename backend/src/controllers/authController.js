import crypto from "crypto";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import {
  createPasswordResetToken,
  loginUser,
  registerUser,
  resetPassword,
  validateResetToken
} from "../services/authService.js";
import { sendEmail } from "../utils/emailSender.js";

// Phase 1 & 2: Signup & Email Verification Trigger
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  if (String(password).length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters long");
  }

  const { user, token } = await registerUser({ name, email, password });
  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;

  // Send real-time verification email via Resend
  try {
    await sendEmail({
      to: email,
      subject: "Verify Your Email Address — AI Career Copilot ✉️",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #0ea5e9; font-weight: 800; margin-bottom: 20px;">Welcome to AI Career Copilot! 🎉</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Thank you for registering, ${name}! Please verify your email address to unlock your personal career dashboard and AI scoring engines:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: bold; color: #ffffff; background-color: #0ea5e9; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);">Verify Email Address</a>
          </div>
          <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 20px; border-t: 1px solid #f1f5f9; pt-16;">
            If the button above does not work, copy and paste this URL into your browser:<br/>
            <a href="${verifyUrl}" style="color: #0ea5e9;">${verifyUrl}</a>
          </p>
          <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-top: 24px;">
            Best regards,<br/><strong>The AI Career Copilot Team</strong>
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error("Signup verification email failed to dispatch:", err.message);
    console.log("---------------- DEV MODE VERIFICATION LINK ----------------");
    console.log(`[Verification URL]: ${verifyUrl}`);
    console.log("------------------------------------------------------------");
  }

  res.status(201).json({
    success: true,
    message: "Registration successful! A verification link has been dispatched to your email address. Please verify your account before logging in."
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const authPayload = await loginUser({ email, password });
  res.json({ success: true, ...authPayload });
});

// Phase 2: verify account controller
export const verifyEmailController = asyncHandler(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    res.status(400);
    throw new Error("Verification token is required");
  }

  const user = await User.findOne({ verificationToken: token });
  if (!user) {
    res.status(400);
    throw new Error("Verification token is invalid or has expired");
  }

  user.isVerified = true;
  user.verificationToken = "";
  await user.save();

  // Send beautiful onboarding Welcome email after successful verification
  try {
    await sendEmail({
      to: user.email,
      subject: "Your Account is Verified! Let's get you Apply-Ready 🚀",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #10b981; font-weight: 800; margin-bottom: 20px;">Email Verified Successfully! 🎉</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Congratulations, ${user.name}! Your account is now fully verified. You can now log in and access your personal career suite:
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #0ea5e9; padding: 15px; margin: 24px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #475569; font-weight: bold;">Unlock your unified Career Cockpit:</p>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
              <li>Upload resume PDF & scan ATS parser keywords.</li>
              <li>Toggle skills focus & industry verticals.</li>
              <li>Bridge target gaps week-by-week.</li>
              <li>Train in voice simulated interviews.</li>
            </ul>
          </div>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${env.clientUrl}/auth" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: bold; color: #ffffff; background-color: #10b981; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);">Login to Dashboard</a>
          </div>
          <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-top: 24px;">
            Best regards,<br/><strong>The AI Career Copilot Team</strong>
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error("Welcome verification follow-up failed to send:", err.message);
  }

  res.json({
    success: true,
    message: "Email verified successfully! You can now log in."
  });
});

// Phase 2: Resend Verification Controller
export const resendVerificationController = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    res.status(404);
    throw new Error("No account found for this email address");
  }

  if (user.isVerified) {
    res.status(400);
    throw new Error("This email is already verified. Please log in.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  user.verificationToken = token;
  await user.save();

  const verifyUrl = `${env.clientUrl}/verify-email?token=${token}`;

  try {
    await sendEmail({
      to: user.email,
      subject: "Verify Your Email Address — AI Career Copilot ✉️",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #0ea5e9; font-weight: 800; margin-bottom: 20px;">Email Verification</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            You requested a new verification link. Please click the button below to verify your email address:
          </p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: bold; color: #ffffff; background-color: #0ea5e9; text-decoration: none; border-radius: 8px;">Verify Email Address</a>
          </div>
          <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 24px;">
            Best regards,<br/><strong>The AI Career Copilot Team</strong>
          </p>
        </div>
      `
    });
  } catch (err) {
    console.error("Resend verification email failed to dispatch:", err.message);
    console.log("---------------- DEV MODE VERIFICATION LINK ----------------");
    console.log(`[Verification URL]: ${verifyUrl}`);
    console.log("------------------------------------------------------------");
  }

  res.json({
    success: true,
    message: "A fresh verification link has been dispatched to your inbox!"
  });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400);
    throw new Error("Email is required");
  }

  const { rawToken, user } = await createPasswordResetToken({ email });
  const resetUrl = `${env.clientUrl}/reset-password?token=${rawToken}`;

  // Send real-time password-reset email via Resend
  await sendEmail({
    to: user.email,
    subject: "Reset Your AI Career Copilot Password 🔑",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #0ea5e9; font-weight: 800; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset your AI Career Copilot password. Click the button below to proceed:
        </p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: bold; color: #ffffff; background-color: #0ea5e9; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 20px;">
          If you did not make this request, you can safely ignore this email. This link is secure and expires in 1 hour.
        </p>
        <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-top: 24px;">
          Best regards,<br/><strong>The AI Career Copilot Team</strong>
        </p>
      </div>
    `
  });

  res.json({
    success: true,
    message: "Password reset link generated and sent to email",
    resetUrl,
    email: user.email
  });
});

export const validateResetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  await validateResetToken({ token });
  res.json({ success: true, valid: true });
});

export const resetPasswordController = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    res.status(400);
    throw new Error("Token and password are required");
  }

  const authPayload = await resetPassword({ token, newPassword: password });
  const userEmail = authPayload.user?.email;

  // Phase 1: Password Reset confirmation notification
  if (userEmail) {
    try {
      await sendEmail({
        to: userEmail,
        subject: "Your Password was Successfully Updated 🛡️",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #10b981; font-weight: 800; margin-bottom: 20px;">Password Reset Confirmed</h2>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              Hello,
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              This email confirms that your AI Career Copilot password was successfully changed. You can now securely log back in using your new credentials.
            </p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${env.clientUrl}/auth" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: bold; color: #ffffff; background-color: #10b981; text-decoration: none; border-radius: 8px;">Login to Account</a>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-top: 20px;">
              If you did not perform this change, please contact our support team immediately.
            </p>
            <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-top: 24px;">
              Best regards,<br/><strong>The AI Career Copilot Team</strong>
            </p>
          </div>
        `
      });
    } catch (err) {
      console.error("Password reset confirmation email failed to send:", err.message);
    }
  }

  res.json({ success: true, ...authPayload });
});

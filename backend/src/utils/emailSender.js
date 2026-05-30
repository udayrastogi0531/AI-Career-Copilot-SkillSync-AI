import axios from "axios";
import { env } from "../config/env.js";

/**
 * Sends a transactional email via Resend HTTP API.
 *
 * ⚠️  IMPORTANT — RESEND SENDER DOMAIN RESTRICTION:
 *    When using `onboarding@resend.dev` (the Resend shared default sender),
 *    Resend ONLY delivers emails to the single email address that owns
 *    the Resend account (sandbox restriction). All other recipients are silently
 *    rejected or bounced with a 403 Validation Error.
 *
 *    To send to ANY user, you MUST verify a custom domain in the Resend dashboard
 *    and set RESEND_FROM_EMAIL in your .env to an address on that domain.
 *    e.g.  RESEND_FROM_EMAIL=noreply@yourdomain.com
 *
 * @param {Object} options - Sending parameters.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.html - HTML formatted email body.
 */
export const sendEmail = async ({ to, subject, html }) => {
  const apiKey = env.resendApiKey;
  const fromEmail = env.resendFromEmail;

  // ── Debug logging (always emitted — helps trace delivery issues) ──
  console.log("┌─────────────────────────────────────────────────────");
  console.log("│ [Email] Attempting to send transactional email");
  console.log(`│ [Email] Recipient : ${to}`);
  console.log(`│ [Email] Subject   : ${subject}`);
  console.log(`│ [Email] Sender    : ${fromEmail || "onboarding@resend.dev (DEFAULT — RESTRICTED)"}`);
  console.log(`│ [Email] API Key   : ${apiKey ? "SET ✓" : "MISSING ✗ — emails will not be sent"}`);
  console.log("└─────────────────────────────────────────────────────");

  if (!apiKey) {
    console.log("◆ [MOCK MODE] RESEND_API_KEY not set. Logging email instead of sending.");
    console.log(`  To      : ${to}`);
    console.log(`  Subject : ${subject}`);
    return { success: true, mock: true };
  }

  // Warn loudly if using the restricted default sender
  if (!fromEmail || fromEmail.includes("resend.dev")) {
    console.warn("⚠️  [Resend] WARNING: Using onboarding@resend.dev as sender.");
    console.warn("⚠️  [Resend] This restricts delivery to the Resend account owner email ONLY.");
    console.warn("⚠️  [Resend] Other users will NOT receive emails.");
    console.warn("⚠️  [Resend] FIX: Verify a custom domain at https://resend.com/domains");
    console.warn("⚠️  [Resend] Then set RESEND_FROM_EMAIL=noreply@yourdomain.com in .env");
  }

  const senderAddress = fromEmail && !fromEmail.includes("resend.dev")
    ? fromEmail
    : "onboarding@resend.dev";

  try {
    const { data } = await axios.post(
      "https://api.resend.com/emails",
      {
        from: `AI Career Copilot <${senderAddress}>`,
        to: [to],
        subject,
        html
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✓ [Resend Success] Email accepted. Recipient: ${to} | Message ID: ${data.id}`);
    return { success: true, data };

  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    const statusCode = error.response?.status;

    console.error(`✗ [Resend Error] Failed to deliver email to: ${to}`);
    console.error(`  Status  : ${statusCode}`);
    console.error(`  Details : ${JSON.stringify(errorDetails)}`);

    // Provide a specific, actionable message for the domain sandbox restriction
    if (statusCode === 403 || JSON.stringify(errorDetails).includes("testing emails")) {
      console.error("──────────────────────────────────────────────────────────");
      console.error("  ROOT CAUSE: Resend domain restriction (sandbox mode).");
      console.error("  You are using onboarding@resend.dev without a verified domain.");
      console.error("  Resend ONLY sends to the account owner's email in this state.");
      console.error("  RESOLUTION:");
      console.error("    1. Go to https://resend.com/domains");
      console.error("    2. Add and verify your custom domain (e.g. yourdomain.com)");
      console.error("    3. Set RESEND_FROM_EMAIL=noreply@yourdomain.com in backend/.env");
      console.error("──────────────────────────────────────────────────────────");
    }

    throw new Error(error.response?.data?.message || "Email delivery failed via Resend");
  }
};

import axios from "axios";
import { env } from "../config/env.js";

/**
 * Sends a transactional email via Resend SMTP HTTP API.
 * @param {Object} options - Sending parameters.
 * @param {string} options.to - Recipient email address.
 * @param {string} options.subject - Email subject line.
 * @param {string} options.html - HTML formatted email body.
 */
export const sendEmail = async ({ to, subject, html }) => {
  const apiKey = env.resendApiKey;
  if (!apiKey) {
    console.log("---------------- MOCK EMAIL DELIVERY ----------------");
    console.log(`[Mock Send] To: ${to}`);
    console.log(`[Mock Send] Subject: ${subject}`);
    console.log(`[Mock Send] Content: ${html}`);
    console.log("-----------------------------------------------------");
    return { success: true, mock: true };
  }

  try {
    const { data } = await axios.post(
      "https://api.resend.com/emails",
      {
        from: "AI Career Copilot <onboarding@resend.dev>",
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
    console.log(`[Resend Success] Email sent to ${to}. Message ID:`, data.id);
    return { success: true, data };
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error(`[Resend Error] Email delivery to ${to} failed:`, errorDetails);
    throw new Error(error.response?.data?.message || "Email delivery failed via Resend");
  }
};

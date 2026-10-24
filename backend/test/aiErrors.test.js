import test from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-key";
process.env.MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-value-0123456789";

const { classifyProviderFailure } = await import("../src/services/aiService.js");

// Verbatim shape of the free-tier daily-quota response from Gemini.
const DAILY_QUOTA_MESSAGE = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash, description: Generate content requests per day limit exceeded on Free Tier. Please retry in 15h38.300875623s.`;

test("an exhausted daily quota is a rate limit, not a bad API key", () => {
  const failure = classifyProviderFailure(DAILY_QUOTA_MESSAGE);
  assert.equal(failure.code, "AI_RATE_LIMITED");
  assert.equal(failure.statusCode, 429);
  assert.match(failure.message, /quota/i);
});

test("a per-minute rate limit keeps the retry message", () => {
  const failure = classifyProviderFailure(
    "[GoogleGenerativeAI Error]: [429 Too Many Requests] Resource has been exhausted (e.g. check quota)."
  );
  assert.equal(failure.code, "AI_RATE_LIMITED");
  assert.match(failure.message, /try again|rate limit/i);
});

test("an invalid key is reported as an auth failure", () => {
  const failure = classifyProviderFailure(
    "[GoogleGenerativeAI Error]: [400 Bad Request] API key not valid. Please pass a valid API key."
  );
  assert.equal(failure.code, "AI_AUTH_FAILED");
  assert.equal(failure.statusCode, 503);
});

test("permission and 403 responses are auth failures", () => {
  assert.equal(classifyProviderFailure("403 Forbidden: caller lacks permission").code, "AI_AUTH_FAILED");
  assert.equal(classifyProviderFailure("Unauthenticated").code, "AI_AUTH_FAILED");
});

test("anything else stays a generic provider failure", () => {
  const failure = classifyProviderFailure("[500 Internal Server Error] backend unavailable");
  assert.equal(failure.code, "AI_PROVIDER_FAILED");
  assert.equal(failure.statusCode, 503);
});

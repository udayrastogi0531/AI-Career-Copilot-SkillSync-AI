import axios from "axios";
import * as cheerio from "cheerio";
import { assertSafeUrl, createPinnedLookup, SafeFetchError } from "../utils/ssrfGuard.js";
import { parseJobDescription } from "./jdParser.js";

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = Number(process.env.JOB_FETCH_TIMEOUT_MS || 12000);

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9"
};

const fetchFailure = (message, code = "JD_FETCH_NEEDS_PASTE", statusCode = 422) =>
  new SafeFetchError(message, code, statusCode);

const fetchOnce = async (url) => {
  const target = await assertSafeUrl(url);
  const lookup = createPinnedLookup(target.addresses);

  let response;
  try {
    response = await axios.get(target.url, {
      timeout: FETCH_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      responseType: "text",
      validateStatus: (status) => status >= 200 && status < 400,
      headers: BROWSER_HEADERS,
      lookup,
      beforeRedirect: (options) => {
        // Never forward headers containing credentials.
        delete options.headers?.Authorization;
        delete options.headers?.Cookie;
      }
    });
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    if (error?.response?.status >= 300 && error?.response?.status < 400) {
      const location = error.response.headers?.location;
      if (!location) throw fetchFailure("The job page redirected without a destination.");
      return { redirect: new URL(location, target.url).toString() };
    }
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw fetchFailure("The job page timed out. Paste the job description instead.", "JD_FETCH_TIMEOUT");
    }
    if (error.response?.status === 403 || error.response?.status === 429) {
      throw fetchFailure(
        "The job site blocked automated access. Paste the job description instead.",
        "JD_FETCH_BLOCKED"
      );
    }
    if (error.response?.status === 404) {
      throw fetchFailure("That job posting could not be found (404).", "JD_FETCH_NOT_FOUND", 404);
    }
    throw fetchFailure("The job page could not be fetched. Paste the job description instead.", "JD_FETCH_FAILED");
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers?.location;
    if (!location) throw fetchFailure("The job page redirected without a destination.");
    return { redirect: new URL(location, target.url).toString() };
  }

  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw fetchFailure(
      "That URL does not return an HTML job posting. Paste the job description instead.",
      "JD_FETCH_NOT_HTML"
    );
  }

  const html = String(response.data || "");
  if (html.length > MAX_BYTES) {
    throw fetchFailure("The job page is too large to parse safely.", "JD_FETCH_TOO_LARGE");
  }

  return { html, finalUrl: target.url };
};

const fetchWithRedirects = async (initialUrl) => {
  let current = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const result = await fetchOnce(current);
    if (result.redirect) {
      current = result.redirect;
      continue;
    }
    return result;
  }
  throw fetchFailure("The job URL redirected too many times.", "TOO_MANY_REDIRECTS");
};

const stripHtml = (value) => {
  if (!value) return "";
  const $ = cheerio.load(String(value));
  $("script, style, noscript").remove();
  return $.text().replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
};

const findJobPosting = (data) => {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data !== "object") return null;
  const type = data["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((entry) => String(entry || "").toLowerCase() === "jobposting")) return data;
  if (Array.isArray(data["@graph"])) return findJobPosting(data["@graph"]);
  return null;
};

const extractStructuredJob = ($) => {
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i += 1) {
    const raw = $(scripts[i]).contents().text();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const posting = findJobPosting(parsed);
      if (posting) {
        const address = posting.jobLocation?.address || posting.jobLocation?.[0]?.address || {};
        const location = [address.addressLocality, address.addressRegion, address.addressCountry]
          .filter(Boolean)
          .join(", ");
        const salary = posting.baseSalary?.value
          ? `${posting.baseSalary.value.minValue || ""}${
              posting.baseSalary.value.maxValue ? `–${posting.baseSalary.value.maxValue}` : ""
            } ${posting.baseSalary.currency || ""}`.trim()
          : "";

        return {
          title: stripHtml(posting.title || ""),
          company: stripHtml(posting.hiringOrganization?.name || ""),
          location,
          employmentType: Array.isArray(posting.employmentType)
            ? posting.employmentType.join(", ")
            : String(posting.employmentType || ""),
          salary,
          description: stripHtml(posting.description || "")
        };
      }
    } catch {
      // Ignore malformed JSON-LD blocks and keep looking.
    }
  }
  return null;
};

const pickMainText = ($) => {
  $("script, style, noscript, nav, header, footer, form, svg, iframe").remove();

  const preferredSelectors = [
    "main",
    "article",
    "[class*='job-description']",
    "[class*='jobDescription']",
    "[id*='job-description']",
    "[id*='jobDescription']",
    "[class*='description']",
    "[class*='content']"
  ];

  for (const selector of preferredSelectors) {
    const candidate = $(selector).first();
    if (candidate.length) {
      const text = candidate.text().replace(/\u00a0/g, " ").trim();
      if (text.length > 300) return text;
    }
  }

  return $("body").text().replace(/\u00a0/g, " ").trim();
};

const looksBlocked = (text) => {
  const sample = String(text || "").slice(0, 4000).toLowerCase();
  return /captcha|are you a robot|access denied|enable javascript|verify you are human|cloudflare/.test(sample);
};

/**
 * Fetch and parse a public job posting.
 *
 * Throws SafeFetchError with a machine-readable code:
 *  - PRIVATE_ADDRESS / BLOCKED_HOST: SSRF protection
 *  - JD_FETCH_BLOCKED / JD_FETCH_TIMEOUT / JD_FETCH_NOT_HTML: ask user to paste
 */
export const fetchJobFromUrl = async (url) => {
  const { html, finalUrl } = await fetchWithRedirects(url);
  if (!html || html.length < 200) {
    throw fetchFailure("The job page returned almost no content. Paste the job description instead.");
  }
  if (looksBlocked(html)) {
    throw fetchFailure(
      "The job site requires a browser or CAPTCHA. Paste the job description instead.",
      "JD_FETCH_BLOCKED"
    );
  }

  const $ = cheerio.load(html);
  const structured = extractStructuredJob($);

  const metaDescription =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    "";

  const mainText = pickMainText($)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  const description = String(structured?.description || mainText || metaDescription).slice(0, 30000);
  if (description.length < 120) {
    throw fetchFailure(
      "The posting content could not be extracted (it may be rendered by JavaScript). Paste the job description instead.",
      "JD_FETCH_EMPTY"
    );
  }

  const parsed = parseJobDescription(description, {
    structured: structured || {},
    sourceType: "url",
    url: finalUrl
  });

  return {
    ...parsed,
    fetchedFrom: finalUrl,
    extraction: structured ? "json-ld" : "html"
  };
};

export { fetchFailure };

import axios from "axios";
import * as cheerio from "cheerio";

const knownSkills = [
  "javascript",
  "typescript",
  "react",
  "node",
  "node.js",
  "express",
  "mongodb",
  "sql",
  "python",
  "java",
  "aws",
  "docker",
  "kubernetes",
  "git",
  "redis",
  "graphql",
  "rest",
  "next.js",
  "tailwind",
  "html",
  "css"
];

export const fetchJobFromUrl = async (url) => {
  const normalized = normalizeUrl(url);

  const response = await axios.get(normalized, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    }
  });

  const $ = cheerio.load(response.data || "");

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("meta[name='title']").attr("content") ||
    $("h1").first().text() ||
    $("title").text() ||
    "Job Opportunity";

  const rawDescription =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    $("main").text() ||
    $("article").text() ||
    $("body").text() ||
    "";

  const description = String(rawDescription)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);

  const skills = extractSkills(description);

  return {
    title: cleanText(title),
    skills,
    description
  };
};

const normalizeUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) {
    const err = new Error("url is required");
    err.statusCode = 400;
    throw err;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    const err = new Error("Invalid URL");
    err.statusCode = 400;
    throw err;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const err = new Error("Only http/https URLs are allowed");
    err.statusCode = 400;
    throw err;
  }

  return parsed.toString();
};

const extractSkills = (description) => {
  const lower = String(description || "").toLowerCase();

  return knownSkills
    .filter((skill) => lower.includes(skill))
    .map((skill) => {
      if (skill === "node.js") return "Node.js";
      if (skill === "next.js") return "Next.js";
      return skill.charAt(0).toUpperCase() + skill.slice(1);
    });
};

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

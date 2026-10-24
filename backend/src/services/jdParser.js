import { extractSkills } from "../utils/skillDictionary.js";

export const JD_PARSER_VERSION = "1.0.0";

const SECTION_SYNONYMS = {
  summary: [
    "about the role",
    "about the job",
    "role overview",
    "job overview",
    "position overview",
    "the opportunity",
    "about this role",
    "overview",
    "summary"
  ],
  responsibilities: [
    "responsibilities",
    "what you'll do",
    "what you will do",
    "key responsibilities",
    "your responsibilities",
    "the role",
    "day to day",
    "day-to-day",
    "duties"
  ],
  required: [
    "requirements",
    "required qualifications",
    "minimum qualifications",
    "basic qualifications",
    "must have",
    "must-have",
    "who you are",
    "what we're looking for",
    "what we are looking for",
    "qualifications",
    "required skills",
    "experience required",
    "you have"
  ],
  preferred: [
    "preferred qualifications",
    "preferred skills",
    "nice to have",
    "nice-to-have",
    "bonus points",
    "bonus",
    "plus",
    "desired",
    "desired qualifications",
    "good to have"
  ],
  education: ["education", "educational requirements", "degree requirements", "academic requirements"],
  benefits: ["benefits", "perks", "what we offer", "compensation", "why join us", "why join"],
  company: ["about us", "about the company", "who we are", "company overview"],
  other: ["skills", "technical skills", "tech stack", "technologies"]
};

const SECTION_HEADING_LOOKUP = new Map();
for (const [section, synonyms] of Object.entries(SECTION_SYNONYMS)) {
  for (const synonym of synonyms) {
    SECTION_HEADING_LOOKUP.set(synonym, section);
  }
}

const STOPWORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between both but by can cannot could couldn't did didn't do does doesn't doing don't down during each few for from further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours yourself yourselves will role team work working experience years year job company please across also using use used strong excellent ability able etc within including include includes well plus preferred required requirements responsibilities qualifications candidate candidates ideal looking join help build building create creating develop developing design designing implement implementing manage managing support supporting ensure ensuring deliver delivering drive driving collaborate collaborating partner partnering new our us your`.split(
    /\s+/
  )
);

/**
 * Split a raw description into heading-delimited sections.
 * Headings are only recognised when they occupy their own short line.
 */
export const splitSections = (text) => {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const sections = { summary: [], responsibilities: [], required: [], preferred: [], education: [], benefits: [], company: [], other: [] };
  let current = "summary";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      sections[current].push("");
      continue;
    }

    const heading = normalizeHeading(line);
    if (heading) {
      current = heading;
      continue;
    }

    sections[current].push(line);
  }

  return sections;
};

const normalizeHeading = (line) => {
  if (line.length > 90) return null;
  const cleaned = line
    .toLowerCase()
    .replace(/^[#>*\-\s]+/, "")
    .replace(/[:\s]+$/, "")
    .replace(/[^a-z0-9' /-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.split(" ").length > 7) return null;
  return SECTION_HEADING_LOOKUP.get(cleaned) || null;
};

const cleanLine = (line) =>
  String(line)
    .replace(/^[\s•●○▪◦*\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanLines = (lines = []) =>
  lines.map(cleanLine).filter((line) => line.length > 2 && !normalizeHeading(line));

const joinSection = (lines = []) => cleanLines(lines).join("\n");

export const extractExperienceRequirement = (text) => {
  const source = String(text || "");
  // "5+ years of professional backend experience" and similar phrasings are
  // common, so up to three filler words are allowed before "experience".
  const filler = "(?:\\s+[a-z0-9-]+){0,3}";
  const patterns = [
    new RegExp(`(\\d{1,2})\\s*(?:\\+|plus)?\\s*(?:-|–|to)\\s*(\\d{1,2})\\s*\\+?\\s*years?(?:\\s+of)?${filler}\\s+experience`, "i"),
    /(?:minimum(?: of)?|at least|min\.?)\s*(\d{1,2})\s*\+?\s*years?/i,
    new RegExp(`(\\d{1,2})\\s*\\+\\s*years?(?:\\s+of)?${filler}\\s+experience`, "i"),
    new RegExp(`(\\d{1,2})\\s+years?(?:\\s+of)?${filler}\\s+experience`, "i"),
    /(\d{1,2})\s*\+\s*years?/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const minYears = Number(match[1]);
    const maxYears = match[2] ? Number(match[2]) : minYears;
    if (!Number.isFinite(minYears) || minYears > 30) continue;
    return {
      minYears,
      maxYears: Number.isFinite(maxYears) ? maxYears : minYears,
      raw: match[0].trim()
    };
  }

  return { minYears: 0, maxYears: 0, raw: "" };
};

export const extractEducationRequirement = (text) => {
  const source = String(text || "").toLowerCase();
  const levels = [
    { level: "Doctorate", rank: 5, pattern: /\b(ph\.?d|doctorate|doctoral)\b/ },
    { level: "Master's", rank: 4, pattern: /\b(master'?s?|m\.?s\.?c?|mba|m\.?eng)\b/ },
    { level: "Bachelor's", rank: 3, pattern: /\b(bachelor'?s?|b\.?s\.?c?|b\.?eng|undergraduate degree|4[- ]year degree)\b/ },
    { level: "Associate", rank: 2, pattern: /\b(associate'?s? degree|associate degree)\b/ },
    { level: "High School", rank: 1, pattern: /\b(high school diploma|secondary school|ged)\b/ }
  ];

  const found = levels.find((entry) => entry.pattern.test(source));
  const fieldMatch = source.match(
    /\b(?:degree|bachelor'?s?|master'?s?|ph\.?d)\s+(?:in|of)\s+([a-z][a-z /&-]{2,60})/
  );

  return {
    level: found?.level || "",
    rank: found?.rank || 0,
    field: fieldMatch ? titleCase(fieldMatch[1].trim()) : "",
    raw: found ? found.level : ""
  };
};

const titleCase = (value) =>
  String(value || "")
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

const cleanTitle = (value) => {
  const raw = String(value || "")
    .replace(/\s*[|•·]\s*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (raw.length < 3 || raw.length > 120) return "";
  if (/^(home|jobs|careers|search|apply|job details|job description)$/i.test(raw)) return "";
  return raw;
};

const extractTitle = (text, structured = {}) => {
  if (structured.title) return cleanTitle(structured.title);

  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const line of lines) {
    if (line.length > 120 || line.includes("@") || /^job description/i.test(line)) continue;
    if (/^(about|overview|company|location|salary|remote|full[- ]time)/i.test(line)) continue;
    return cleanTitle(line);
  }

  return "";
};

const extractCompany = (text, structured = {}) => {
  if (structured.company) return String(structured.company).replace(/\s+/g, " ").trim();

  const head = String(text || "").split("\n").slice(0, 12).join("\n");
  const atMatch = head.match(/\b(?:at|@)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})/);
  if (atMatch) return atMatch[1].trim();

  const companyLine = head.match(/^(?:company|employer)\s*[:\-]\s*(.+)$/im);
  if (companyLine) return companyLine[1].trim().slice(0, 80);

  return "";
};

const extractLocation = (text, structured = {}) => {
  if (structured.location) return String(structured.location).replace(/\s+/g, " ").trim();

  const source = String(text || "").split("\n").slice(0, 15).join("\n");
  const remote = source.match(/\b(remote|hybrid|on[- ]?site|onsite)\b(?:\s*[-–—]\s*([A-Za-z ,]+))?/i);
  const locationLine = source.match(/^(?:location|based in|office)\s*[:\-]\s*(.+)$/im);

  if (locationLine) return locationLine[1].trim().slice(0, 100);
  if (remote) return remote[2] ? `${remote[1]} – ${remote[2].trim()}` : titleCase(remote[1]);
  return "";
};

const KEYWORD_STOPWORDS = new Set([
  ...STOPWORDS,
  "strong", "excellent", "ability", "including", "etc", "plus", "preferred", "required",
  "requirements", "qualifications", "responsibilities", "candidate", "ideal", "looking",
  "join", "help", "team", "teams", "company", "role", "position", "opportunity", "applicants"
]);

export const extractKeywords = (text, skills = [], limit = 30) => {
  const source = String(text || "").toLowerCase();
  const wordCounts = new Map();

  for (const raw of source.split(/[^a-z0-9+#./-]+/)) {
    const token = raw.replace(/^[./-]+|[./-]+$/g, "");
    if (token.length < 3 || token.length > 30) continue;
    if (/^\d+$/.test(token)) continue;
    if (KEYWORD_STOPWORDS.has(token)) continue;
    wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
  }

  // Frequent two-word phrases from the same tokenisation.
  const phraseCounts = new Map();
  const tokens = source.split(/[^a-z0-9+#./-]+/).filter(Boolean);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a.length < 3 || b.length < 3) continue;
    if (a === b) continue; // repeated words are not useful phrases
    if (KEYWORD_STOPWORDS.has(a) || KEYWORD_STOPWORDS.has(b)) continue;
    const phrase = `${a} ${b}`;
    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
  }

  const ranked = [
    ...skills.map((skill) => ({ term: skill, score: 100 })),
    ...[...phraseCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([term, count]) => ({ term, score: count * 3 + 4 })),
    ...[...wordCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([term, count]) => ({ term, score: count * 2 + 1 }))
  ];

  const seen = new Set();
  const keywords = [];
  for (const item of ranked.sort((a, b) => b.score - a.score)) {
    const key = item.term.toLowerCase();
    if (seen.has(key)) continue;
    if ([...seen].some((existing) => existing.includes(key) && existing !== key)) continue;
    seen.add(key);
    keywords.push(item.term);
    if (keywords.length >= limit) break;
  }

  return keywords;
};

/**
 * Parse a job description into a stable, displayable structure.
 * This function never invents fields: unknown values are empty strings.
 */
export const parseJobDescription = (rawText, options = {}) => {
  const text = String(rawText || "").replace(/\r/g, "").trim();
  const structured = options.structured || {};
  const warnings = [];

  if (text.length < 80) {
    warnings.push("The job description is very short. Paste the full posting for reliable analysis.");
  }

  const sections = splitSections(text);
  const fullText = text;

  const title = extractTitle(text, structured);
  const company = extractCompany(text, structured);
  const location = extractLocation(text, structured);

  // The title/company banner often contains words that look like skills
  // ("Northwind Analytics" -> "analytics" -> Data Analysis). Skills are read
  // from the posting body so a company name never becomes a requirement.
  const identityValues = [title, company].filter(Boolean).map((value) => value.toLowerCase());
  const lines = text.split("\n");
  const headerLines = new Set();
  let examined = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (examined >= 5) break;
    examined += 1;
    const lower = line.toLowerCase();
    if (lower.length <= 140 && identityValues.some((identity) => lower.includes(identity))) {
      headerLines.add(line);
    }
  }
  const bodyText = headerLines.size
    ? lines.filter((line) => !headerLines.has(line)).join("\n")
    : fullText;

  const requiredText = [joinSection(sections.required), joinSection(sections.responsibilities), joinSection(sections.other)]
    .filter(Boolean)
    .join("\n");
  const preferredCleanLines = cleanLines(sections.preferred);
  const preferredText = preferredCleanLines.join("\n");

  // When a posting has no explicit requirements section, the body is the only
  // source of requirements. "Nice to have" lines must not leak into it, or
  // every optional skill would be scored as mandatory.
  const preferredLineSet = new Set(preferredCleanLines);
  const fallbackText = preferredLineSet.size
    ? bodyText
        .split("\n")
        .filter((line) => !preferredLineSet.has(cleanLine(line)))
        .join("\n")
    : bodyText;

  const requiredSkills = extractSkills(requiredText || fallbackText);
  const preferredSkills = extractSkills(preferredText).filter((skill) => !requiredSkills.includes(skill));
  const allSkills = [...new Set([...requiredSkills, ...preferredSkills, ...extractSkills(bodyText)])];

  const responsibilities = cleanLines(sections.responsibilities)
    .filter((line) => line.length > 15)
    .slice(0, 20);

  const requiredQualifications = cleanLines(sections.required).slice(0, 25);
  const preferredQualifications = cleanLines(sections.preferred).slice(0, 15);

  const experience = extractExperienceRequirement(fullText);
  const education = extractEducationRequirement(fullText);

  if (!title) warnings.push("Could not identify a job title. Add a title line manually if needed.");
  if (!requiredSkills.length) warnings.push("No recognisable technical skills were found in the posting.");

  return {
    parserVersion: JD_PARSER_VERSION,
    title,
    company,
    location,
    employmentType: structured.employmentType || "",
    salary: structured.salary || "",
    description: text,
    sections: {
      summary: joinSection(sections.summary),
      responsibilities: joinSection(sections.responsibilities),
      required: joinSection(sections.required),
      preferred: joinSection(sections.preferred),
      education: joinSection(sections.education),
      benefits: joinSection(sections.benefits),
      company: joinSection(sections.company)
    },
    responsibilities,
    requiredQualifications,
    preferredQualifications,
    requiredSkills,
    preferredSkills,
    allSkills,
    technologies: allSkills,
    experience,
    education,
    keywords: extractKeywords(fullText, allSkills),
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    source: {
      type: options.sourceType || "pasted",
      url: options.url || ""
    },
    warnings
  };
};

/**
 * Compare a parsed requirement list against resume text. Used by ATS and
 * job-match services so both consume exactly the same evidence.
 */
export const requirementCoverage = (requirements = [], resumeText = "") => {
  const text = String(resumeText || "").toLowerCase();
  const rows = requirements.map((requirement) => {
    const skills = extractSkills(requirement);
    const evidenceSkills = skills.filter((skill) => text.includes(skill.toLowerCase()));
    const words = String(requirement)
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word));
    const matchedWords = words.filter((word) => text.includes(word));
    const wordCoverage = words.length ? matchedWords.length / words.length : 0;
    const passed = skills.length ? evidenceSkills.length > 0 : wordCoverage >= 0.5;
    return {
      requirement,
      skills,
      matchedSkills: evidenceSkills,
      wordCoverage: Math.round(wordCoverage * 100),
      passed
    };
  });

  return {
    rows,
    passed: rows.filter((row) => row.passed).length,
    total: rows.length
  };
};

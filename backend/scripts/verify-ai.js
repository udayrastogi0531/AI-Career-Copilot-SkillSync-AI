/**
 * Live AI verification for the four generative features.
 *
 * Reads GEMINI_API_KEY from the backend environment (never prints it), runs one
 * real request per feature, and reports pass/fail with the provider's own error
 * code when something fails.
 *
 * Usage: cd backend && node scripts/verify-ai.js
 * Costs a handful of Gemini requests. Safe to run repeatedly.
 */
import "dotenv/config";
import {
  AiProviderError,
  careerCoachReplyWithAI,
  generateAtsNarrative,
  generateCoverLetterWithAI,
  generateInterviewQuestionsWithAI,
  generateResumeProposals
} from "../src/services/aiService.js";

const RESUME = {
  title: "Backend Resume",
  personalInfo: {
    fullName: "Studio QA",
    email: "studio.qa@example.com",
    phone: "+1 555 0100",
    location: "Berlin, Germany"
  },
  summary:
    "Backend engineer with 6 years building Node.js services and PostgreSQL data platforms for logistics customers.",
  experience: [
    {
      company: "Northwind Analytics",
      role: "Senior Backend Engineer",
      startDate: "2021-03",
      endDate: "Present",
      description:
        "Designed Node.js services handling 4M events per day\nCut PostgreSQL p95 latency by 62% with index and query rewrites\nLed migration of the billing service to TypeScript"
    },
    {
      company: "Helios Systems",
      role: "Backend Engineer",
      startDate: "2018-08",
      endDate: "2021-02",
      description: "Built REST APIs in TypeScript and introduced Redis caching for the catalog service"
    }
  ],
  skills: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Docker", "AWS"],
  education: [{ institution: "TU Berlin", degree: "BSc", fieldOfStudy: "Computer Science", graduationYear: "2018" }],
  projects: [
    {
      name: "Event Pipeline",
      description: "Streaming pipeline processing 10M events per day",
      technologies: ["Kafka", "Node.js"]
    }
  ]
};

const JD = `Senior Backend Engineer at Northwind Analytics, Remote EU.
Requirements: 5+ years of professional backend experience. Strong TypeScript and Node.js. Hands-on PostgreSQL and Redis.
Nice to have: Kubernetes, GraphQL.`;

const results = [];

const describeError = (error) => {
  if (error instanceof AiProviderError) {
    return `${error.code} (http ${error.status}) — ${error.message}`;
  }
  return `${error.name}: ${String(error.message || error).slice(0, 300)}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async (name, fn, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const started = Date.now();
    try {
      const value = await fn();
      const ms = Date.now() - started;
      results.push({ name, ok: true, ms, attempts: attempt });
      return value;
    } catch (error) {
      const retryable =
        error instanceof AiProviderError && ["AI_RATE_LIMITED", "AI_TIMEOUT", "AI_PROVIDER_ERROR"].includes(error.code);
      const ms = Date.now() - started;
      if (retryable && attempt < attempts) {
        const wait = attempt * 30000;
        console.log(`[retry] ${name} -> ${describeError(error)}; waiting ${wait / 1000}s (attempt ${attempt}/${attempts})`);
        await sleep(wait);
        continue;
      }
      results.push({ name, ok: false, error: describeError(error), ms, attempts: attempt });
      return null;
    }
  }
  return null;
};

const key = process.env.GEMINI_API_KEY;
console.log(`model: ${process.env.GEMINI_MODEL || "models/gemini-2.5-flash"}`);
// Never print the key itself (or a hint like its length).
console.log(`key present: ${Boolean(key)}`);

if (!key) {
  console.log("\nNo GEMINI_API_KEY set. Add it to backend/.env and re-run this script.");
  process.exit(1);
}

// ATS narrative: the score below is a fixture, only the commentary is generated.
const ats = await run("ats recommendations", () =>
  generateAtsNarrative({
    resume: RESUME,
    deterministic: {
      score: 74,
      scoreBreakdown: [
        { dimension: "required_skills", weight: 0.32, score: 80 },
        { dimension: "keyword_coverage", weight: 0.18, score: 68 }
      ],
      missingSkills: ["Docker", "Kubernetes"],
      missingKeywords: ["distributed systems"],
      warnings: [{ severity: "medium", message: "No metrics in the most recent role." }]
    }
  })
);
if (ats) {
  console.log(`ats feedback: ${ats.recruiter_feedback.length} chars | strengths: ${ats.strengths.length} | improvements: ${ats.improvements.length} | rewrites: ${ats.rewrite_suggestions.length}`);
  console.log(`ats head: ${ats.recruiter_feedback.slice(0, 180).replace(/\s+/g, " ")}`);
}

const proposals = await run("resume copilot proposals", () =>
  generateResumeProposals({ resume: RESUME, action: "improve_summary", jobDescription: JD })
);
if (proposals) {
  const first = proposals.proposals?.[0];
  console.log(`proposals: ${proposals.proposals?.length || 0} | sections: ${(proposals.proposals || []).map((p) => p.section).join(", ")}`);
  console.log(`first proposal: ${(first?.after || "").slice(0, 160).replace(/\s+/g, " ")}`);
  if (proposals.warnings?.length) console.log(`warnings: ${proposals.warnings.join(" | ").slice(0, 300)}`);
}

const letter = await run("cover letter", () =>
  generateCoverLetterWithAI({ resumeInput: RESUME, jobDescription: JD, tone: "technical", role: "Senior Backend Engineer", company: "Northwind Analytics" })
);
if (letter) {
  console.log(`cover letter: ${letter.wordCount} words | highlights: ${letter.highlights.length}`);
  console.log(`letter head: ${letter.letter.slice(0, 200).replace(/\s+/g, " ")}`);
}

const coach = await run("career coach", () =>
  careerCoachReplyWithAI("How should I prepare for a backend system design interview?", {
    user: { targetRole: "Senior Backend Engineer" },
    sources: [
      {
        title: "Structuring a system design answer",
        url: "https://example.com/system-design",
        content:
          "Start with requirements and constraints, then sketch the data model, then the request path, then failure modes. Name trade-offs explicitly."
      }
    ]
  })
);
if (coach) {
  console.log(`coach answer: ${coach.answer.length} chars | actions: ${coach.actions.length} | citations: ${coach.citations.length}`);
  console.log(`coach head: ${coach.answer.slice(0, 200).replace(/\s+/g, " ")}`);
}

const interview = await run("interview questions", () =>
  generateInterviewQuestionsWithAI({
    resumeInput: RESUME,
    company: "Northwind Analytics",
    role: "Senior Backend Engineer",
    interviewMode: "technical"
  })
);
if (interview) {
  console.log(`questions: ${interview.questions.length}`);
  interview.questions.forEach((question, index) => console.log(`  ${index + 1}. ${question.slice(0, 140)}`));
}

console.log("\n--- summary ---");
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"} | ${result.name} | ${result.ms}ms | attempt ${result.attempts}${result.ok ? "" : ` | ${result.error}`}`
  );
}

const failed = results.filter((result) => !result.ok);
process.exit(failed.length ? 1 : 0);

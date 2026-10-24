/**
 * End-to-end workflow verification against a running API.
 *
 * Covers the shipped user journey over real HTTP:
 *   create resume -> compile PDF -> upload that PDF (real file parsing) ->
 *   parse JD -> ATS report -> approved AI edit -> version snapshot ->
 *   compile again -> cover letter -> save application -> cross-user isolation.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5050 node scripts/e2e-workflow.js
 *
 * Requires a working GEMINI_API_KEY for the AI steps (ATS narrative, copilot,
 * cover letter). Provider failures are reported as failures, never faked.
 * Prints a unique test email per run; no credentials are printed.
 */
const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:5050").replace(/\/$/, "");
const stamp = Date.now();
const USER_A = { name: "Workflow A", email: `workflow.a.${stamp}@example.com`, password: "Passw0rd!2345" };
const USER_B = { name: "Workflow B", email: `workflow.b.${stamp}@example.com`, password: "Passw0rd!2345" };

const results = [];
const state = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${typeof body === "string" ? body : JSON.stringify(body).slice(0, 400)}`);
    this.status = status;
    this.body = body;
  }
}

const api = async (method, path, { token, body, form, expect = [200, 201] } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: form || (body !== undefined ? JSON.stringify(body) : undefined)
  });

  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }

  if (!expect.includes(response.status)) {
    const error = new HttpError(response.status, payload);
    error.code = payload?.code;
    throw error;
  }
  return payload;
};

// AI calls can hit free-tier limits; retry only rate limits and timeouts.
const aiCall = async (method, path, options, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await api(method, path, options);
    } catch (error) {
      const retryable = [429, 502, 504].includes(error.status) && ["AI_RATE_LIMITED", "AI_TIMEOUT", "AI_PROVIDER_ERROR"].includes(error.code);
      if (!retryable || attempt === attempts) throw error;
      console.log(`   [retry ${attempt}/${attempts}] ${path} -> ${error.code}; waiting ${attempt * 20}s`);
      await sleep(attempt * 20000);
    }
  }
  return null;
};

const step = async (name, fn) => {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - started, detail });
    console.log(`PASS | ${name} | ${Date.now() - started}ms${detail ? ` | ${detail}` : ""}`);
    return true;
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, detail: error.message });
    console.log(`FAIL | ${name} | ${Date.now() - started}ms | ${error.message}`);
    return false;
  }
};

const RESUME = {
  title: "Backend Resume (E2E)",
  templateId: "ats-classic",
  personalInfo: {
    fullName: "Workflow A",
    email: USER_A.email,
    phone: "+1 555 0142",
    location: "Berlin, Germany",
    links: [{ label: "GitHub", url: "https://github.com/example" }]
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
  education: [{ institution: "TU Berlin", degree: "BSc", fieldOfStudy: "Computer Science", graduationYear: "2018" }],
  skills: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Docker", "AWS"],
  projects: [
    {
      name: "Event Pipeline",
      description: "Streaming pipeline processing 10M events per day",
      technologies: ["Kafka", "Node.js"]
    }
  ],
  certifications: []
};

const JD_TEXT = `Senior Backend Engineer
Northwind Analytics - Remote (EU)

Responsibilities
- Design and ship Node.js services processing millions of events per day
- Own PostgreSQL schema design and query performance
- Partner with product on API contracts

Requirements
- 5+ years of professional backend experience
- Strong TypeScript and Node.js
- Hands-on PostgreSQL and Redis
- Bachelor's degree in Computer Science

Nice to have
- Kubernetes
- GraphQL`;

console.log(`API: ${BASE_URL}`);
console.log(`user: ${USER_A.email}\n`);

const signedUp = await step("sign up + token", async () => {
  const payload = await api("POST", "/api/auth/signup", { body: USER_A });
  state.tokenA = payload.token;
  if (!state.tokenA) throw new Error("signup returned no token");
  return `user id ${payload.user?.id || "unknown"}`;
});
if (!signedUp) {
  console.log("\nCannot continue without a session.");
  process.exit(1);
}

await step("log in with the new credentials", async () => {
  const payload = await api("POST", "/api/auth/login", {
    body: { email: USER_A.email, password: USER_A.password }
  });
  if (!payload.token) throw new Error("login returned no token");
  const wrong = await api("POST", "/api/auth/login", {
    body: { email: USER_A.email, password: "definitely-wrong" },
    expect: [401]
  });
  if (wrong.code !== "INVALID_CREDENTIALS") throw new Error(`wrong password returned ${wrong.code || "no code"}`);
  return "token issued, wrong password rejected with INVALID_CREDENTIALS";
});

await step("reject unauthenticated access", async () => {
  const response = await fetch(`${BASE_URL}/api/resumes`);
  if (response.status !== 401) throw new Error(`expected 401, got ${response.status}`);
  return "401 without a token";
});

await step("create resume", async () => {
  const payload = await api("POST", "/api/resumes", { token: state.tokenA, body: RESUME });
  state.resumeId = payload.resume?._id;
  if (!state.resumeId) throw new Error("no resume id returned");
  const latex = payload.resume?.latexSource || "";
  if (!/\\begin\{document\}/.test(latex)) throw new Error("resume has no generated LaTeX");
  return `id ${state.resumeId}, ${latex.split("\n").length} LaTeX lines`;
});

await step("compile resume to PDF (isolated compiler)", async () => {
  const payload = await api("POST", "/api/latex/compile", {
    token: state.tokenA,
    body: { resumeId: state.resumeId }
  });
  const pdf = Buffer.from(payload.pdfBase64 || "", "base64");
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("compile did not return a PDF");
  state.pdf = pdf;
  return `${payload.bytes} bytes, ${payload.engine}, ${payload.pageCount || "?"} page(s)`;
});

await step("upload the PDF resume and parse it", async () => {
  const form = new FormData();
  form.append("resume", new Blob([state.pdf], { type: "application/pdf" }), "workflow-resume.pdf");
  form.append("resumeId", state.resumeId);
  const payload = await api("POST", "/api/resumes/upload", { token: state.tokenA, form });
  const resume = payload.resume || {};
  const experienceCount = resume.experience?.length || 0;
  state.resumeId = resume._id || state.resumeId;
  if (!experienceCount) throw new Error("uploaded PDF produced no experience entries");
  return `${experienceCount} experience entries parsed`;
});

await step("parse job description", async () => {
  const payload = await api("POST", "/api/job/parse", {
    token: state.tokenA,
    body: { text: JD_TEXT, save: true, resumeId: state.resumeId }
  });
  state.job = payload.job;
  state.jobDescriptionId = payload.jobDescriptionId;
  if (!state.jobDescriptionId) throw new Error("JD was not persisted");
  const required = (state.job.requiredSkills || []).join(", ");
  const preferred = (state.job.preferredSkills || []).join(", ");
  return `required [${required}] | preferred [${preferred}]`;
});

await step("ATS report (deterministic + AI narrative)", async () => {
  const payload = await aiCall("POST", `/api/analysis/resume/${state.resumeId}`, {
    token: state.tokenA,
    body: { jobDescriptionId: state.jobDescriptionId }
  });
  const result = payload.result || {};
  state.ats = result;
  if (typeof result.score !== "number") throw new Error("no numeric ATS score");
  return `score ${result.score}, hash ${String(result.inputHash || "").slice(0, 12)}…, missing ${(result.missingSkills || []).length}`;
});

await step("copilot proposal requires approval", async () => {
  const payload = await aiCall("POST", "/api/copilot/propose", {
    token: state.tokenA,
    body: { resumeId: state.resumeId, action: "improve_summary", jobDescription: JD_TEXT }
  });
  const proposals = payload.result?.proposals || [];
  state.proposal = proposals.find((item) => item.section === "summary") || proposals[0];
  if (!state.proposal) throw new Error("the provider returned no proposals");
  return `${proposals.length} proposal(s), first ${state.proposal.section}: "${String(state.proposal.after || "").slice(0, 70)}…"`;
});

await step("apply the approved proposal + snapshot", async () => {
  const before = state.proposal.before;
  const payload = await api("POST", "/api/copilot/apply", {
    token: state.tokenA,
    body: { resumeId: state.resumeId, proposals: [state.proposal] }
  });
  const resumed = await api("GET", `/api/resumes/${state.resumeId}`, { token: state.tokenA });
  const summary = resumed.resume?.summary || "";
  if (before && summary === before) throw new Error("summary was not updated");
  const versions = await api("GET", `/api/resumes/${state.resumeId}/versions`, { token: state.tokenA });
  if (!(versions.versions || []).length) throw new Error("no version snapshot was created");
  return `summary updated, ${versions.versions.length} version(s), ${payload.result?.applied?.length ?? 1} change(s)`;
});

await step("recompile after the approved edit", async () => {
  const payload = await api("POST", "/api/latex/compile", {
    token: state.tokenA,
    body: { resumeId: state.resumeId }
  });
  const pdf = Buffer.from(payload.pdfBase64 || "", "base64");
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("recompile did not return a PDF");
  return `${payload.bytes} bytes via ${payload.engine}`;
});

await step("generate cover letter (live AI)", async () => {
  const payload = await aiCall("POST", "/api/analysis/generate-cover-letter", {
    token: state.tokenA,
    body: {
      resumeId: state.resumeId,
      jobDescriptionId: state.jobDescriptionId,
      tone: "technical",
      role: state.job?.title,
      company: state.job?.company
    }
  });
  const result = payload.result || {};
  if (!result.letter || result.letter.split(/\s+/).length < 100) throw new Error("cover letter was too short to be usable");
  const history = await api("GET", "/api/analysis/cover-letters", { token: state.tokenA });
  return `${result.wordCount} words, ${(history.letters || []).length} saved`;
});

await step("prepare interview questions (live AI)", async () => {
  const payload = await aiCall("POST", "/api/interviews/generate", {
    token: state.tokenA,
    body: {
      resumeId: state.resumeId,
      company: state.job?.company || "Northwind Analytics",
      role: state.job?.title || "Senior Backend Engineer",
      interviewMode: "technical"
    }
  });
  const session = payload.session || {};
  const questions = session.questions || [];
  if (questions.length < 3) throw new Error(`only ${questions.length} questions were returned`);
  return `${questions.length} questions, session ${session._id || "unknown"}`;
});

await step("save application and move it through statuses", async () => {
  const created = await api("POST", "/api/jobs", {
    token: state.tokenA,
    body: {
      company: state.job?.company || "Northwind Analytics",
      role: state.job?.title || "Senior Backend Engineer",
      status: "applied",
      notes: "Created by the E2E workflow check."
    }
  });
  const jobId = created.job?._id || created._id;
  if (!jobId) throw new Error("job application was not created");
  const updated = await api("PATCH", `/api/jobs/${jobId}`, { token: state.tokenA, body: { status: "interviewing" } });
  const list = await api("GET", "/api/jobs", { token: state.tokenA });
  const saved = (list.jobs || []).find((job) => String(job._id) === String(jobId));
  if (saved?.status !== "interviewing") throw new Error(`status was ${saved?.status}`);
  return `job ${jobId} -> interviewing (${(updated.job?.status) || "updated"})`;
});

await step("second user cannot read the first user's data", async () => {
  const payload = await api("POST", "/api/auth/signup", { body: USER_B });
  state.tokenB = payload.token;
  const checks = [];

  const readResume = await fetch(`${BASE_URL}/api/resumes/${state.resumeId}`, { headers: { Authorization: `Bearer ${state.tokenB}` } });
  checks.push(`resume:${readResume.status}`);
  if (readResume.status !== 404) throw new Error(`expected 404 for a foreign resume, got ${readResume.status}`);

  const foreignHistory = await api("GET", "/api/analysis/history", { token: state.tokenB });
  const letters = await api("GET", "/api/analysis/cover-letters", { token: state.tokenB });
  const jobs = await api("GET", "/api/jobs", { token: state.tokenB });
  if ((foreignHistory.history || []).length) throw new Error("analysis history leaked across users");
  if ((letters.letters || []).length) throw new Error("cover letters leaked across users");
  if ((jobs.jobs || []).length) throw new Error("job applications leaked across users");
  checks.push("history:0", "letters:0", "jobs:0");
  return checks.join(", ");
});

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} steps passed`);
if (failed.length) {
  console.log("Failed steps:");
  failed.forEach((result) => console.log(`  - ${result.name}: ${result.detail}`));
}
process.exit(failed.length ? 1 : 0);

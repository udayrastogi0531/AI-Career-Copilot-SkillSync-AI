/**
 * Restart-persistence verification.
 *
 * Boots the real API against a persistent MongoDB data directory, writes a
 * resume, a version, a JD, an analysis, and a job application through HTTP,
 * stops the server, boots it again on the same directory, and checks that the
 * same account can still read all of it — and that the pre-restart JWT still
 * works.
 *
 * This proves persistence in the application/database layer. It does NOT prove
 * connectivity to the configured Atlas cluster (see IMPLEMENTATION_REPORT.md).
 *
 * Usage: cd backend && node scripts/verify-persistence.js
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PERSIST_PORT || 5052);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(os.tmpdir(), `skillsync-persist-${Date.now()}`);
const EMAIL = `persist.${Date.now()}@example.com`;
const PASSWORD = "Passw0rd!2345";

let child = null;
let logs = "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startServer = async () => {
  logs = "";
  child = spawn(process.execPath, ["scripts/dev-inmemory.js"], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      MEMORY_DB_PATH: DB_PATH,
      LATEX_ALLOW_LOCAL: "true"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.on("error", (error) => {
    logs += `\nspawn error: ${error.message}`;
  });

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${logs.slice(-1500)}`);
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  // Stop the child before throwing: leaving it running holds the port and the
  // captured pipes open, so the script can hang despite catching the error.
  await stopServer();
  throw new Error(`server did not become healthy within 120s:\n${logs.slice(-1500) || "(no output)"}`);
};

const stopServer = async () => {
  if (!child) return;
  const pid = child.pid;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
  const deadline = Date.now() + 20_000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(250);
  if (child.exitCode === null) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
  child = null;
  await sleep(1000);
};

const api = async (method, urlPath, { token, body } = {}) => {
  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let payload = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  if (!response.ok) throw new Error(`${method} ${urlPath} -> ${response.status} ${String(text).slice(0, 300)}`);
  return payload;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const RESUME = {
  title: "Persistence Resume",
  templateId: "ats-classic",
  personalInfo: { fullName: "Persist User", email: EMAIL, phone: "+1 555 0100", location: "Berlin" },
  summary: "Backend engineer with six years of Node.js and PostgreSQL experience.",
  experience: [
    {
      company: "Northwind Analytics",
      role: "Senior Backend Engineer",
      startDate: "2021-03",
      endDate: "Present",
      description: "Designed Node.js services handling 4M events per day\nCut PostgreSQL p95 latency by 62%"
    }
  ],
  education: [{ institution: "TU Berlin", degree: "BSc", fieldOfStudy: "Computer Science", graduationYear: "2018" }],
  skills: ["Node.js", "TypeScript", "PostgreSQL", "Redis"],
  projects: [],
  certifications: []
};

const JD_TEXT = `Senior Backend Engineer
Northwind Analytics - Remote (EU)

Requirements
- 5+ years of professional backend experience
- Strong TypeScript and Node.js
- Hands-on PostgreSQL and Redis

Nice to have
- Kubernetes
- GraphQL`;

const state = {};

const run = async () => {
  console.log(`database directory: ${DB_PATH}`);
  console.log("starting server (first run)");

  await startServer();

  const signup = await api("POST", "/api/auth/signup", {
    body: { name: "Persist User", email: EMAIL, password: PASSWORD }
  });
  state.token = signup.token;
  assert(state.token, "signup returned no token");

  const created = await api("POST", "/api/resumes", { token: state.token, body: RESUME });
  state.resumeId = created.resume?._id;
  assert(state.resumeId, "resume was not created");

  const version = await api("POST", `/api/resumes/${state.resumeId}/versions`, {
    token: state.token,
    body: { label: "Before restart" }
  });
  state.versionId = version.version?._id;
  assert(state.versionId, "version was not created");

  const jd = await api("POST", "/api/job/parse", { token: state.token, body: { text: JD_TEXT, save: true } });
  state.jobDescriptionId = jd.jobDescriptionId;
  assert(state.jobDescriptionId, "job description was not persisted");

  const analysis = await api("POST", `/api/analysis/resume/${state.resumeId}`, {
    token: state.token,
    body: { jobDescriptionId: state.jobDescriptionId, useAI: false }
  });
  assert(typeof analysis.result?.score === "number", "analysis produced no score");

  const job = await api("POST", "/api/jobs", {
    token: state.token,
    body: { company: "Northwind Analytics", role: "Senior Backend Engineer", status: "applied" }
  });
  state.jobId = job.job?._id;
  assert(state.jobId, "job application was not created");

  console.log(`wrote resume ${state.resumeId}, version ${state.versionId}, JD ${state.jobDescriptionId}, job ${state.jobId}`);

  await stopServer();
  console.log("server stopped; restarting on the same data directory");

  await startServer();

  const resumes = await api("GET", "/api/resumes", { token: state.token });
  const foundResume = (resumes.resumes || []).find((item) => String(item._id) === String(state.resumeId));
  assert(foundResume, "resume did not survive the restart");
  assert(foundResume.summary === RESUME.summary, "resume content changed across the restart");

  const versions = await api("GET", `/api/resumes/${state.resumeId}/versions`, { token: state.token });
  assert(
    (versions.versions || []).some((item) => String(item._id) === String(state.versionId)),
    "resume version did not survive the restart"
  );

  const jds = await api("GET", "/api/job/descriptions", { token: state.token });
  assert(
    (jds.descriptions || []).some((item) => String(item._id) === String(state.jobDescriptionId)),
    "job description did not survive the restart"
  );

  const history = await api("GET", "/api/analysis/history", { token: state.token });
  assert((history.history || []).length >= 1, "analysis history did not survive the restart");

  const jobs = await api("GET", "/api/jobs", { token: state.token });
  assert(
    (jobs.jobs || []).some((item) => String(item._id) === String(state.jobId)),
    "job application did not survive the restart"
  );

  const login = await api("POST", "/api/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  assert(login.token, "login failed after the restart");

  const viaNewToken = await api("GET", "/api/resumes", { token: login.token });
  assert((viaNewToken.resumes || []).length >= 1, "new session could not read the data");

  console.log("\nPASS | resume, version, JD, analysis history, and job application all survived the restart");
  console.log("PASS | the pre-restart JWT and a fresh login both still read the data");
  console.log(`data directory retained at ${DB_PATH}`);
};

try {
  await run();
} catch (error) {
  console.error(`\nFAIL | ${error.message}`);
  if (logs) console.error(`server log tail:\n${logs.slice(-1200)}`);
  process.exitCode = 1;
} finally {
  await stopServer();
  if (!process.exitCode) await fs.rm(DB_PATH, { recursive: true, force: true }).catch(() => {});
}

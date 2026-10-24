/**
 * End-to-end API tests against an in-memory MongoDB.
 *
 * These exercise the real Express app, real Mongoose models, the deterministic
 * ATS/job-match engines, resume versioning, and user data isolation. No AI
 * provider is called: the suite asserts that AI failures are reported rather
 * than replaced with fabricated results.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017"; // replaced after mongod starts
process.env.MONGODB_URI_STANDARD = "";
process.env.JWT_SECRET = "integration-test-secret-value-0123456789";
process.env.GEMINI_API_KEY = "invalid-test-key";
process.env.LATEX_ALLOW_LOCAL = "true";
process.env.RESEND_API_KEY = "test-resend-key";

let mongod;
let app;
let models;
let authHeaderA;
let authHeaderB;
let userAId;
let userBId;
let compilerAvailable = false;

const resumeIdByTitle = async (title = "Backend Resume") => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const found = list.body.resumes.find((resume) => resume.title === title);
  assert.ok(found, `resume "${title}" was not found`);
  return found._id;
};

const JOB_TEXT = `Senior Backend Engineer
Northwind Analytics - Remote (EU)

Responsibilities
- Design and ship Node.js services processing millions of events per day
- Own PostgreSQL schema design and query performance

Requirements
- 5+ years of professional backend experience
- Strong TypeScript and Node.js
- Hands-on PostgreSQL and Redis
- Bachelor's degree in Computer Science

Nice to have
- Kubernetes
- GraphQL
`;

before(async () => {
  mongod = await MongoMemoryServer.create({ instance: { dbName: "skillsync_itest" } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_URI_STANDARD = "";

  const [appModule, envModule, dbModule, modelModule, latexModule] = await Promise.all([
    import("../src/app.js"),
    import("../src/config/env.js"),
    import("../src/config/db.js"),
    import("../src/models/User.js"),
    import("../src/services/latexService.js")
  ]);

  app = appModule.app;
  models = { User: modelModule.User };
  compilerAvailable = Boolean(latexModule.findLocalCompiler());
  await dbModule.connectDB();

  const password = await bcrypt.hash("Sup3rSecret!", 8);
  const userA = await models.User.create({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password,
    isVerified: true
  });
  const userB = await models.User.create({
    name: "Grace Hopper",
    email: "grace@example.com",
    password,
    isVerified: true
  });

  userAId = String(userA._id);
  userBId = String(userB._id);
  const secret = envModule.env.jwtSecret;
  authHeaderA = `Bearer ${jwt.sign({ userId: userA._id }, secret, { expiresIn: "1h" })}`;
  authHeaderB = `Bearer ${jwt.sign({ userId: userB._id }, secret, { expiresIn: "1h" })}`;
});

after(async () => {
  await mongoose.disconnect().catch(() => {});
  if (mongod) await mongod.stop();
});

test("health endpoint responds", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("readiness endpoint reports the database state", async () => {
  const ready = await request(app).get("/api/health/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.ready, true);
  assert.equal(ready.body.database, "connected");
});

test("email verification is only enforced when explicitly enabled", async () => {
  const envModule = await import("../src/config/env.js");
  const authModule = await import("../src/services/authService.js");
  const unverified = await models.User.create({
    name: "Unverified",
    email: "unverified@example.com",
    password: await bcrypt.hash("Sup3rSecret!", 8),
    isVerified: false
  });

  const original = envModule.env.requireEmailVerification;
  try {
    envModule.env.requireEmailVerification = false;
    const allowed = await authModule.loginUser({ email: unverified.email, password: "Sup3rSecret!" });
    assert.ok(allowed.token, "login without verification is allowed by default");

    envModule.env.requireEmailVerification = true;
    await assert.rejects(
      authModule.loginUser({ email: unverified.email, password: "Sup3rSecret!" }),
      (error) => error.code === "EMAIL_UNVERIFIED" && error.statusCode === 403
    );
  } finally {
    envModule.env.requireEmailVerification = original;
    await unverified.deleteOne();
  }
});

test("protected routes reject missing and invalid tokens", async () => {
  const anonymous = await request(app).get("/api/resumes");
  assert.equal(anonymous.status, 401);

  const invalid = await request(app).get("/api/resumes").set("Authorization", "Bearer not-a-jwt");
  assert.equal(invalid.status, 401);
});

test("resume creation persists canonical data and generates LaTeX", async () => {
  const response = await request(app)
    .post("/api/resumes")
    .set("Authorization", authHeaderA)
    .send({
      title: "Backend Resume",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "+1 555 0100",
      summary: "Backend engineer with 6 years building Node.js and TypeScript services.",
      skills: ["nodejs", "TypeScript", "PostgreSQL", "Docker"],
      experience: [
        {
          role: "Senior Backend Engineer",
          company: "Northwind",
          startDate: "2021",
          endDate: "Present",
          description: "- Built Node.js services on PostgreSQL, cutting p95 latency by 38%"
        }
      ],
      education: [{ institution: "State University", degree: "B.S.", fieldOfStudy: "Computer Science", graduationYear: "2019" }],
      projects: [{ name: "Job parser", description: "Parses postings.", technologies: ["Python"] }]
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.resume.latexMode, "auto");
  assert.match(response.body.resume.latexSource, /\\documentclass/);
  // Alias normalisation: "nodejs" becomes "Node.js".
  assert.ok(response.body.resume.skills.includes("Node.js"));
});

test("resume updates ignore attempts to overwrite ownership or ids", async () => {
  const created = await request(app).post("/api/resumes").set("Authorization", authHeaderA).send({ title: "Ownership check" });
  const resumeId = created.body.resume._id;

  const response = await request(app)
    .put(`/api/resumes/${resumeId}`)
    .set("Authorization", authHeaderA)
    .send({ summary: "Updated summary", userId: userBId, _id: "000000000000000000000000", parsedText: "injected" });

  assert.equal(response.status, 200);
  assert.equal(String(response.body.resume.userId), userAId);
  assert.equal(response.body.resume.parsedText, "");
  assert.equal(response.body.resume.summary, "Updated summary");

  const otherUserRead = await request(app).get(`/api/resumes/${resumeId}`).set("Authorization", authHeaderB);
  assert.equal(otherUserRead.status, 404);
});

test("job description parsing is deterministic and persists an owned record", async () => {
  const parsed = await request(app)
    .post("/api/job/parse")
    .set("Authorization", authHeaderA)
    .send({ text: JOB_TEXT, save: true });

  assert.equal(parsed.status, 200);
  assert.equal(parsed.body.job.title, "Senior Backend Engineer");
  assert.ok(parsed.body.job.requiredSkills.includes("Node.js"));
  assert.ok(parsed.body.job.requiredSkills.includes("PostgreSQL"));
  assert.ok(parsed.body.job.preferredSkills.includes("Kubernetes"));
  assert.equal(parsed.body.job.experience.minYears, 5);
  assert.ok(parsed.body.jobDescriptionId);

  const again = await request(app).post("/api/job/parse").set("Authorization", authHeaderA).send({ text: JOB_TEXT });
  assert.deepEqual(again.body.job.requiredSkills, parsed.body.job.requiredSkills);
  assert.equal(again.body.job.experience.minYears, parsed.body.job.experience.minYears);
});

test("resume analysis returns a reproducible deterministic report", async () => {
  const resumeId = await resumeIdByTitle();

  const first = await request(app)
    .post(`/api/analysis/resume/${resumeId}`)
    .set("Authorization", authHeaderA)
    .send({ jobDescription: JOB_TEXT, useAI: false });

  assert.equal(first.status, 200);
  const report = first.body.result;
  assert.equal(report.mode, "job-targeted");
  assert.ok(Number.isInteger(report.score) && report.score >= 0 && report.score <= 100);
  assert.ok(report.inputHash);
  assert.ok(report.matchedSkills.includes("Node.js"));
  assert.ok(report.missingSkills.includes("Redis"));
  assert.ok(report.requirements.length > 0);
  assert.ok(report.scoreBreakdown.required_skills.applicable);
  assert.equal(report.ai.available, false);

  const second = await request(app)
    .post(`/api/analysis/resume/${resumeId}`)
    .set("Authorization", authHeaderA)
    .send({ jobDescription: JOB_TEXT, useAI: false });

  assert.equal(second.body.result.score, report.score);
  assert.equal(second.body.result.inputHash, report.inputHash);
});

test("job match and skill gap produce gaps, roadmap, and persisted history", async () => {
  const resumeId = await resumeIdByTitle();

  const match = await request(app)
    .post("/api/analysis/job-match")
    .set("Authorization", authHeaderA)
    .send({ resumeId, jobDescription: JOB_TEXT, useAI: false });

  assert.equal(match.status, 200);
  assert.ok(match.body.result.match_percentage > 0);
  assert.ok(match.body.result.critical_gaps.length > 0);
  assert.ok(match.body.result.roadmap.every((item) => item.timeline));

  const gap = await request(app)
    .post("/api/analysis/skill-gap")
    .set("Authorization", authHeaderA)
    .send({ resumeId, jobDescription: JOB_TEXT });

  assert.equal(gap.status, 200);
  assert.ok(gap.body.result.roadmap.length > 0);

  const history = await request(app).get("/api/analysis/history?limit=50").set("Authorization", authHeaderA);
  assert.equal(history.status, 200);
  const types = history.body.history.map((row) => row.analysisType);
  assert.ok(types.includes("resume"));
  assert.ok(types.includes("job-match"));
  assert.ok(types.includes("skill-gap"));
});

test("second user cannot read the first user's analyses or job descriptions", async () => {
  const historyB = await request(app).get("/api/analysis/history?limit=50").set("Authorization", authHeaderB);
  assert.equal(historyB.status, 200);
  assert.equal(historyB.body.history.length, 0);

  const descriptionsB = await request(app).get("/api/job/descriptions").set("Authorization", authHeaderB);
  assert.equal(descriptionsB.status, 200);
  assert.equal(descriptionsB.body.descriptions.length, 0);
});

test("resume versions are created, listed, and restorable", async () => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = list.body.resumes[0]._id;

  const version = await request(app)
    .post(`/api/resumes/${resumeId}/versions`)
    .set("Authorization", authHeaderA)
    .send({ label: "Before experiments" });
  assert.equal(version.status, 201);

  await request(app)
    .put(`/api/resumes/${resumeId}`)
    .set("Authorization", authHeaderA)
    .send({ summary: "Changed summary after the snapshot" });

  const versions = await request(app).get(`/api/resumes/${resumeId}/versions`).set("Authorization", authHeaderA);
  assert.equal(versions.status, 200);
  assert.ok(versions.body.versions.length >= 1);

  const restore = await request(app)
    .post(`/api/resumes/${resumeId}/versions/${version.body.version._id}/restore`)
    .set("Authorization", authHeaderA);
  assert.equal(restore.status, 200);
  assert.notEqual(restore.body.resume.summary, "Changed summary after the snapshot");

  const otherUser = await request(app)
    .get(`/api/resumes/${resumeId}/versions`)
    .set("Authorization", authHeaderB);
  assert.equal(otherUser.status, 404);
});

test("LaTeX is saved, regenerated, and validated", async () => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = list.body.resumes[0]._id;

  const saved = await request(app)
    .put(`/api/resumes/${resumeId}/latex`)
    .set("Authorization", authHeaderA)
    .send({ latexSource: "\\documentclass{article}\\begin{document}Manual\\end{document}", createVersion: true });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.resume.latexMode, "manual");

  const regenerated = await request(app)
    .post(`/api/resumes/${resumeId}/latex/regenerate`)
    .set("Authorization", authHeaderA)
    .send({ templateId: "modern-teal" });
  assert.equal(regenerated.status, 200);
  assert.equal(regenerated.body.resume.latexMode, "auto");
  assert.match(regenerated.body.resume.latexSource, /definecolor/);
});

test("unsafe LaTeX is rejected through the API", async () => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = list.body.resumes[0]._id;

  const response = await request(app)
    .post("/api/latex/compile")
    .set("Authorization", authHeaderA)
    .send({ resumeId, source: "\\documentclass{article}\\write18{echo hi}\\begin{document}x\\end{document}" });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "LATEX_FORBIDDEN_COMMAND");
});

test("job URL fetching blocks SSRF targets through the API", async () => {
  for (const url of ["http://169.254.169.254/latest/meta-data/", "http://127.0.0.1:80/jobs", "http://localhost/jobs"]) {
    const response = await request(app).post("/api/job/fetch").set("Authorization", authHeaderA).send({ url });
    assert.ok([400, 422].includes(response.status), `unexpected status ${response.status} for ${url}`);
    assert.ok(["PRIVATE_ADDRESS", "BLOCKED_HOST"].includes(response.body.code));
  }
});

test("latex compilation returns a real PDF when a compiler is installed", { timeout: 180000 }, async (t) => {
  if (!compilerAvailable) {
    t.diagnostic("No local LaTeX compiler; skipping compilation assertion.");
    return;
  }

  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = list.body.resumes[0]._id;

  const response = await request(app).post("/api/latex/compile").set("Authorization", authHeaderA).send({ resumeId });
  assert.equal(response.status, 200);
  const buffer = Buffer.from(response.body.pdfBase64, "base64");
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(response.body.pageCount >= 1);
});

test("approved copilot proposals are applied and snapshotted", async () => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = await resumeIdByTitle();
  const resume = list.body.resumes.find((item) => item.title === "Backend Resume");

  const before = resume.experience?.[0]?.description || "Built Node.js services on PostgreSQL, cutting p95 latency by 38%";
  const response = await request(app)
    .post("/api/copilot/apply")
    .set("Authorization", authHeaderA)
    .send({
      resumeId,
      proposals: [
        {
          section: "experience",
          index: 0,
          before,
          after: "Designed and shipped Node.js services on PostgreSQL, cutting p95 latency by 38%"
        }
      ]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.result.applied.length, 1);
  assert.equal(response.body.result.versionCreated, true);
  assert.match(response.body.result.resume.experience[0].description, /Designed and shipped/);

  const versions = await request(app).get(`/api/resumes/${resumeId}/versions`).set("Authorization", authHeaderA);
  assert.ok(versions.body.versions.some((version) => version.reason === "ai-apply"));
});

test("copilot rejects a proposal whose original text changed", async () => {
  const resumeId = await resumeIdByTitle();

  const response = await request(app)
    .post("/api/copilot/apply")
    .set("Authorization", authHeaderA)
    .send({
      resumeId,
      proposals: [{ section: "experience", index: 0, before: "text that never existed", after: "replacement" }]
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.result.applied.length, 0);
  assert.equal(response.body.result.skipped.length, 1);
});

test("AI actions surface provider failures instead of fabricating output", async () => {
  const list = await request(app).get("/api/resumes").set("Authorization", authHeaderA);
  const resumeId = list.body.resumes[0]._id;

  for (const path of ["/api/copilot/propose", "/api/analysis/generate-cover-letter"]) {
    const response = await request(app)
      .post(path)
      .set("Authorization", authHeaderA)
      .send({
        resumeId,
        action: "improve_summary",
        jobDescription: JOB_TEXT
      });

    assert.ok(response.status >= 400, `${path} unexpectedly succeeded`);
    assert.equal(response.body.success, false);
    if (response.body.code) {
      assert.ok(String(response.body.code).startsWith("AI_"), `unexpected code ${response.body.code}`);
    }
  }
});

test("job tracker accepts the richer status set and rejects unknown values", async () => {
  const created = await request(app)
    .post("/api/jobs")
    .set("Authorization", authHeaderA)
    .send({ company: "Northwind", role: "Senior Backend Engineer", status: "saved" });
  assert.equal(created.status, 201);
  assert.equal(created.body.job.status, "saved");

  const moved = await request(app)
    .patch(`/api/jobs/${created.body.job._id}`)
    .set("Authorization", authHeaderA)
    .send({ status: "interviewing" });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.job.status, "interviewing");

  const invalid = await request(app)
    .patch(`/api/jobs/${created.body.job._id}`)
    .set("Authorization", authHeaderA)
    .send({ status: "ghosted" });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, "VALIDATION_ERROR");

  const listB = await request(app).get("/api/jobs").set("Authorization", authHeaderB);
  assert.equal(listB.body.jobs.length, 0);
});

test("knowledge retrieval isolates user documents and cites curated sources", async () => {
  const knowledge = await import("../src/services/knowledgeService.js");

  await knowledge.ingestUserDocument(userAId, {
    title: "Ada private interview notes",
    text: [
      "Confidential compensation research for the quasar migration programme.",
      "Ada negotiated a retention package using specific internally verified numbers",
      "that were gathered from three separate market data sources during the review cycle,",
      "and the negotiation was completed before the annual compensation adjustment window opened."
    ].join(" ")
  });

  const own = await knowledge.retrieveKnowledge(userAId, "quasar migration retention package");
  assert.ok(own.sources.some((source) => source.title === "Ada private interview notes"));
  assert.ok(["vector+lexical", "lexical"].includes(own.retrieval));

  const other = await knowledge.retrieveKnowledge(userBId, "quasar migration retention package");
  assert.ok(!other.sources.some((source) => source.title === "Ada private interview notes"));

  const curated = await knowledge.syncCuratedKnowledge();
  assert.ok(curated.chunks > 0);

  const curatedQuery = await knowledge.retrieveKnowledge(userBId, "how do applicant tracking systems parse resumes");
  assert.ok(curatedQuery.sources.some((source) => source.kind === "curated"));

  const documents = await knowledge.listUserDocuments(userBId);
  assert.equal(documents.length, 0);
});

test("invalid job description uploads are rejected by signature validation", async () => {
  const response = await request(app)
    .post("/api/job/upload")
    .set("Authorization", authHeaderA)
    .attach("jobDocument", Buffer.from("not really a pdf"), {
      filename: "fake.pdf",
      contentType: "application/pdf"
    });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /signature/i);
});

// ---------------------------------------------------------------------------
// Untrusted upload handling
// ---------------------------------------------------------------------------

test("resume uploads reject spoofed, truncated and text-free files without side effects", async () => {
  const { buildPdf } = await import("./helpers/documents.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const before = await request(app).get("/api/resumes").set("Authorization", authHeaderB);
  const tmpBefore = new Set(await fs.readdir(os.tmpdir()));

  // HTML with a PDF Content-Type and a .pdf name.
  const spoofed = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderB)
    .attach("resume", Buffer.from("<html>definitely not a pdf</html>"), {
      filename: "resume.pdf",
      contentType: "application/pdf"
    });
  assert.equal(spoofed.status, 400);
  assert.match(spoofed.body.message, /signature/i);

  // Valid header, nothing behind it.
  const truncated = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderB)
    .attach("resume", buildPdf({ truncate: 40 }), { filename: "cut.pdf", contentType: "application/pdf" });
  assert.ok([400, 422].includes(truncated.status), `unexpected status ${truncated.status}`);
  assert.equal(truncated.body.success, false);

  // A structurally valid PDF that contains no text (a scan without OCR).
  const blank = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderB)
    .attach("resume", buildPdf({ noText: true }), { filename: "scan.pdf", contentType: "application/pdf" });
  assert.equal(blank.status, 422);
  assert.equal(blank.body.code, "DOCUMENT_NO_TEXT");

  // None of the three rejections may leave an empty resume behind or a temp file.
  const after = await request(app).get("/api/resumes").set("Authorization", authHeaderB);
  assert.equal(after.body.resumes.length, before.body.resumes.length);

  const tmpCreated = (await fs.readdir(os.tmpdir())).filter((entry) => !tmpBefore.has(entry));
  assert.deepEqual(
    tmpCreated.filter((entry) => /multer|latex-compile|upload|resume/i.test(entry)),
    [],
    "failed uploads must not leave staged files"
  );
});

test("uploaded text is escaped before it reaches the LaTeX compiler", async () => {
  const { buildPdf } = await import("./helpers/documents.js");
  const { validateLatexSource } = await import("../src/services/latexService.js");

  const created = await request(app)
    .post("/api/resumes")
    .set("Authorization", authHeaderA)
    .send({ title: "Upload target" });
  const resumeId = created.body.resume._id;

  const uploaded = await request(app)
    .post(`/api/resumes/${resumeId}/upload-pdf`)
    .set("Authorization", authHeaderA)
    .attach("resumePdf", buildPdf({ text: "\\input{/etc/passwd} and 100% R&D" }), {
      filename: "resume.pdf",
      contentType: "application/pdf"
    });

  assert.equal(uploaded.status, 200);
  assert.match(uploaded.body.resume.parsedText, /input\{\/etc\/passwd\}/);
  // The document's text is data, never LaTeX: the backslash is escaped.
  assert.match(uploaded.body.resume.latexSource, /\\textbackslash\{\}input/);
  assert.doesNotThrow(() => validateLatexSource(uploaded.body.resume.latexSource));
});

test("uploads cannot write into another user's resume", async () => {
  const { buildPdf } = await import("./helpers/documents.js");

  const target = await request(app)
    .post("/api/resumes")
    .set("Authorization", authHeaderB)
    .send({ title: "Grace private" });
  const resumeId = target.body.resume._id;

  const attempt = await request(app)
    .post(`/api/resumes/${resumeId}/upload-pdf`)
    .set("Authorization", authHeaderA)
    .attach("resumePdf", buildPdf({ text: "cross user write" }), {
      filename: "resume.pdf",
      contentType: "application/pdf"
    });

  assert.equal(attempt.status, 404);
  const stillMine = await request(app).get(`/api/resumes/${resumeId}`).set("Authorization", authHeaderB);
  assert.equal(stillMine.status, 200);
  assert.equal(stillMine.body.resume.parsedText, "");
});

test("upload filenames are never used as filesystem paths", async () => {
  const { buildPdf } = await import("./helpers/documents.js");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const before = new Set(await fs.readdir(os.tmpdir()));
  const upload = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderA)
    .attach("resume", buildPdf({ text: "traversal probe" }), {
      filename: "../../../../tmp/pwn-skillsync.pdf",
      contentType: "application/pdf"
    });

  assert.ok([200, 201].includes(upload.status), `unexpected status ${upload.status}`);

  const created = (await fs.readdir(os.tmpdir())).filter((entry) => !before.has(entry));
  assert.ok(!created.some((entry) => /pwn-skillsync|multer|latex-compile/.test(entry)), created.join(","));
  await assert.rejects(fs.access(path.join(os.tmpdir(), "pwn-skillsync.pdf")));
});

test("oversized and archive-bomb uploads are rejected before parsing", async () => {
  const { buildDocxBomb } = await import("./helpers/documents.js");

  const oversized = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderA)
    .attach("resume", Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(9 * 1024 * 1024)]), {
      filename: "huge.pdf",
      contentType: "application/pdf"
    });
  assert.equal(oversized.status, 413);

  const bomb = await request(app)
    .post("/api/resumes/upload")
    .set("Authorization", authHeaderA)
    .attach("resume", buildDocxBomb(), {
      filename: "resume.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  assert.equal(bomb.status, 422);
  assert.equal(bomb.body.code, "DOCUMENT_TOO_COMPLEX");
});

test("job uploads accept plain text but reject text-free documents", async () => {
  const { buildPdf } = await import("./helpers/documents.js");

  const textUpload = await request(app)
    .post("/api/job/upload")
    .set("Authorization", authHeaderA)
    .attach("jobDocument", Buffer.from(JOB_TEXT), { filename: "role.txt", contentType: "text/plain" });
  assert.equal(textUpload.status, 201);
  assert.ok(textUpload.body.job.requiredSkills.includes("Node.js"));

  const blank = await request(app)
    .post("/api/job/upload")
    .set("Authorization", authHeaderA)
    .attach("jobDocument", buildPdf({ noText: true }), { filename: "role.pdf", contentType: "application/pdf" });
  assert.equal(blank.status, 422);
  assert.equal(blank.body.code, "DOCUMENT_NO_TEXT");
});

# SkillSync AI — Audit, Implementation, and Verification Report

Audit and implementation: 2026-10-18. Independent verification pass: 2026-10-23.
Scope: the existing MERN repository (`frontend/`, `backend/`, `Arch/`). Nothing was
rebuilt from scratch; every change extends the code that was already there.

---

## Phase 1 — Audit of the existing application

What existed and worked: JWT auth with email verification and password reset,
MongoDB persistence for users/resumes/analyses/interviews/job applications,
PDF/DOCX resume parsing, a rule-based fallback for AI, a job-application kanban,
mock-interview question generation, career-coach chat, and a glassmorphic React UI.

Defects found (all fixed unless listed under "Remaining"):

| # | Defect | Severity | Where |
| --- | --- | --- | --- |
| 1 | **Fabricated AI results.** When Gemini failed (invalid key, quota, timeout), the backend silently returned hardcoded scores, cover letters, interview questions, and gap roadmaps with a fake "76" ATS score. Users could not tell real analysis from invented output. | Critical | `services/aiService.js` |
| 2 | **Resume mass-assignment.** `PUT /api/resumes/:id` spread the request body onto the Mongoose document, letting a caller set `userId` (transferring the resume to another account) or `parsedText`. | Critical | `services/resumeService.js` |
| 3 | **Per-owner failures returned 500.** `getResumeById`/job lookups threw plain `Error`, so another user's resource produced a 500 instead of 404. | High | `services/resumeService.js`, `services/jobService.js`, `middlewares/errorMiddleware.js` |
| 4 | **SSRF-prone job fetching.** `axios.get` on any user URL with a browser User-Agent, no protocol/port/host checks, no redirect validation, no metadata/private-address blocking. | Critical | `services/jobFetchService.js` |
| 5 | **Pervasive wildcard CORS.** Any `*.vercel.app` and `*.onrender.com` origin was allowed. | High | `app.js` |
| 6 | **No LaTeX capability at all.** `Arch/` and the UI claimed a "resume studio" but there was no editor, no compiler, no versioning. | High | frontend + backend |
| 7 | **Hardcoded mock data in the UI.** Job Match showed a fake "Nimbus Labs / Senior Product Designer / $115k–$145k" company card; the ATS page showed a fabricated "Git diff" rewrite example; several ATS weight claims (25/25/30/20) did not match the backend formula. | High | `pages/JobMatchPage.jsx`, `pages/ResumeAnalyzerPage.jsx` |
| 8 | **ATS scoring was an LLM guess** blended with a thin heuristic, with no reproducible formula, no evidence, no requirement matrix, and no matched/missing keyword separation. | High | `services/analysisService.js` |
| 9 | Dead endpoint: the builder called `POST /api/analysis/improve-resume`, which auto-wrote AI text into the resume with no review step. | Medium | `pages/ResumeBuilderPage.jsx` |
| 10 | Only the PDF magic bytes were validated; DOCX uploads were trusted on MIME alone; no job-description upload existed. | Medium | `middlewares/pdfSecurityMiddleware.js` |
| 11 | No `.env.example` coverage for the features that existed (Resend), and no production env documentation. | Medium | `backend/.env.example` |
| 12 | No tests, no test script, no deterministic engine to test. | High | repo-wide |
| 13 | Job-description skill extraction ran over the whole posting, so the title/company banner leaked into requirements (the company "Northwind Analytics" produced a required skill "Data Analysis"), and when a posting had no explicit requirements heading the "nice to have" skills were scored as mandatory. | Medium | `services/jdParser.js` |

---

## Phase 2 — LaTeX Resume Studio (implemented)

- **Backend** `services/latexService.js` + `services/latexTemplates.js`
  - Three professional templates (ATS Classic, Modern Teal, Compact One Page) generated from canonical resume data with full escaping.
  - Compilation sandboxed in a fresh temp directory with a hard timeout, output/size limits, a sanitised environment (`openin_any=p`, `openout_any=p`), and Tectonic's `--untrusted` (or pdfLaTeX `-no-shell-escape -halt-on-error`).
  - Command/package allowlisting: `\write18`, `\input`, `\include`, `\openin`, `\openout`, `\read`, `\immediate`, `\directlua`, `\special`, `\includegraphics`, `shellesc`, `minted`, `pythontex`, `filecontents`, and non-allowlisted packages are rejected with line numbers.
  - `LATEX_COMPILE_URL` forwards to an isolated compiler service; in production local compilation is refused unless `LATEX_ALLOW_LOCAL=true`.
  - Real PDF output, page count parsed from the compiler log, and line-numbered errors parsed from both Tectonic diagnostics and pdfLaTeX `l.NN` output.
- **Frontend** `pages/LatexStudioPage.jsx`
  - Split view with a draggable divider, line-numbered dependency-free LaTeX syntax highlighting, undo/redo, Tab indentation, Ctrl+S (save version), Ctrl+Enter (compile).
  - Live PDF preview in an iframe with page navigation, zoom, and PDF/.tex download.
  - Autosave (2.5 s debounce), manual version saves, version list with load-into-editor and restore.
  - Compiler-error panel where clicking an error jumps the editor to that line.
  - AI panel with a diff review modal: before/after per proposal, per-change checkboxes, accept/reject; new numeric claims are flagged `fabricationRisk`.
  - Explicit banner and manual-edit fallback when no compiler is configured.

## Phase 3 — Job description intelligence (implemented)

- `POST /api/job/parse` (pasted text), `POST /api/job/upload` (PDF/DOCX/TXT with signature validation), `POST /api/job/fetch` (public URL), `GET/DELETE /api/job/descriptions`.
- `services/jdParser.js` deterministically extracts title, company, location, responsibilities, required/preferred qualifications, required/preferred skills, experience range, education level and field, keywords, and technologies, and returns per-field warnings. Unknown fields stay empty — nothing is guessed.
- URL fetching uses JSON-LD `JobPosting` first, then main/article/description containers; blocked pages, timeouts, non-HTML responses, and CAPTCHA walls return `JD_FETCH_BLOCKED` / `JD_FETCH_TIMEOUT` / `JD_FETCH_NEEDS_PASTE` with a "paste it instead" hint.
- `utils/ssrfGuard.js`: protocol/port/credential checks, hostname blocklist, DNS resolution with all-private-range rejection (IPv4, IPv6 incl. IPv4-mapped, CGNAT, metadata services), redirect validation per hop, and DNS pinning via a custom `lookup` so the checked address is the address used.
- **UI**: the extracted JD is always shown for review before analysis; pasted, uploaded, and fetched sources are labelled.

## Phase 4 — Deterministic ATS engine (implemented)

`services/atsEngine.js` (engine `skillsync-deterministic-ats` v2.0.0) computes:

- required skill match (alias-aware), keyword coverage, preferred skill match, experience alignment (from dated role ranges), role alignment (title/seniority tokens), education alignment, section completeness, formatting/parsing warnings, and achievement evidence (metric + action-verb density).

Design decisions:

- Weights are configurable (`ATS_WEIGHTS_JSON`) and documented; non-applicable dimensions (for example education when the JD states no requirement) are removed and the remaining weights are renormalised instead of scored as zero.
- `mode` is `job-targeted` or `resume-only`, and the report states which dimensions were scored.
- Every report carries `engineVersion` plus a SHA-256 `inputHash` over the resume text, skills, JD-derived requirements, and effective weights: identical inputs produce an identical score (asserted in tests).
- The response includes `scoreBreakdown` with per-dimension weight, applicability, and explanation, plus matched/missing skills and keywords, a requirement-by-requirement evidence table, severity-tagged warnings, and prioritised recommendations.
- The API explicitly states this is not a reproduction of any vendor's proprietary ATS algorithm.

## Phase 5 — AI resume copilot with human approval (implemented)

- `POST /api/copilot/propose` supports `tailor_to_job`, `improve_bullet`, `improve_summary`, `improve_projects`, `missing_keywords`, `fix_formatting`, `explain_latex`, `shorten_one_page`.
- `POST /api/copilot/apply` applies **only** user-approved proposals, validates each against the current document (stale `before` text is skipped with a reason), snapshots a "Before AI changes" version, and regenerates LaTeX only in auto mode.
- Prompts wrap resume/JD text in `<untrusted_...>` blocks with explicit "data, not instructions" rules, and are instructed never to invent employers, titles, dates, degrees, certifications, metrics, or technologies. Any new number in a proposal is flagged for the user.
- Canonical resume data is the source of truth: auto mode regenerates LaTeX after edits; manual mode preserves hand-edited source.

## Phase 6 — Job match and skill gap (implemented)

`services/jobMatchEngine.js` produces overall match percentage plus per-dimension scores, matched/missing required skills, preferred gaps, critical gaps ordered by how often the JD mentions them, requirement-by-requirement status with resume evidence snippets, matched/missing keywords, a prioritised roadmap (priority, category, JD mention count, curated official resource links, timeline, practice project), and `next_best_skill`. Results persist as `Analysis` records tied to user, resume, and job description.

## Phase 7 — Cover letter (implemented)

Tone selection (professional, concise, technical, enthusiastic), generation grounded in the resume and extracted JD, numeric-claim warnings when the letter introduces numbers absent from resume and JD, editable output, PDF export, server-side history (`CoverLetter` model + `GET/PATCH /api/analysis/cover-letters`).

## Phase 8 — Agentic workflow (decision + partial implementation)

Decision: **no separate LangGraph service.** The workflow (validate input → parse/fetch JD → load resume → deterministic ATS → skill gaps → AI proposals → cover letter → interview plan → user review → persist approved output) runs inside the existing Express services with explicit steps, deterministic calculations, timeouts on every provider call, and human approval gates before any write. Adding a Python runtime would duplicate the data layer and authentication for a workflow that has no branching that requires a graph engine. If the workflow later grows long-running or needs parallel branches with checkpointing, the natural seam is `analysisService`/`resumeCopilotService` behind a `WorkflowRun` collection and a queue — not a rewrite of the API.

Not implemented: a persisted, resumable workflow run with progress streaming (SSE) and pause/resume. Current flow is request-scoped.

## Phase 9 — RAG career coach (implemented)

- Ingestion and chunking in `services/knowledgeService.js`; embeddings via `GEMINI_EMBEDDING_MODEL`; vectors stored in MongoDB.
- Vector store choice: **MongoDB** (already deployed, no new vendor or cost). Retrieval computes cosine similarity in application code over a `userId`-scoped candidate set. At larger corpus sizes the documented upgrade path is Atlas Vector Search on the same collection; nothing in the API changes.
- Retrieval falls back to deterministic lexical scoring when embeddings are unavailable, and the response labels which mode was used (`vector+lexical` vs `lexical`).
- Isolation: queries match only curated chunks (`userId: null`) or the authenticated user's own chunks. Asserted in tests.
- The coach returns answers with citations (source number, title, URL, short quote) and keeps server-side history.

## Phase 10 — Mock interview (existing, hardened)

Question generation, answer evaluation, improvement loops, and voice-transcript evaluation remain, but the fabricated fallback is gone: provider failures now surface as `AI_*` errors instead of invented scores and questions. Text answers continue to work without any speech service; transcript evaluation explicitly refuses to claim pronunciation or fluency measurement.

## Phase 11 — Persistence (implemented)

New/extended collections: `ResumeVersion`, `JobDescription`, `CoverLetter`, `CoachMessage`, `KnowledgeChunk`; `Analysis` gained `jobDescriptionId`, `engineVersion`, `inputHash` and the `skill-gap` type; `Resume` gained `latexSource`, `templateId`, `latexMode`, `lastCompiledAt`; `JobApplication` gained the Saved/Applied/Interviewing/Offered/Rejected status set (legacy `interview`/`offer` values still map). Every record is scoped by the authenticated user.

## Phase 12 — Security and reliability (implemented where listed)

SSRF guard, CORS allowlist (no wildcards), resume field allowlist, real file-signature validation for PDF/DOCX/TXT, LaTeX command and package restrictions, provider timeouts with explicit failure codes, error mapping (CastError → 400, ValidationError → 400, duplicate key → 409, file too large → 413) without leaking stack traces, and structured `[API_ERROR]`/`[AI_PROVIDER_ERROR]` logging that sanitises key-like strings.

## Phase 13 — Environment variables (implemented)

`backend/.env.example` documents every variable the code reads, and `PRODUCTION_ENV_CHECKLIST.md` documents purpose, defaults, local Tectonic setup, deploy verification steps, and the "never do this" rules.

## Phase 14 — Testing (implemented)

`cd backend && npm test` → **68 tests, 68 passing, 0 failing, 0 skipped** (14.7 s), including:

- `skillDictionary.test.js` — alias normalisation, longest-alias precedence, false-positive avoidance, matching.
- `jdParser.test.js` — section detection, title/skills/experience/education/keyword extraction, requirement coverage, no title/company words counted as skills, and "nice to have" skills staying preferred when the posting has no requirements heading.
- `atsEngine.test.js` — determinism (same score **and** same hash), weight configurability, resume-only renormalisation, rich header text weights, warning severities, experience-year estimation.
- `jobMatchEngine.test.js` — determinism, critical gaps, evidence, preferred-vs-required separation, roadmap scoping.
- `ssrfGuard.test.js` — 18 blocked address forms, public address allowance, protocol/credential/port rejection, DNS pinning.
- `jobFetchService.test.js` — blocked URLs rejected before any network call.
- `latex.test.js` — escaping correctness (single-pass, no double-escaping), emoji stripping, template structure, forbidden-command and package rejection, unsafe-link rejection, **real PDF compilation**, and **line-numbered error parsing for broken LaTeX**.
- `latexRemote.test.js` — the isolated-compiler contract: bearer-token forwarding, non-PDF response rejection, and the service's own `400/422/504` codes surviving instead of collapsing into `502`.
- `api.integration.test.js` — real Express app against an in-memory MongoDB: auth rejection, resume creation + alias normalisation, ownership tamper attempts, JD parse determinism + persistence, reproducible ATS report (score and hash equal across calls), job match/skill gap + history, cross-user isolation for analyses/job descriptions/versions/jobs/knowledge documents, version create/list/restore, LaTeX save/regenerate, forbidden-LaTeX rejection through HTTP, SSRF blocking through HTTP, real PDF compilation through the API, copilot apply + snapshot, stale-proposal rejection, **AI failure honesty** (no fabricated cover letter or proposal), richer job statuses with invalid status → 400, file-signature rejection.

Frontend: `npm run build` succeeds (LaTeX Studio chunk built).

---

## Phase 15 — Independent verification pass (2026-10-23)

Everything below was executed in this checkout, not inferred from the code. Commands are
reproducible: `npm run verify:ai`, `npm run verify:e2e`, `npm run verify:persistence` in
`backend/`, plus the commands named in each section.

### 15.1 MongoDB Atlas connectivity — **cluster hostname no longer exists**

Configuration audited without printing credentials: `MONGODB_URI` is a **standard**
`mongodb://` URI (not `+srv`) containing three shard hosts under one subdomain, the
`career_copilot` database, `ssl=true`, `replicaSet=atlas-ah142i-shard-0`,
`authSource=admin`, and a username/password. `MONGODB_URI_STANDARD` holds the same three
hosts.

| Probe | Result |
| --- | --- |
| `NS mongodb.net` (Cloudflare DoH) | resolves — public DNS is reachable |
| `A google.com` (Cloudflare DoH) | resolves |
| `https://cloud.mongodb.com` | HTTP 200 — outbound HTTPS is fine |
| `SOA g3h6jpz.mongodb.net` | **NXDOMAIN** |
| `A ac-jirlwu8-shard-00-0{0,1,2}.g3h6jpz.mongodb.net` | **NXDOMAIN** |
| Local system resolver (`dns.getServers()` → `127.0.0.1`) | `ECONNREFUSED` for every query |

Two independent faults, only one of which matters for the deployment:

1. **The cluster subdomain is gone.** An authoritative resolver says the whole
   `g3h6jpz.mongodb.net` zone does not exist. The cluster was deleted, or the URI belongs
   to an old project/subdomain. No credential, whitelist, or TLS setting can fix this — the
   connection string has to be replaced with the current one from Atlas.
2. **This machine's stub DNS resolver (`127.0.0.1`) refuses queries.** That is a local
   environment problem that would break any hostname lookup; it is *not* the cause of the
   NXDOMAIN above.

Application behaviour with the shipped configuration: `PORT=5053 node src/server.js` made
all three connection attempts (8 s selection timeout each), logged
`getaddrinfo ENOTFOUND …` and exited with status 1. It **did not** fall back to in-memory
storage. Two diagnostics were improved in `src/config/db.js`: IP-literal hosts (local and
in-memory MongoDB) skip the pointless DNS probe, and an `ENOTFOUND`/`EAI_AGAIN` failure now
prints "the cluster hostname is stale or the cluster was deleted" instead of the misleading
"IP whitelist" text MongoDB's driver produces.

### 15.2 Live Gemini generation — **verified against the real provider**

The key was read from `backend/.env` through the app's own config and never printed,
logged, or written anywhere (the verification script now reports presence only — not even
the key length). Model: `models/gemini-2.5-flash`.

`npm run verify:ai` (one real request per feature):

| Feature | Result | Latency |
| --- | --- | --- |
| Resume copilot proposals (`improve_summary`) | 1 summary proposal, no fabrication warning | 14.5 s |
| Cover letter (technical tone) | 248 words, 5 highlights | 9.0 s |
| Career coach (with a supplied source) | 642-char answer, 4 actions, 1 citation | 3.7 s |
| Interview questions | 5 questions, Easy→Hard, 3+ tied to resume evidence | 6.9 s |

All four passed on the first attempt. Through the HTTP API (section 15.4) the ATS narrative,
copilot proposal, and a 257-word cover letter were also generated live and persisted to
cover-letter history. Content was grounded in the supplied resume; the one oddity worth
knowing is that the sample resume's employer is the same company as the sample JD, so the
letter opens "As a current Senior Backend Engineer at Northwind Analytics…" — truthful for
that fixture, not a template defect.

### 15.3 LaTeX compilation — isolated service implemented and exercised

New `latex-compiler/` service (`server.mjs`, `Dockerfile`, `docker-compose.yml`,
`README.md`) with the backend forwarding through `LATEX_COMPILE_URL` +
`LATEX_COMPILE_TOKEN`. The API is a second line of defence; the service rejects before any
TeX process starts.

| Control | Enforced value |
| --- | --- |
| Authentication | bearer token ≥16 chars, constant-time compare |
| Source size | 200,000 chars |
| Wall clock | 20 s, whole process tree killed |
| PDF size | 5 MiB, checked with `stat` before reading |
| Shell escape | disabled (`--untrusted`) |
| Bundle downloads | disabled in the image (`--only-cached`) |
| File I/O commands | `\input`, `\include`, `\openin`, `\openout`, `\write18`, `\immediate`, `\special`, `\directlua`, `\includegraphics`, … rejected |
| Container | non-root, read-only rootfs, `noexec` 64 MiB `/tmp`, `cap_drop: ALL`, `no-new-privileges`, 512 MiB RAM, 1 CPU, 64 PIDs, internal network only |

Adversarial checks against the running service (results recorded, not assumed):

| Input | Response |
| --- | --- |
| `\immediate\write18{touch /tmp/pwned-by-latex}` | `400 LATEX_FORBIDDEN_COMMAND`; marker file absent |
| `\input{/etc/passwd}` | `400 LATEX_FORBIDDEN_COMMAND` |
| `\input{../backend/.env}` (credential exfiltration) | `400 LATEX_FORBIDDEN_COMMAND` |
| No bearer token | `401` |
| Self-referential macro (infinite expansion) | `504 LATEX_TIMEOUT` after 20.7 s |
| Valid document | `200 application/pdf` |

Real compilation through the full path (API → service → Tectonic 0.17.0): **21,665-byte
and 22,038-byte PDFs**, both starting with `%PDF-`, reported as engine
`remote-isolated-latex`. With `LATEX_COMPILE_URL` unset and `LATEX_ALLOW_LOCAL=false` the
API returns `503` rather than executing TeX in-process.

Risk rationale for not compiling locally in production (`latex-compiler/README.md`): TeX
shares the API host's CPU/memory/PID budget, sees its filesystem view, needs network for
bundle downloads on first use, and inherits the blast radius of any engine or package-parser
bug. None of that is bounded without namespaces and cgroups, which is exactly what the
container provides.

### 15.4 Full user workflow over HTTP — 13/13 steps

Run against the real Express app on `:5051`, an isolated compiler on `:5070`, and a live
Gemini key:

| Step | Evidence |
| --- | --- |
| Sign up + token | user created, JWT returned |
| Unauthenticated request | `401` |
| Create resume | 54 lines of generated LaTeX |
| Compile to PDF | 21,665 bytes, `remote-isolated-latex` |
| Upload that PDF and parse it | 2 experience entries recovered |
| Parse JD | required `TypeScript, Node.js, PostgreSQL, Redis, Database Design`; preferred `GraphQL, Kubernetes` |
| ATS report | score 74, `inputHash dc21e8082c08…`, 3 missing skills |
| Copilot proposal | 1 proposal, requires approval |
| Apply approved change + snapshot | summary updated, 1 version created |
| Recompile | 22,038-byte PDF |
| Cover letter | 257 words, saved to history |
| Save application + status change | `applied` → `interviewing`, verified by re-read |
| Second user's access | foreign resume `404`; history/letters/jobs all empty |

### 15.5 Persistence across a real restart

`npm run verify:persistence` boots the API on a **persistent** on-disk MongoDB data
directory, writes a resume, a version, a JD, an analysis, and a job application over HTTP,
kills the server, boots it again on the same directory, then reads everything back through
the **pre-restart JWT** and a fresh login.

```
PASS | resume, version, JD, analysis history, and job application all survived the restart
PASS | the pre-restart JWT and a fresh login both still read the data
```

(The script had to create its `MEMORY_DB_PATH` directory first — `mongodb-memory-server`
scans an existing directory and failed with `ENOENT` until `dev-inmemory.js` ran `mkdir`.)

### 15.6 Authorization isolation

Covered twice: as the last E2E step (above) and by the integration suite, which asserts
`401` without a token, `404` for another user's resume, and empty history/letter/job lists
for a second account.

### 15.7 Regression checks

| Check | Result |
| --- | --- |
| `cd backend && npm test` | **68 tests, 68 pass, 0 fail, 0 skipped** (14.7 s) |
| `cd frontend && npm run build` | success, 55.9 s; one >500 kB vendor chunk warning |

---

## Phase 16 — Deployment-readiness pass (2026-10-23, second run)

Atlas was explicitly deferred. Everything that does not need a cloud database was
executed; the results below are from this checkout, and every failing provider call is
reported with the provider's own code.

### 16.1 Docker is not installed on this machine

`docker --version`, `docker compose version` and `docker info` all return
`command not found`. The compiler **container was therefore not built or run**, and no
claim is made that it works. What was verified instead is the service the container runs,
with the image's own flags (`--only-cached`, 200,000-char cap, 8 s timeout for the test
run):

```
cd latex-compiler
SERVICE_URL=http://127.0.0.1:5071 COMPILE_TOKEN=… node verify.mjs
```

| Check | Result |
| --- | --- |
| `/healthz` reports engine + limits | engine `tectonic`, `cached-only true`, concurrency 2 |
| No token / wrong token | `401` both |
| `\immediate\write18{touch …}` | `400 LATEX_FORBIDDEN_COMMAND` |
| `\input{/etc/passwd}` | `400 LATEX_FORBIDDEN_COMMAND` |
| `\input{../backend/.env}` | `400 LATEX_FORBIDDEN_COMMAND` |
| Missing `\begin{document}` | `400 LATEX_STRUCTURE_INVALID` |
| Malformed JSON | `400 LATEX_INVALID_REQUEST` |
| 260 k-character source | `413 LATEX_SOURCE_TOO_LARGE` |
| Infinite macro expansion | `504 LATEX_TIMEOUT` after 9 s (limit 8 s) |
| Valid document | `200`, 4 KB PDF, 676 ms |
| Temp directories after rejections and a success | 0 |
| 4 concurrent compiles (limit 2) | 4/4 PDFs, 1 s |

**13/13 passed** (the suite was later expanded to 17 checks, §17). One real defect was found and fixed: an oversized body used to call
`req.destroy()`, so the caller saw a network error instead of the `413` explaining the
limit. The service now drains the rest of the body without buffering and returns the
`413`; `requestTimeout` is also bounded (`TIMEOUT_MS + 30 s`) instead of disabled.

Exact container commands and the checks that remain (health status, no host port, memory
ceiling, read-only rootfs, no egress, and the read-only Tectonic cache risk) are listed in
[latex-compiler/README.md](latex-compiler/README.md#container-checks-still-outstanding).
`verify.mjs` is copied into the image so the same checks (17 as of §17) can run inside the compose
network.

### 16.2 Gemini — live, then the free-tier quota ran out (honestly reported)

`npm run verify:ai` was extended with the ATS narrative and passed **5/5** against the real
provider on `models/gemini-2.5-flash`. The key is read from `backend/.env`; the script reports
only that it is present (not even its length) and never logs it:

| Feature | Result | Latency |
| --- | --- | --- |
| ATS recommendations | 674-char feedback, 5 strengths, 3 improvements, 3 rewrites | 8.4 s |
| Resume copilot proposals | 1 summary proposal | 12.5 s |
| Cover letter | 238 words, 5 highlights | 9.8 s |
| RAG career coach | 954-char answer, 4 actions, 1 citation | 4.6 s |
| Interview questions | 5 questions | 7.8 s |

After roughly 20 generations the provider returned its free-tier limit verbatim:
`429 … limit: 20 … Generate content requests per day limit exceeded on Free Tier … Please retry in 15h38m`.
No AI output was fabricated at any point; every affected endpoint returned an `AI_*` error.

**Bug found by that failure and fixed.** Some paths reported the exhausted quota as
`503 AI_AUTH_FAILED` (“key missing or invalid”) because the classifier tested auth
substrings before rate-limit ones. `classifyProviderFailure()` now checks rate limits first
and distinguishes a daily quota from a per-minute burst, with five regression tests in
`test/aiErrors.test.js`. Re-running the workflow after the fix returned
`429 AI_RATE_LIMITED` with “quota exhausted (free-tier daily limit)” — the correct
advice.

Model availability probed without printing the key: `gemini-2.5-flash-lite` is advertised
by `ListModels` but answers `404 … no longer available`; `gemini-3.5-flash-lite` and
`gemini-3.1-flash-lite` answered `200`; `gemini-3.8-flash` answered `503` high demand. The
shipped default stays `models/gemini-2.5-flash` (it was verified earlier the same day).
The complete workflow below was re-run with `GEMINI_MODEL=models/gemini-3.5-flash-lite`
because the default model's daily quota was spent; that substitution is the only difference
from the default configuration.

### 16.3 Whole user workflow over HTTP — 15/15

API on `:5058` (production mode, remote compiler, live provider), isolated compiler on
`:5071`, in-memory MongoDB (temporary by design):

| Step | Evidence |
| --- | --- |
| Sign up | user created, token issued |
| Log in | token issued; wrong password → `401 INVALID_CREDENTIALS` |
| Unauthenticated access | `401` |
| Create resume | 54 lines of generated LaTeX |
| Compile PDF | 21,665 bytes, engine `remote-isolated-latex` |
| Upload that PDF and parse | 2 experience entries |
| Parse JD | required `TypeScript, Node.js, PostgreSQL, Redis, Database Design`; preferred `GraphQL, Kubernetes` |
| ATS report | score 74, `inputHash dc21e8082c08…`, 3 missing skills |
| Copilot proposal | 1 proposal, approval required |
| Apply approved change + snapshot | summary updated, 1 version |
| Recompile | 22,060-byte PDF |
| Cover letter | 240 words, saved to history |
| Interview preparation | 5 questions, session persisted |
| Application history | `applied` → `interviewing`, verified by re-read |
| Second user | foreign resume `404`; history/letters/jobs all empty |

With the default model and the exhausted quota the same run scored 11/15: the four AI steps
failed, all with `429 AI_RATE_LIMITED`, which is the intended behaviour.

### 16.4 Render + Vercel readiness

Added [`render.yaml`](render.yaml) (root `backend`, `npm ci --omit=dev`, `npm start`,
readiness health check) and made [`frontend/vercel.json`](frontend/vercel.json) explicit
(Vite framework, `npm run build`, `dist`, SPA rewrite). Added `/api/health/ready`, which
reports `connected`/`503` from the Mongoose state instead of always returning `200`.

A production-mode instance (`NODE_ENV=production`, `CLIENT_URL=https://skillsync-ai.vercel.app`,
`ALLOWED_ORIGINS=https://skillsync-preview.vercel.app`) was probed directly:

| Probe | Result |
| --- | --- |
| `Origin: https://skillsync-ai.vercel.app` | `Access-Control-Allow-Origin` echoed |
| `Origin: https://skillsync-preview.vercel.app` | allowed via `ALLOWED_ORIGINS` |
| `Origin: https://evil.example.com` | no CORS header |
| `Origin: http://localhost:5180` in production | rejected |
| Unknown route | `404` `{success:false}` envelope |
| `/api/resumes` without a token | `401` |
| `\write18` through `/api/latex/compile` | `400 LATEX_FORBIDDEN_COMMAND` |
| Compile with no remote compiler configured | `503 LATEX_LOCAL_DISABLED` |
| `/api/health/ready` | `200 connected` |

The new `npm run verify:deploy` scripts those checks against any base URL.
**10/10 passed** against the running API, including a real 3 KB PDF. Its first run failed
because the script expected a raw PDF body while the API returns `{ pdfBase64 }` — the
script was corrected, and that is exactly the kind of assumption this check exists to catch.

Deployment instructions are in [PRODUCTION_ENV_CHECKLIST.md](PRODUCTION_ENV_CHECKLIST.md)
§7 (7.1 pre-deploy, 7.2 Render, 7.3 Vercel, 7.4 post-deploy) and the README deployment
section. Nothing was deployed and no hosting account was touched.

### 16.5 Email (Resend) — configuration documented, delivery still unproven

The exact steps are now in [PRODUCTION_ENV_CHECKLIST.md](PRODUCTION_ENV_CHECKLIST.md) §4:
add and verify a domain (DNS: `MX send.<domain> → feedback-smtp.<region>.amazonses.com`,
`TXT send.<domain> → v=spf1 include:amazonses.com ~all`, DKIM
`TXT resend._domainkey.<domain>`, optional `_dmarc`), set
`RESEND_FROM_EMAIL=noreply@<verified-domain>`, keep `CLIENT_URL` pointed at the public
frontend (verification links are `${CLIENT_URL}/verify-email?token=…`, resets are
`${CLIENT_URL}/reset-password?token=…`), then set `REQUIRE_EMAIL_VERIFICATION=true`.

Two honesty/security fixes landed in this pass:

- Signup now returns `emailDispatched` and a message that matches reality; previously it
  claimed a link had been dispatched even when Resend rejected the send.
- A failed send no longer prints the live verification token to the log in production
  (development only). The token is a single-use account credential.

Email verification is enforced only when `REQUIRE_EMAIL_VERIFICATION=true` (default
`false`), because `onboarding@resend.dev` can only deliver to the Resend account owner and
turning enforcement on before a verified domain exists would lock every new user out.
**Not verified:** delivery to a third-party inbox, bounces, DMARC enforcement.

### 16.6 MongoDB Atlas — unchanged, deliberately not retried

The `MONGODB_URI` cluster hostname remains `NXDOMAIN` (§15.1). Nothing in the code falls
back to in-memory storage: `npm start` exits non-zero. `npm run dev:memory` is documented as
disposable (all data is lost on exit unless `MEMORY_DB_PATH` is set), and `render.yaml`
requires a real `MONGODB_URI`. No production database configuration was changed to hide the
failure.

### 16.7 Regression and repeat runs

| Check | Result |
| --- | --- |
| `cd backend && npm test` | **80 tests, 80 pass, 0 fail, 0 skipped** (9.3 s final run, 14.8 s earlier; +12 since §15) |
| `cd frontend && npm run build` | success, 25.8 s (same >500 kB vendor chunk warning) |
| `npm run verify:persistence` | PASS — resume, version, JD, analysis history, application survived a real restart, readable by the old JWT and a fresh login |
| `npm run verify:ai` | 5/5 before the quota was exhausted |
| `npm run verify:e2e` | 15/15 (alternate model as noted) |
| `npm run verify:deploy` | 10/10 |
| `latex-compiler/verify.mjs` | 13/13 (17/17 after §17) |

A first persistence attempt failed with “server did not become healthy” while three
in-memory MongoDB instances were running; the script also hung because a failed start left
its child alive. `verify-persistence.js` now raises the startup budget to 120 s, captures
spawn errors, and kills the child before throwing. It passed on a clean rerun.

---

## Phase 17 — Compiler containment probe (2026-10-23, third run)

Docker is still unavailable (`docker`, `docker compose`, `podman`, `nerdctl` and WSL are all
absent), so the container layer was **not** executed. Instead, the assumptions the container
rests on were tested against the same Tectonic binary and flags the image uses, and the
compose file was audited against those results.

### 17.1 A real filter bypass: `\csname`

Tectonic 0.17.0's `--untrusted` disables shell escape but **not file reads**, and it ignores
kpathsea variables: with `openin_any=p openout_any=p` exported it still read
`C:/Windows/win.ini`, printing only "accessing absolute path … build may not be
reproducible". The service's blocklist was therefore the only barrier for reads, and it
matched literal commands:

| Payload | Observed before the fix |
| --- | --- |
| `\csname input\endcsname{C:/Windows/win.ini}` | file read and typeset; the filter saw nothing |
| `\csname write18\endcsname{echo PWNED > pwn.txt}` | no file created — `--untrusted` blocks shell escape at the engine |
| `\XeTeXpdffile "C:/Windows/win.ini"` | no PDF (parse failure), but the path was opened |

`\csname` reached `\input` in both the isolated service and the API's local fallback. On a
host running local compilation that is an arbitrary-file-read primitive over the API's
filesystem (`.env`, `JWT_SECRET`, the Atlas URI); inside the container it is bounded by the
image's filesystem view. **Fixed in both validators** (`latex-compiler/server.mjs`,
`backend/src/services/latexService.js`): `\csname`, `\endcsname`, `\XeTeXpdffile` and
`\pdfximage` are now rejected before spawning TeX. No resume template uses them.
Regression tests: four bypass payloads in `test/latex.test.js` (including a message check)
and three new checks in `verify.mjs`.

### 17.2 Read-only Tectonic cache — viable

The compose file keeps `/var/cache` on a read-only rootfs, and the README warned Tectonic
might need to write a lock file there. Tested by denying write rights (not read) on the
warmed 44 MB cache tree, with a write probe to prove the denial was active:

| Step | Result |
| --- | --- |
| write probe inside the cache | permission denied (read-only simulation active) |
| listing the cache | allowed |
| `tectonic --untrusted --only-cached doc.tex` | **valid 3,464-byte PDF** |

So `read_only: true` with `XDG_CACHE_HOME=/var/cache` should work; the copy-to-`/tmp`
entrypoint remains documented as a contingency. Windows ACL denial is not a Linux read-only
mount, so this is strong process-level evidence, not a container proof.

### 17.3 Queue, credentials and cleanup

| Check | Result |
| --- | --- |
| 1 slot, 3 s queue timeout, 3 simultaneous runaway documents | running one `504 LATEX_TIMEOUT` at 12 s; both queued `503 LATEX_BUSY` at ~6 s |
| 8 error bodies (401/400/413) | no token and no `COMPILE_TOKEN` string |
| temp directories after rejections, a timeout and a success | 0 |
| `\immediate\write18{touch …}` | `400`, marker file absent |
| full contract suite against the process | **17/17 passed** |

Two smaller defects were found and fixed while scripting that:

- `verify.mjs` hardcoded a 260 k-character source against an assumed 200 k cap. With the code
default (262,144) the request reached TeX and returned `422`, so the size-cap check silently
tested the wrong thing. `/healthz` now reports `maxSourceBytes`, `maxOutputBytes` and
`timeoutMs`, and the suite sizes its payload from the reported cap (now a real `413`).
- `getCompilerStatus()` reported `local-sandboxed` in production whenever a binary existed,
although every compile returns `LATEX_LOCAL_DISABLED`. It now reports `unavailable` with
`localBlockedInProduction: true`. Verified with `NODE_ENV=production` and no URL: `mode:
"unavailable"`, and `compileLatex` refused with `503 LATEX_LOCAL_DISABLED`.

### 17.4 Audited statically, still unexecuted

The compose file parses and uses only valid Compose keys: no published port, `internal: true`
network, `read_only: true`, `cap_drop: ALL`, `no-new-privileges`, `noexec` 64 MiB `/tmp`,
512 MiB RAM/swap, 1 CPU, 64 PIDs, non-root `node` from the image, `--only-cached` and a
build-time bundle warm. **Not observed at runtime:** the volume/network namespaces, actual
egress blocking, the memory/CPU/PID ceilings, read-only rootfs enforcement, capability drop,
health status, and Tectonic's behaviour on a Linux read-only mount. Exact Git Bash and
PowerShell commands for all of those are in
[latex-compiler/README.md](latex-compiler/README.md#container-checks-still-outstanding).

One trap is documented there: `docker compose run` executes `verify.mjs` in a **separate**
container, so its temp-directory checks inspect that container's `/tmp`. The service's own
`/tmp` must be checked with `docker exec`.

### 17.5 Regression after the changes

| Check | Result |
| --- | --- |
| `cd backend && npm test` | **81 tests, 81 pass, 0 fail, 0 skipped** (12.0 s) |
| `cd frontend && npm run build` | success, 22.0 s (same >500 kB vendor chunk warning) |
| `latex-compiler/verify.mjs` | **17/17** |
| production local-compile refusal | `503 LATEX_LOCAL_DISABLED` with a local binary present |

One harness flake to be aware of: an earlier full-suite run failed at the
`api.integration.test.js` file level (the whole file, not an assertion) and passed on
rerun; that file boots `mongodb-memory-server` and is the slowest to start. If it fails
that way, rerun the file alone before treating it as a regression.

---

---

## Phase 18 — OCR / PDF ingestion threat model (2026-10-24)

No OCR engine is installed (`tesseract` is not a dependency and no external process is
spawned), so the ingestion surface is: multer (memory storage) → magic-byte check →
`pdf-parse` (pdf.js 1.10) or `mammoth` (JSZip) → `parsedText` → LaTeX builder → AI prompts.
Every one of those parsers ran **in-process, with no timeout**, which was the core problem.

### 18.1 Measured cost of a hostile document

`pdf-parse` sets `PDFJS.disableWorker = true`, so pdf.js executed on the API's own thread.
The cost is driven by text operators, not bytes:

| Fixture | Size on the wire | Time on the API thread | Text produced |
| --- | --- | --- | --- |
| 100 k text operators | 8 KB | 770 ms | 1.70 MB |
| 400 k text operators | 30 KB | **3.59 s** | **6.80 MB** |
| 20 000-page PDF | 2.2 MB | 179 ms (page tree only) | — |
| encrypted PDF | 1 KB | rejected in 2 ms (`PasswordException`) | — |
| truncated PDF | 60 B | rejected in 1 ms (`InvalidPDFException`) | — |
| `%PDF` + 2 MB of junk | 2 MB | rejected after 270 ms | — |

A 30 KB upload therefore stalled the whole API for ~3.6 s and produced 6.8 MB of text — a
226× amplification written into MongoDB (`parsedText`) and then into Gemini prompts. The
byte cap alone bounded nothing that mattered.

### 18.2 Confirmed defects and fixes

| # | Defect | Fix |
| --- | --- | --- |
| 1 | Parsing ran unbounded on the request thread (row 2 above is a whole-API stall, not a slow response). | Parsing moved to a worker thread with a 10 s wall clock, `terminate()` on expiry and a 192 MB heap ceiling. `terminate()` was measured against a busy loop: 309 ms to stop, with the main thread doing 1.89 M iterations in the 200 ms after. |
| 2 | Extracted text had no ceiling before being stored. | 200 k-character cap enforced during extraction (rendering stops adding text at the budget) and again after normalisation. |
| 3 | DOCX is a zip archive and nothing checked its declared expansion: a 1 KB archive claiming 900 MB was handed to mammoth. | Central directory is read first (declared sizes, entry count, `word/document.xml` presence, 64 MB and 120:1 ceilings) and ZIP64 is refused. The 900 MB fixture is rejected in ~2 ms without inflating anything. |
| 4 | Password-protected PDFs surfaced as `400 Invalid resume file`, indistinguishable from corruption. | `/Encrypt` in the trailer is detected before parsing → `422 DOCUMENT_ENCRYPTED`. A document that hides it still fails closed through pdf.js's `PasswordException`. |
| 5 | Image-only (scanned) documents produced no text yet returned `200` and stored an empty `parsedText` — the resume looked uploaded but was blank. | `422 DOCUMENT_NO_TEXT` with an explicit "OCR is not supported" message. |
| 6 | `POST /api/resumes/upload` created an empty "Uploaded Resume" **before** parsing, so every rejected upload left a junk record. | The resume is created only after a successful parse; the upload tests assert the resume count is unchanged after three rejections. |
| 7 | Only `fileSize` and `files` were limited; a multipart body could add unlimited parts, fields and field size (multer's 1 MB default per field). | `fields: 4`, `fieldSize: 64 KB`, `parts: 8`, `headerPairs: 100`. |
| 8 | Multer limits other than `LIMIT_FILE_SIZE` fell through to `500`. | Mapped to `400 UPLOAD_REJECTED`. |
| 9 | pdf.js logs one line per failing page to stdout, so document content could drive log volume. | Worker console is discarded and its stdout/stderr streams are drained; only a static error code reaches the API log. |

The parser also no longer runs at all for a document that has already failed a pre-check, and
the text path (`text/plain`) bypasses the worker entirely because it needs no parser.

### 18.3 Checked and found sound (no change needed)

- **MIME spoofing / wrong extension.** The header is client-controlled but the signature
  middleware already compared magic bytes; a new test sends HTML labelled `.pdf` and gets
  `400`, and the service re-checks the signature when called directly.
- **Path traversal in filenames.** Uploads use multer memory storage and the filename is never
  used as a path (only echoed in the parser result). A test uploads
  `../../../../tmp/pwn-skillsync.pdf` and asserts the file was parsed, no such path exists, and
  no `multer`/`upload`/`latex-compile` entry appeared in the temp directory.
- **Cross-user access.** `parseAndStoreResumeFile` resolves ownership before spending any parse
  work; a test confirms user A gets `404` for user B's resume and that B's `parsedText` stays
  empty.
- **No shell or external process on the ingestion path.** The only `spawn` in the backend is
  the LaTeX compiler (Phase 17). The worker imports `pdf-parse` and `mammoth` and nothing else.
- **Embedded scripts/actions.** pdf.js 1.10 contains zero `eval(` calls and no handling of
  `OpenAction`, `/Launch` or `submitForm` (`grep -c` = 0 for each), so PDF JavaScript and
  launch actions are not executed. Links are never resolved or fetched.
- **DOCX side effects.** `mammoth.extractRawText` maps text only: it never runs the
  `convertImage`/`dataUri` pipeline, `mammoth/lib` contains no `http(s)` URL, and its single
  `fs.writeFile` belongs to the CLI image extractor, not this path. External relationships
  are not resolved.
- **Text → LaTeX injection.** A test uploads a PDF whose text is `\input{/etc/passwd} and 100%
  R&D`, then asserts the stored `latexSource` contains `\textbackslash{}input` and passes
  `validateLatexSource`.
- **Error bodies.** Encrypted, truncated and timed-out documents whose content contains a
  marker string all reject with static messages; a test asserts the marker never appears in
  the message or the error object.

### 18.4 Limits now enforced

| Limit | Value | Where |
| --- | --- | --- |
| Upload bytes | 8 MB resume, 5 MB job description | multer, re-checked in the service |
| PDF pages | 40 (rejected, not truncated) | after opening the document, before rendering |
| Extracted characters | 200 000 | during rendering and after normalisation |
| Parse time | 10 s (`DOCUMENT_PARSE_TIMEOUT_MS`) | worker, terminated on expiry |
| Worker heap | 192 MB | `resourceLimits` |
| Concurrent parses | 1 | FIFO gate with a 10 s wait, then `503 DOCUMENT_BUSY` |
| DOCX expansion | 64 MB, 120:1 ratio, 512 entries | central directory, before mammoth |

Concurrency was set to **1** with a 192 MB heap after measuring peak RSS: the heaviest parse
reached **248 MB** of process memory, and the documented Render plan is 512 MB. Two parallel
parses would have been able to exhaust it. The ceiling fails only the worker, never the API.

### 18.5 Test evidence

- `backend/test/documentParser.test.js` — **14 tests**: encrypted PDFs, zip bombs, ZIP64,
  archives without a document part, mislabelled/binary/empty/oversized input, control-character
  normalisation, real PDF and real DOCX extraction, empty text, page ceiling, timeout with
  prompt termination and a successful parse afterwards, concurrency gate and slot handoff,
  and no content leakage in errors.
- `backend/test/api.integration.test.js` — **6 new tests**: spoofed/truncated/text-free uploads
  with no side effects, LaTeX escaping of uploaded text, cross-user upload, traversal filename,
  oversized and archive-bomb uploads, and job uploads (text accepted, scan rejected).
- `cd backend && npm test` — **101 tests, 101 pass, 0 fail** (two consecutive runs).
- `cd frontend && npm run build` — success in 31.1 s (unchanged >500 kB vendor warning).
- A real PDF from the project's own LaTeX pipeline (Tectonic, 17 708 bytes) parsed in **313 ms**
  into 358 characters with the email, role and bullets intact. A cold DOCX parse measured
  327–346 ms over five fresh processes.

One flake worth recording: a single run of the parser suite timed out on the DOCX extraction
while the full suite was running in parallel; five cold measurements afterwards were 327–346 ms
and three consecutive reruns passed. That test now uses a 30 s budget so a slow filesystem
scan (malware scanning of the newly written worker and `node_modules` entries) cannot fail it.

### 18.6 Residual risks

- **Declared zip sizes are attacker-supplied.** A lying archive passes the directory check and
  is stopped only by the heap ceiling or the timeout, after some CPU has been spent.
- **10 s of CPU per attempt is allowed.** The upload limiter (15 per 15 min per IP) bounds this
  at roughly 150 s of CPU per IP per window; there is no global parse budget.
- **The 192 MB ceiling is a JS heap limit, not RSS.** A document that allocates external buffers
  could exceed the process's memory before the ceiling trips. It is sized for a 512 MB host.
- **No malware scanning or quarantine.** Files are parsed, never stored, but an infected
  document is still processed by pdf.js/mammoth if it is structurally valid.
- **No fuzzing.** Coverage is hand-built PDFs/DOCX, one Tectonic-produced PDF, and no
  Word-produced DOCX (none was available in this environment).
- **OCR remains unsupported** — scanned resumes now fail honestly instead of silently.
- **`parsedText` reaches Gemini prompts.** Prompt injection through resume content is not a
  security boundary the app enforces; the AI never receives credentials and its output is
  schema-validated, but a crafted resume can influence prose.
- **`multer` is still 1.4.5-lts.1** (the 1.x line). Moving to 2.x is a dependency change with
  its own regression surface and was not part of this phase.

---

## Known limitations and remaining work

1. **No cloud database was reachable, for a DNS reason outside the code.** The Atlas subdomain in `MONGODB_URI` returns NXDOMAIN from a public resolver (§15.1, not retried in Phase 16 by request), so every API verification ran on a real MongoDB process with a disposable or on-disk data directory instead of Atlas. Replacing the URI with a live cluster and re-running §7.1/§7.4 of `PRODUCTION_ENV_CHECKLIST.md` is the one remaining database step. `npm start` refuses to start rather than degrading to in-memory storage; `render.yaml` requires a real URI.
2. **The isolated compiler container was not built or run** — Docker (and WSL/podman/nerdctl) is not installed here. The service itself passed **17/17** contract and abuse checks with the image's `--only-cached` flag (§17), Tectonic compiled with a genuinely read-only cache, and the API integration produced real PDFs, but the hardening that only the runtime provides (read-only rootfs enforcement, dropped capabilities, internal network, 512 MiB/1 CPU/64 PID caps, blocked egress, health status) is unexecuted. Exact Git Bash/PowerShell commands are in `latex-compiler/README.md#container-checks-still-outstanding`. Note that Tectonic reads absolute paths even with `--untrusted`, so `LATEX_ALLOW_LOCAL` must stay `false`; the command filter (now including `\csname`, §17.1) and the container's filesystem view are the controls. Page counts for remote compiles are `0` because Tectonic writes compressed object streams; the studio omits the indicator.
3. **Gemini is verified on one key, and its free tier is the binding constraint.** All five features passed live (§16.2), but the key allows **20 generate requests per day per model** (about four full workflows), after which every call returns `429`. A production deployment needs billing or a paid key; `GEMINI_MODEL` must name a model the key can access — `gemini-2.5-flash-lite` is still advertised by `ListModels` but answers `404 no longer available`, while `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite` answered normally. No output is fabricated on failure; the error classifier now distinguishes quota exhaustion from an invalid key (five regression tests).
4. **Email delivery is unverified for real recipients.** `RESEND_FROM_EMAIL` is unset, so the sender is `onboarding@resend.dev`, which only delivers to the Resend account owner; the API records the rejection, returns `emailDispatched: false`, and (development only) prints the verification URL. The exact domain/DNS/sender steps are documented in `PRODUCTION_ENV_CHECKLIST.md` §4; verification enforcement stays opt-in (`REQUIRE_EMAIL_VERIFICATION`) until that domain is verified. Third-party inbox delivery, bounces and DMARC have not been tested.
5. **No production deployment was performed.** `render.yaml`, `frontend/vercel.json` and `npm run verify:deploy` are ready (§16.4) and the API's production-mode behaviour was checked locally (CORS allow/deny, readiness, error envelope, disabled local TeX), but no host has run this code and no cross-network `LATEX_COMPILE_URL` hop has been exercised.
6. **Workflow runs are not persisted/resumable** (see Phase 8). No SSE progress channel.
7. **Interview speech-to-text still relies on the browser.** There is no server-side transcription service; transcripts are only evaluated as text, and audio-derived claims are not made.
8. **Retrieval quality at scale is unbenchmarked.** Cosine scoring in application code is fine for a curated base plus a candidate's own documents; Atlas Vector Search is the documented upgrade path.
9. **Frontend has no automated tests** (no test runner was present). The production build passes and the main flows were driven in a real browser against the API running on an in-memory MongoDB: sign-up/login, the LaTeX Studio (source generated from a saved resume, `POST /api/latex/compile`, PDF rendered in the preview iframe), and JD extraction in the ATS page. Remaining gaps: no screenshot capture (the preview webview refused to composite here), no coverage of the cover-letter/coach/interview screens beyond their API tests, and page interactions near the fixed mobile bottom bar can have their last visible row overlapped until the user scrolls.
10. **Embedding ingestion is sequential**, so ingesting a large personal document corpus will be slow; batching is the obvious improvement.

11. **The AI provider's throughput is unbenchmarked.** Latencies observed locally (1.2–12.5 s per call) are single-request figures on a shared connection; there is no load test, no queueing for AI calls beyond the HTTP rate limiter, and no per-user quota.
12. **Production logs still contain request paths and provider messages.** `morgan("dev")` is used in every environment, and the Content-Security-Policy is Helmet's default rather than one tailored to the app. Provider messages are sanitised for keys, and verification tokens are no longer logged in production, but a deployment should switch to structured JSON logs with retention rules.
13. **Document ingestion is bounded, not sandboxed like TeX.** Uploads are parsed in a worker with a 10 s clock, a 192 MB heap ceiling, one concurrent parse, a 40-page cap and a 200 k-character cap (§18), and a 30 KB PDF that used to stall the API for 3.6 s is now terminated. It is the same process, though: there is no malware scanner, no fuzzing, no Word-produced DOCX in the fixture set, and OCR is not implemented (scanned resumes return `422 DOCUMENT_NO_TEXT`). A production deployment that accepts untrusted files from the public should add AV scanning in front of the endpoint.

## Manual checklist before production

1. **Create a live Atlas cluster** (or restore the deleted one), add the deploy host's egress IPs, and copy the current `mongodb+srv://…` string. Verify it before deploying:
   ```bash
   HOST=$(sed -n 's#^MONGODB_URI=.*@\([^/:?]*\).*#\1#p' backend/.env | head -1)
   curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=$HOST&type=A"
   ```
2. **Enable Gemini billing** (or accept ~4 workflows/day) and confirm the key can call `GEMINI_MODEL`.
3. **Verify a Resend domain**, set `RESEND_FROM_EMAIL` on that domain, send a test to a second address, then set `REQUIRE_EMAIL_VERIFICATION=true`.
4. **Deploy the API on Render** from `render.yaml`, fill every `sync: false` secret, set `CLIENT_URL` and `ALLOWED_ORIGINS` exactly.
5. **Deploy the frontend on Vercel** with root `frontend` and `VITE_API_BASE_URL=https://<api-host>/api`, then redeploy after any change to that value.
6. **Run `BASE_URL=https://<api-host> EXPECT_ORIGIN=https://<frontend-host> npm run verify:deploy`** (expect 10/10) and the browser workflow.
7. **For PDF export, build and verify the compiler container** with Docker (`cd latex-compiler && COMPILE_TOKEN=… docker compose up -d --build`) — expect `verify.mjs` 17/17 inside its network, healthy status, no host port, a refused `touch /nope` on the rootfs, blocked egress, and 0 entries in the service's `/tmp` after the suite (check with `docker exec`, not `compose run`). Then set `LATEX_COMPILE_URL` and `LATEX_COMPILE_TOKEN` on the API and keep `LATEX_ALLOW_LOCAL=false`.
8. **Exercise uploads with real files on the deployed host** (the limits are host-sensitive): a normal PDF resume and a DOCX from Word must import; a scanned/image-only PDF must return `422 DOCUMENT_NO_TEXT`; a password-protected PDF must return `422 DOCUMENT_ENCRYPTED`; and `DOCUMENT_PARSE_TIMEOUT_MS` should be raised only if a legitimate 40-page PDF is terminated. There is no upload fixture from Word in this repository, so a real DOCX import is the one ingestion path this report cannot claim to have seen work.
9. **Rotate** the Gemini key and `JWT_SECRET` if they were ever shared outside the secret store, and keep `.env` out of git (already ignored).

## Suggested next task

With Docker available, build and exercise the compiler container (health, no host port, 512 MiB ceiling, read-only rootfs, blocked egress, `verify.mjs` 17/17) and then re-run `npm run verify:e2e` against the Render deployment with the compiler wired in. That closes the last two unknowns — a containerised compiler and a real cross-network deployment — on top of the 101 passing tests, the 15/15 workflow, and the live-provider checks recorded here. A separate follow-up is malware scanning (and optionally OCR) in front of the upload endpoints, which §18 deliberately leaves out.

# Production Environment Checklist

Every variable below is read by the current implementation (`backend/src/config/env.js`
and the services that consume `env`). Values are never committed; keep real
credentials only in the hosting provider's secret store or a local `.env` file.

## 1. Required — the API refuses to start without these

| Variable | Purpose | Notes |
| --- | --- | --- |
| `MONGODB_URI` | Primary MongoDB connection string | `mongodb+srv://` or standard. The startup probe resolves the host and logs failures. |
| `JWT_SECRET` | Signs auth tokens | Use at least 32 random bytes. Rotating it invalidates all sessions. |
| `GEMINI_API_KEY` | Gemini analysis/embeddings | If invalid, AI features return explicit `AI_*` errors. Scores are unaffected. |

## 2. Recommended

| Variable | Default | Why |
| --- | --- | --- |
| `PORT` | `5050` | Host usually injects this; keep it aligned with the frontend base URL. |
| `CLIENT_URL` | `http://localhost:5180` | Exact CORS origin for the deployed frontend. |
| `ALLOWED_ORIGINS` | empty | Comma-separated extra origins (preview deploys). Wildcards are rejected. |
| `RESEND_API_KEY` | empty | Required for signup verification and password reset email. |
| `RESEND_FROM_EMAIL` | empty | Must be a verified Resend domain, otherwise only the account owner receives mail. |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Set to `true` only after a verified sender works, otherwise every new signup is locked out. |
| `GEMINI_MODEL` | `models/gemini-2.5-flash` | Change only to a model your key can access. The free tier allows **20 generate requests per day per model** — roughly four full workflows — so production needs billing enabled or a paid key. |
| `GEMINI_EMBEDDING_MODEL` | `text-embedding-004` | Used for coach retrieval; if unavailable the coach falls back to lexical retrieval and labels it. |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime. |
| `GEMINI_TIMEOUT_MS` | `45000` | Hard per-call timeout so a hung provider cannot hold a request open. |

## 3. LaTeX compilation (resume studio)

| Variable | Default | Why |
| --- | --- | --- |
| `LATEX_COMPILE_URL` | empty | **Preferred in production.** URL of an isolated compiler service that accepts `{"source": "..."}` and returns `application/pdf`. |
| `LATEX_COMPILE_TOKEN` | empty | Bearer token for that service. |
| `LATEX_BIN` | empty | Local development only: path to `tectonic` or `pdflatex`. |
| `LATEX_ALLOW_LOCAL` | `false` | Must stay `false` in production. With `false` and no `LATEX_COMPILE_URL`, `/api/latex/compile` returns `503 LATEX_LOCAL_DISABLED` instead of executing untrusted TeX on the API host. |
| `LATEX_TIMEOUT_MS` | `45000` | Kill switch for a runaway compile. |
| `LATEX_MAX_SOURCE_BYTES` | `200000` | Rejects oversized source before it reaches the compiler. |
| `LATEX_MAX_OUTPUT_BYTES` | `5242880` | Rejects oversized PDFs. |

Local development setup (no admin rights required):

```bash
cd backend
mkdir -p .tools && cd .tools
curl -L -o tectonic.zip https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.17.0/tectonic-0.17.0-x86_64-pc-windows-msvc.zip
unzip -o tectonic.zip && rm tectonic.zip
# macOS/Linux: download the matching tarball instead
cd .. && node -e "import('./src/services/latexService.js').then(m => console.log(m.getCompilerStatus()))"
```

`.tools/` is gitignored. The first compile downloads TeX packages into the
compiler's cache (~4 minutes on a slow link); later compiles take 3–12 seconds.

### Isolated compiler: verification status

The service contract **is** verified at the process level: 17/17 checks in
`verify.mjs`, including authentication, `\csname` and `\XeTeXpdffile` bypass
attempts, the size cap, the wall-clock timeout, temp-directory cleanup,
credential-free error bodies and queue saturation. The container layer itself is
**not** verified — Docker was unavailable when this was written, so read-only
rootfs, dropped capabilities, memory/PID limits and blocked egress have not been
observed. Run these before production (PowerShell equivalents are in
`latex-compiler/README.md`):

```bash
cd latex-compiler
export COMPILE_TOKEN="$(openssl rand -hex 32)"
docker compose up -d --build
docker inspect --format '{{.State.Health.Status}}' "$(docker compose ps -q)"        # healthy
curl -s -m 3 http://127.0.0.1:8080/healthz; echo "exit=$?"                          # refused: no published port
docker compose run --rm -e SERVICE_URL=http://latex-compiler:8080 \
  --entrypoint node latex-compiler verify.mjs                                       # 17/17
docker exec "$(docker compose ps -q)" sh -c 'touch /nope'                            # read-only rootfs
docker exec "$(docker compose ps -q)" sh -c 'ls -d /tmp/latex-compile-* 2>/dev/null | wc -l'  # 0
```

Then set `LATEX_COMPILE_URL` and `LATEX_COMPILE_TOKEN` on the API and keep
`LATEX_ALLOW_LOCAL=false`. `GET /api/latex/templates` reports `compiler.mode`:
`remote-isolated-service` with the URL configured, and `unavailable` in
production without it — local compilation is refused even when a Tectonic
binary exists on the host.

## 4. Transactional email (Resend) — required for real verification email

Until a domain is verified, `RESEND_FROM_EMAIL` is unset and the sender falls back to
`onboarding@resend.dev`. Resend's sandbox restriction delivers that sender **only to the
address that owns the Resend account**; every other recipient is rejected (`422`/`403`).
Password reset and verification therefore work only for the account owner. The API logs the
rejection, returns an honest `emailDispatched: false` on signup, and (in development only)
prints the verification URL.

To enable real delivery:

1. **Verify a domain in Resend.** Dashboard → *Domains* → *Add Domain*. A subdomain such as
   `mail.yourdomain.com` is fine and keeps the apex free. Pick the region closest to your
   users.
2. **Add the DNS records Resend displays** at the DNS host for that domain. Resend currently
   asks for three (names vary with the region it assigns):
   - `MX  send.yourdomain.com -> feedback-smtp.<region>.amazonses.com` (priority 10)
   - `TXT send.yourdomain.com -> v=spf1 include:amazonses.com ~all`
   - `TXT resend._domainkey.yourdomain.com -> p=<DKIM public key from the dashboard>`
   - Recommended for deliverability: `TXT _dmarc.yourdomain.com -> v=DMARC1; p=none;`
3. **Wait for `Verified`** in Resend (usually minutes, up to 72 h after DNS propagation).
4. **Set the variables** in Render → Environment (or `backend/.env` locally):
   ```
   RESEND_API_KEY=re_...                 # Resend → API Keys, sending access
   RESEND_FROM_EMAIL=noreply@mail.yourdomain.com
   ```
   The local part can be anything (`noreply@`, `career@`, …) but the domain must be the one
   you verified. Do not use `onboarding@resend.dev`.
5. **Link targets.** The verification email links to `${CLIENT_URL}/verify-email?token=…`
   and password reset links to `${CLIENT_URL}/reset-password?token=…`. `CLIENT_URL` must be
   the public frontend origin (for example `https://skillsync.vercel.app`), not
   `localhost`, or recipients land on a dead link.
6. **Restart the API** and confirm the startup warning about `RESEND_FROM_EMAIL` is gone and
   the `[Email] Sender` log line shows your domain.
7. **Test with a second address** that does not own the Resend account: sign up, receive the
   mail, click the link, sign in. Only after this works set
   `REQUIRE_EMAIL_VERIFICATION=true` and restart; unverified logins then return
   `403 EMAIL_UNVERIFIED`.

Not verified in this repository: delivery to a third-party inbox, bounce/complaint handling,
and DMARC enforcement. There is no unsubscribe flow because all mail is transactional.

## 5. Optional tuning

| Variable | Default | Notes |
| --- | --- | --- |
| `ATS_WEIGHTS_JSON` | empty | JSON overrides for the deterministic ATS weights. Invalid JSON logs a warning and falls back to defaults. |
| `MONGODB_URI_STANDARD` | empty | Fallback connection string. |
| `GOOGLE_CLIENT_ID` | empty | Google sign-in. Without it the Google endpoint returns a clear error. |
| `JOB_FETCH_TIMEOUT_MS` | `12000` | Job posting fetch timeout. |
| `DOCUMENT_PARSE_TIMEOUT_MS` | `10000` | Wall-clock budget for parsing one uploaded PDF/DOCX in its worker thread. Expired parses are terminated and the upload is rejected with `422 DOCUMENT_PARSE_TIMEOUT`. Raise only for a slow host; it bounds CPU per request, not document size (8 MB upload, 40 PDF pages and 200 k extracted characters are fixed limits in `backend/src/services/documentParser.js`). |
| `NODE_ENV` | `development` | `production` disables permissive localhost CORS and local LaTeX compilation. |

## 6. Frontend (build-time, `frontend/.env`)

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://api.example.com/api` | Defaults to `/api` when unset. |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client id | Optional. |

## 7. Deploy verification

### 7.1 Before deploying

1. **Confirm the cluster hostname exists.** The public DNS answer is authoritative and
   independent of local resolvers:
   ```bash
   HOST=$(sed -n 's#^MONGODB_URI=.*@\([^/:?]*\).*#\1#p' backend/.env | head -1)
   curl -s -H 'accept: application/dns-json' \
     "https://cloudflare-dns.com/dns-query?name=$HOST&type=A" | head -c 200; echo
   ```
   `"Status":3` (NXDOMAIN) means the cluster was deleted or the URI is stale — create the
   cluster in Atlas and copy the current connection string. A broken machine-level resolver
   (for example `dns.getServers()` returning `127.0.0.1` with `ECONNREFUSED`) is a separate
   local fault and does not invalidate the check above.
2. `cd backend && npm test` — deterministic engines, SSRF, LaTeX, remote-compiler contract,
   and API integration (downloads the in-memory MongoDB binary on first run).
3. `cd frontend && npm run build`
4. Optional live checks (each prints PASS/FAIL per step): `npm run verify:ai`,
   `npm run verify:persistence`, `BASE_URL=… npm run verify:e2e`.

No reachable database? `cd backend && npm run dev:memory` runs the real API against a
throwaway in-memory MongoDB for local UI checks. Its data is lost on exit unless
`MEMORY_DB_PATH` is set, it never touches `MONGODB_URI` data, and it is development-only;
`npm start` never falls back to it.

### 7.2 Backend on Render

1. New → Blueprint → select this repository. [`render.yaml`](render.yaml) sets root
   directory `backend`, build `npm ci --omit=dev`, start `npm start`, and health check
   `/api/health/ready` (a deploy fails instead of going live with a dead database).
2. Fill the `sync: false` secrets: `MONGODB_URI`, `JWT_SECRET` (32+ random bytes),
   `GEMINI_API_KEY`, `CLIENT_URL`, `ALLOWED_ORIGINS`, `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, and the compiler pair if you run one.
3. `CLIENT_URL` must be the exact Vercel origin with no trailing slash. Preview domains go
   in `ALLOWED_ORIGINS` (comma-separated). Wildcards are rejected by design.
4. Keep `LATEX_ALLOW_LOCAL=false`. Without `LATEX_COMPILE_URL` the compile endpoint answers
   `503 LATEX_LOCAL_DISABLED` rather than executing untrusted TeX on the API host.

### 7.3 Frontend on Vercel

1. Import the repo, set **Root Directory** to `frontend`. Vercel builds with
   `npm run build` and serves `dist` (also declared in `frontend/vercel.json`).
2. Add `VITE_API_BASE_URL=https://<api-host>/api` as a **build-time** environment variable.
   Changing it requires a redeploy; the value is baked into the bundle.
3. SPA deep links (`/studio`, `/verify-email`, …) are handled by the rewrite in
   `frontend/vercel.json`.

### 7.4 After deploying

1. `cd backend && BASE_URL=https://<api-host> EXPECT_ORIGIN=https://<frontend-host> npm run verify:deploy`
   — 10 checks: health, readiness, CORS allow/deny, 404 envelope, 401 guard, signup, wrong
   password, forbidden LaTeX, and the compile path.
2. Open the frontend, sign up, sign in, and exercise: upload a resume → extract a JD → run
   ATS → open the LaTeX Studio → compile → save/restore a version → generate a cover letter
   → save an application.
3. Confirm a second account cannot read the first account's resumes, versions, analyses,
   cover letters, or knowledge documents.
4. Confirm `POST /api/job/fetch` with `http://169.254.169.254/...` returns `PRIVATE_ADDRESS`.
5. Confirm `/api/health/ready` returns `503` while the database is unreachable and `200`
   once it recovers.

## 8. Never do this

- Do not commit `.env` files (already gitignored).
- Do not paste provider keys into chat, issues, or the frontend bundle.
- Do not enable `LATEX_ALLOW_LOCAL` on a shared API host; run the compiler in a
  separate, resource-limited worker instead.

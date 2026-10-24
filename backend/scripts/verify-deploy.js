/**
 * Deploy-time smoke test. Runs against any reachable API (local, Render, a
 * preview URL) and checks the contract a reverse proxy and the browser depend
 * on. It creates one throwaway account, so point it at your own environment.
 *
 * Usage:
 *   BASE_URL=https://skillsync-api.onrender.com EXPECT_ORIGIN=https://skillsync.vercel.app \
 *     node scripts/verify-deploy.js
 *
 * `EXPECT_ORIGIN` is the exact frontend origin configured in CLIENT_URL (or one
 * of ALLOWED_ORIGINS). It is only used as a request header; nothing secret is
 * read, printed, or stored.
 */
const BASE_URL = String(process.env.BASE_URL || "http://127.0.0.1:5050").replace(/\/+$/, "");
const EXPECT_ORIGIN = String(process.env.EXPECT_ORIGIN || "").replace(/\/+$/, "");
const BLOCKED_ORIGIN = "https://verify-deploy.invalid";

const results = [];

const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
};

const call = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* PDF or plain text */
  }
  return { status: response.status, headers: response.headers, text, json };
};

const jsonPost = (path, body, token) =>
  call(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

const latex = (source) => JSON.stringify({ source });

const main = async () => {
  console.log(`Target: ${BASE_URL}${EXPECT_ORIGIN ? ` | expected origin: ${EXPECT_ORIGIN}` : ""}\n`);

  // 1. Liveness
  const health = await call("/api/health");
  record("/api/health returns 200 JSON", health.status === 200 && health.json?.success === true, `status ${health.status}`);

  // 2. Readiness (database attached)
  const ready = await call("/api/health/ready");
  record(
    "/api/health/ready reports a connected database",
    ready.status === 200 && ready.json?.ready === true,
    `status ${ready.status}, database ${ready.json?.database || "unknown"}`
  );

  // 3. CORS allowlist
  if (EXPECT_ORIGIN) {
    const allowed = await call("/api/health", { headers: { Origin: EXPECT_ORIGIN } });
    record(
      "allowed frontend origin receives CORS header",
      allowed.headers.get("access-control-allow-origin") === EXPECT_ORIGIN,
      `got ${allowed.headers.get("access-control-allow-origin") || "no header"}`
    );
  } else {
    record("allowed frontend origin receives CORS header", true, "skipped (set EXPECT_ORIGIN to enforce)");
  }

  const blocked = await call("/api/health", { headers: { Origin: BLOCKED_ORIGIN } });
  record(
    "unknown origin is not granted CORS",
    !blocked.headers.get("access-control-allow-origin"),
    `got ${blocked.headers.get("access-control-allow-origin") || "no header"}`
  );

  // 4. Error envelope
  const missing = await call("/api/definitely-not-a-route");
  record(
    "unknown route returns 404 with error envelope",
    missing.status === 404 && missing.json?.success === false,
    `status ${missing.status}`
  );

  const anonymous = await call("/api/resumes");
  record(
    "protected route rejects anonymous caller",
    anonymous.status === 401 && anonymous.json?.success === false,
    `status ${anonymous.status}`
  );

  // 5. Auth round trip
  const email = `deploy.check.${Date.now()}@example.com`;
  const password = "DeployCheck123!";
  const signup = await jsonPost("/api/auth/signup", { name: "Deploy Check", email, password });
  const token = signup.json?.token || "";
  record("signup returns a usable session token", signup.status < 300 && Boolean(token), `status ${signup.status}`);

  const badLogin = await jsonPost("/api/auth/login", { email, password: "wrong-password" });
  record(
    "wrong password returns 401 INVALID_CREDENTIALS",
    badLogin.status === 401 && badLogin.json?.code === "INVALID_CREDENTIALS",
    `status ${badLogin.status}, code ${badLogin.json?.code || "none"}`
  );

  // 6. LaTeX guard runs before any compiler work
  const forbidden = await jsonPost(
    "/api/latex/compile",
    { source: "\\documentclass{article}\\begin{document}\\immediate\\write18{id}\\end{document}" },
    token
  );
  record(
    "forbidden LaTeX command is rejected",
    forbidden.status === 400 && forbidden.json?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${forbidden.status}, code ${forbidden.json?.code || "none"}`
  );

  // 7. Compilation path. A production deploy without a remote compiler is
  //    expected to answer 503 instead of running TeX on the API host.
  const compile = await call("/api/latex/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: latex("\\documentclass{article}\\begin{document}deploy check\\end{document}")
  });
  // The API answers with { pdfBase64 } (the studio renders it in an iframe);
  // accept a raw PDF body too so the check also works against a proxy that
  // streams the binary directly.
  const compiledPdf = compile.json?.pdfBase64
    ? Buffer.from(compile.json.pdfBase64, "base64")
    : compile.text.startsWith("%PDF-")
      ? Buffer.from(compile.text, "binary")
      : null;

  if (compile.status === 200 && compiledPdf && compiledPdf.subarray(0, 5).toString("latin1") === "%PDF-") {
    const kb = Math.round(compiledPdf.length / 1024);
    record(
      "LaTeX compilation returns a PDF",
      true,
      `${kb} KB, engine ${compile.json?.engine || "raw body"}, ${compile.json?.pageCount || 0} page(s)`
    );
  } else if (compile.status === 503 && compile.json?.code === "LATEX_LOCAL_DISABLED") {
    record(
      "LaTeX compilation is disabled (no isolated compiler configured)",
      true,
      "expected when LATEX_COMPILE_URL is unset; configure the compiler service to enable PDF export"
    );
  } else {
    record("LaTeX compilation returns a PDF or an explicit disabled error", false, `status ${compile.status}, body ${compile.text.slice(0, 160)}`);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

main().catch((error) => {
  console.error(`\nDeploy check aborted: ${error.message}`);
  process.exit(1);
});

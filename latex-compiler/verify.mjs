/**
 * Contract and abuse tests for the isolated LaTeX compiler service.
 *
 * Runs against a live service (container or a local process):
 *   COMPILE_TOKEN=... node verify.mjs                 # http://127.0.0.1:8080
 *   SERVICE_URL=http://127.0.0.1:5071 COMPILE_TOKEN=... node verify.mjs
 *
 * It checks authentication, forbidden-command rejection (including the
 * \csname filter bypass), structure validation, the source-size cap, the
 * wall-clock timeout, PDF output, credential leaks in error bodies, and that
 * no temp directory survives a compile. Set SKIP_TIMEOUT=1 to skip the
 * ~N-second timeout case.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const SERVICE_URL = String(process.env.SERVICE_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
const TOKEN = process.env.COMPILE_TOKEN || "";
const SKIP_TIMEOUT = String(process.env.SKIP_TIMEOUT || "") === "1";

if (!TOKEN) {
  console.error("COMPILE_TOKEN is required (the service rejects unauthenticated calls).");
  process.exit(1);
}

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
};

const request = async (body, { token = TOKEN, raw = false } = {}) => {
  const response = await fetch(`${SERVICE_URL}/compile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: raw ? body : JSON.stringify(body)
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const isPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  let json = null;
  if (!isPdf) {
    try {
      json = JSON.parse(buffer.toString("utf8"));
    } catch {
      /* not JSON */
    }
  }
  return { status: response.status, buffer, isPdf, json };
};

const doc = (body) => `\\documentclass{article}\\begin{document}${body}\\end{document}`;

const countTempDirs = async () => {
  const entries = await fs.readdir(os.tmpdir()).catch(() => []);
  return entries.filter((entry) => entry.startsWith("latex-compile-")).length;
};

const main = async () => {
  console.log(`Service: ${SERVICE_URL}\n`);

  const health = await fetch(`${SERVICE_URL}/healthz`).then((response) => response.json().catch(() => null)).catch(() => null);
  record("healthz reports the engine and limits", Boolean(health?.ok), health ? `engine ${health.engine}, cached-only ${health.onlyCached}, concurrency ${health.concurrency}` : "no response");

  const anonymous = await request({ source: doc("x") }, { token: "" });
  record("request without a token is rejected", anonymous.status === 401, `status ${anonymous.status}`);

  const wrongToken = await request({ source: doc("x") }, { token: `${TOKEN}-wrong` });
  record("request with a wrong token is rejected", wrongToken.status === 401, `status ${wrongToken.status}`);

  const shellEscape = await request({ source: doc("\\immediate\\write18{touch /tmp/pwned-by-compiler}") });
  record(
    "shell escape is rejected before spawning TeX",
    shellEscape.status === 400 && shellEscape.json?.error?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${shellEscape.status}, code ${shellEscape.json?.error?.code || "none"}`
  );

  const hostFile = await request({ source: doc("\\input{/etc/passwd}") });
  record(
    "reading a host file is rejected",
    hostFile.status === 400 && hostFile.json?.error?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${hostFile.status}, code ${hostFile.json?.error?.code || "none"}`
  );

  const relativeSecret = await request({
    source: doc("\\input{../backend/.env}")
  });
  record(
    "relative-path file read is rejected",
    relativeSecret.status === 400 && relativeSecret.json?.error?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${relativeSecret.status}, code ${relativeSecret.json?.error?.code || "none"}`
  );

  // Tectonic honours --untrusted for shell escape but not for file reads, so a
  // constructed control sequence must be rejected here rather than by the engine.
  const csnameBypass = await request({ source: doc("\\csname input\\endcsname{/etc/passwd}") });
  record(
    "dynamic \\csname file read is rejected",
    csnameBypass.status === 400 && csnameBypass.json?.error?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${csnameBypass.status}, code ${csnameBypass.json?.error?.code || "none"}`
  );

  const pdfPrimitive = await request({ source: doc('\\XeTeXpdffile "/etc/passwd"') });
  record(
    "XeTeX PDF-embedding primitive is rejected",
    pdfPrimitive.status === 400 && pdfPrimitive.json?.error?.code === "LATEX_FORBIDDEN_COMMAND",
    `status ${pdfPrimitive.status}, code ${pdfPrimitive.json?.error?.code || "none"}`
  );

  const broken = await request({ source: "\\documentclass{article}\\begin{document}unterminated" });
  record("malformed document is rejected", broken.status === 400 && broken.json?.error?.code === "LATEX_STRUCTURE_INVALID", `status ${broken.status}`);

  const malformedJson = await request("{not json", { raw: true });
  record("malformed JSON body is rejected", malformedJson.status === 400 && malformedJson.json?.error?.code === "LATEX_INVALID_REQUEST", `status ${malformedJson.status}`);

  // Use the limit the service actually reports: the image sets 200,000 but the
  // code default is 262,144, so a hardcoded size can silently test the wrong
  // thing (and merely produce a TeX failure instead of a 413).
  const sourceCap = Number(health?.maxSourceBytes) || 200000;
  const oversized = await request({ source: doc("x".repeat(sourceCap + 2000)) });
  record(
    "oversized source is rejected",
    oversized.status === 413 && oversized.json?.error?.code === "LATEX_SOURCE_TOO_LARGE",
    `status ${oversized.status}, code ${oversized.json?.error?.code || "none"}`
  );

  const errorBodies = [anonymous, wrongToken, shellEscape, hostFile, relativeSecret, csnameBypass, pdfPrimitive, broken]
    .map((result) => result.buffer.toString("utf8"))
    .join("\n");
  const leaksToken = errorBodies.includes(TOKEN) || /COMPILE_TOKEN/.test(errorBodies);
  record("error responses never echo the service token", !leaksToken, leaksToken ? "token found in a response body" : "no credential in 8 error bodies");

  const leakAfterRejections = await countTempDirs();
  record("rejected requests leave no temp directory", leakAfterRejections === 0, `${leakAfterRejections} leftover`);

  if (!SKIP_TIMEOUT) {
    const started = Date.now();
    const runaway = await request({ source: doc("\\def\\loop{\\loop}\\loop") });
    const elapsed = Math.round((Date.now() - started) / 1000);
    record(
      "infinite expansion is killed by the wall-clock timeout",
      runaway.status === 504 && runaway.json?.error?.code === "LATEX_TIMEOUT",
      `status ${runaway.status}, ${elapsed}s`
    );
  }

  const started = Date.now();
  const valid = await request({ source: doc("Isolated compiler check") });
  const elapsed = Date.now() - started;
  record(
    "valid document returns a PDF",
    valid.status === 200 && valid.isPdf && valid.buffer.length > 1000,
    `status ${valid.status}, ${Math.round(valid.buffer.length / 1024)} KB, ${elapsed} ms`
  );

  const leftover = await countTempDirs();
  record("successful compile leaves no temp directory", leftover === 0, `${leftover} leftover`);

  // More concurrent calls than MAX_CONCURRENCY must queue, not fail.
  const concurrentStarted = Date.now();
  const concurrent = await Promise.all(
    Array.from({ length: 4 }, (_, index) => request({ source: doc(`Concurrent compile ${index + 1}`) }))
  );
  const concurrentElapsed = Math.round((Date.now() - concurrentStarted) / 1000);
  record(
    "concurrent requests queue and all return a PDF",
    concurrent.every((result) => result.status === 200 && result.isPdf),
    `${concurrent.filter((result) => result.status === 200).length}/4 ok in ${concurrentElapsed}s`
  );

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

main().catch((error) => {
  console.error(`\nCompiler check aborted: ${error.message}`);
  process.exit(1);
});

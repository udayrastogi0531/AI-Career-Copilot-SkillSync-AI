/**
 * Isolated LaTeX compilation service.
 *
 * The API server never runs TeX itself in production: it POSTs the source here
 * and this process compiles it inside a throwaway directory with a hard
 * timeout, an output-size cap, a concurrency limit, `--untrusted`, and (in the
 * container) no network, no shell, a read-only root filesystem, and a memory
 * and PID cap. See README.md for the container invocation.
 *
 * Contract
 *   GET  /healthz  -> { ok, engine, version }
 *   POST /compile  -> application/pdf
 *        Authorization: Bearer <COMPILE_TOKEN>
 *        body: { "source": "\\documentclass..." }
 *        errors: 400/401/413/422/503/504 JSON { error: { code, message, log? } }
 *
 * Env
 *   COMPILE_TOKEN        required; shared bearer token with the API server
 *   PORT                 default 8080
 *   TECTONIC_BIN         default "tectonic"
 *   TIMEOUT_MS           default 20000
 *   MAX_SOURCE_BYTES     default 262144
 *   MAX_OUTPUT_BYTES     default 5242880
 *   MAX_CONCURRENCY      default 2
 *   QUEUE_TIMEOUT_MS     default 30000
 *   TECTONIC_ONLY_CACHED "true" in the container (no network); "false" locally
 *   LOG_RESPONSE         "true" (default) to return a truncated TeX log in errors
 */
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PORT || 8080);
const COMPILE_TOKEN = process.env.COMPILE_TOKEN || "";
const RAW_TECTONIC_BIN = process.env.TECTONIC_BIN || "tectonic";
// A relative binary path must be resolved once, because compiles run inside a
// temporary working directory.
const TECTONIC_BIN = /[\\/]/.test(RAW_TECTONIC_BIN) ? path.resolve(RAW_TECTONIC_BIN) : RAW_TECTONIC_BIN;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 20000);
const MAX_SOURCE_BYTES = Number(process.env.MAX_SOURCE_BYTES || 262144);
const MAX_OUTPUT_BYTES = Number(process.env.MAX_OUTPUT_BYTES || 5 * 1024 * 1024);
const MAX_CONCURRENCY = Math.max(1, Number(process.env.MAX_CONCURRENCY || 2));
const QUEUE_TIMEOUT_MS = Number(process.env.QUEUE_TIMEOUT_MS || 30000);
const ONLY_CACHED = String(process.env.TECTONIC_ONLY_CACHED || "true").toLowerCase() !== "false";
const LOG_RESPONSE = String(process.env.LOG_RESPONSE || "true").toLowerCase() === "true";

if (!COMPILE_TOKEN || COMPILE_TOKEN.length < 16) {
  console.error("COMPILE_TOKEN must be set to at least 16 characters.");
  process.exit(1);
}

const BLOCKED = [
  /\\write18\b/i,
  // Dynamic control-sequence construction reaches blocked primitives without
  // spelling them out: \csname input\endcsname reads a file even though the
  // literal \input is absent. Verified against Tectonic 0.17.0, which honours
  // --untrusted for shell escape but still reads absolute paths.
  /\\csname\b/i,
  /\\endcsname\b/i,
  /\\XeTeXpdffile\b/i,
  /\\pdfximage\b/i,
  /\\input\b/i,
  /\\include\b/i,
  /\\openin\b/i,
  /\\openout\b/i,
  /\\read\b/i,
  /\\immediate\b/i,
  /\\special\b/i,
  /\\directlua\b/i,
  /\\latelua\b/i,
  /\\includegraphics\b/i,
  /\\lstinputlisting\b/i,
  /\\verbatiminput\b/i,
  /\\inputminted\b/i
];

class CompileError extends Error {
  constructor(code, message, status, log = "") {
    super(message);
    this.code = code;
    this.status = status;
    this.log = log;
  }
}

const killTree = (child) => {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
};

const runTectonic = (cwd, args, timeoutMs) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(TECTONIC_BIN, args, {
      cwd,
      env: {
        PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
        HOME: process.env.HOME || "/tmp",
        XDG_CACHE_HOME: process.env.XDG_CACHE_HOME || "/var/cache",
        ...(process.platform === "win32"
          ? {
              SystemRoot: process.env.SystemRoot || "C:\\Windows",
              TEMP: process.env.TEMP || "/tmp",
              TMP: process.env.TMP || "/tmp",
              APPDATA: process.env.APPDATA || ""
            }
          : {}),
        // Harmless for Tectonic (it has no kpathsea and ignores these), but
        // they do constrain a pdfLaTeX fallback. Tectonic's file access is
        // bounded by the BLOCKED filter above and by the container view.
        openin_any: "p",
        openout_any: "p",
        SOURCE_DATE_EPOCH: "0",
        FORCE_SOURCE_DATE: "1"
      },
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (current, chunk) => (current.length >= 256 * 1024 ? current : (current + chunk.toString("utf8")).slice(0, 256 * 1024));

    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error.message}`, timedOut, durationMs: Date.now() - startedAt });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
    });
  });

const queue = [];
let active = 0;

const acquire = () =>
  new Promise((resolve, reject) => {
    if (active < MAX_CONCURRENCY) {
      active += 1;
      resolve();
      return;
    }
    queue.push({ resolve, reject, timer: null, enqueuedAt: Date.now() });
  });

// Age-out queued requests so a saturated service fails fast instead of piling up.
setInterval(() => {
  const now = Date.now();
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (now - queue[index].enqueuedAt > QUEUE_TIMEOUT_MS) {
      const waiter = queue.splice(index, 1)[0];
      waiter.reject(new CompileError("LATEX_BUSY", "The compiler queue is full. Retry shortly.", 503));
    }
  }
}, 5000).unref();

const release = () => {
  active -= 1;
  const next = queue.shift();
  if (next) {
    active += 1;
    next.resolve();
  }
};

const validate = (source) => {
  if (!source.trim()) throw new CompileError("LATEX_EMPTY_SOURCE", "LaTeX source is empty.", 400);
  if (source.length > MAX_SOURCE_BYTES) {
    throw new CompileError("LATEX_SOURCE_TOO_LARGE", `LaTeX source exceeds ${MAX_SOURCE_BYTES} characters.`, 413);
  }
  const withoutComments = source.replace(/(?<!\\)%.*$/gm, "");
  if (BLOCKED.some((pattern) => pattern.test(withoutComments))) {
    throw new CompileError("LATEX_FORBIDDEN_COMMAND", "File I/O and shell commands are not allowed.", 400);
  }
  if (!/\\documentclass/.test(withoutComments) || !/\\begin\{document\}/.test(withoutComments) || !/\\end\{document\}/.test(withoutComments)) {
    throw new CompileError("LATEX_STRUCTURE_INVALID", "Missing \\documentclass, \\begin{document}, or \\end{document}.", 400);
  }
};

const compile = async (source) => {
  validate(source);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "latex-compile-"));
  const outDir = path.join(workDir, "out");
  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(workDir, "resume.tex"), source, { mode: 0o600 });
    const args = ["--untrusted", "--keep-logs", "--outdir", outDir];
    if (ONLY_CACHED) args.push("--only-cached");
    args.push("resume.tex");

    const result = await runTectonic(workDir, args, TIMEOUT_MS);
    let log = `${result.stdout}\n${result.stderr}`;
    try {
      log = `${log}\n${await fs.readFile(path.join(outDir, "resume.log"), "utf8")}`;
    } catch {
      /* no log on early failure */
    }

    if (result.timedOut) {
      throw new CompileError("LATEX_TIMEOUT", `Compilation exceeded ${Math.round(TIMEOUT_MS / 1000)}s.`, 504, log.slice(-8000));
    }

    const pdfPath = path.join(outDir, "resume.pdf");
    const stat = await fs.stat(pdfPath).catch(() => null);
    if (!stat || !stat.isFile()) {
      throw new CompileError("LATEX_COMPILE_FAILED", "LaTeX could not compile this document.", 422, log.slice(-8000));
    }
    if (stat.size > MAX_OUTPUT_BYTES) {
      throw new CompileError("LATEX_OUTPUT_TOO_LARGE", "The compiled PDF exceeded the output limit.", 413);
    }
    if (result.code !== 0) {
      throw new CompileError("LATEX_COMPILE_FAILED", "LaTeX could not compile this document.", 422, log.slice(-8000));
    }

    const pdf = await fs.readFile(pdfPath);
    if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new CompileError("LATEX_INVALID_PDF", "The compiler produced an invalid PDF.", 500);
    }
    return { pdf, durationMs: result.durationMs };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

const authorized = (header) => {
  const match = String(header || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(COMPILE_TOKEN);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    req.on("data", (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_SOURCE_BYTES + 4096) {
        // Reject without destroying the socket: an abrupt destroy resets the
        // connection mid-upload and the caller sees a network error instead of
        // the 413 that explains what happened. Keep draining, stop buffering.
        settled = true;
        chunks.length = 0;
        req.resume();
        reject(new CompileError("LATEX_SOURCE_TOO_LARGE", `Request body exceeds ${MAX_SOURCE_BYTES} bytes.`, 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        engine: "tectonic",
        onlyCached: ONLY_CACHED,
        concurrency: MAX_CONCURRENCY,
        maxSourceBytes: MAX_SOURCE_BYTES,
        maxOutputBytes: MAX_OUTPUT_BYTES,
        timeoutMs: TIMEOUT_MS
      });
      return;
    }
    if (req.method !== "POST" || req.url !== "/compile") {
      sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Use POST /compile or GET /healthz." } });
      return;
    }
    if (!authorized(req.headers.authorization)) {
      sendJson(res, 401, { error: { code: "UNAUTHORIZED", message: "Missing or invalid bearer token." } });
      return;
    }

    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new CompileError("LATEX_INVALID_REQUEST", "Body must be JSON: {\"source\": \"...\"}.", 400);
    }
    if (typeof payload?.source !== "string") {
      throw new CompileError("LATEX_INVALID_REQUEST", "\"source\" must be a string.", 400);
    }

    await acquire();
    let outcome;
    try {
      outcome = await compile(payload.source);
    } finally {
      release();
    }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": outcome.pdf.length,
      "Cache-Control": "no-store",
      "X-Compile-Ms": String(outcome.durationMs)
    });
    res.end(outcome.pdf);
  } catch (error) {
    const status = error instanceof CompileError ? error.status : 500;
    const body = {
      error: {
        code: error instanceof CompileError ? error.code : "LATEX_SERVICE_ERROR",
        message: error instanceof CompileError ? error.message : "The compiler service failed."
      }
    };
    if (LOG_RESPONSE && error.log) body.error.log = error.log;
    if (!(error instanceof CompileError)) console.error("[latex-service]", error);
    if (!res.headersSent) sendJson(res, status, body);
    else res.end();
  }
});

// Bound how long a client may hold a connection while sending its request;
// the compile itself is covered by TIMEOUT_MS.
server.requestTimeout = TIMEOUT_MS + 30000;
server.headersTimeout = Math.max(15000, TIMEOUT_MS + 5000);
server.keepAliveTimeout = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`latex-compiler listening on :${PORT} (concurrency ${MAX_CONCURRENCY}, timeout ${TIMEOUT_MS}ms, cached-only ${ONLY_CACHED})`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

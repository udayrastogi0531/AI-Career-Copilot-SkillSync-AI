import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import { env } from "../config/env.js";
import { buildLatexFromResume, LATEX_TEMPLATES } from "./latexTemplates.js";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWED_PACKAGES = new Set([
  "geometry",
  "enumitem",
  "titlesec",
  "titling",
  "hyperref",
  "xcolor",
  "color",
  "tabularx",
  "array",
  "parskip",
  "multicol",
  "textcomp",
  "amsmath",
  "amssymb",
  "ragged2e",
  "microtype",
  "fancyhdr",
  "lastpage",
  "etoolbox",
  "needspace",
  "setspace",
  "float",
  "caption",
  "booktabs",
  "longtable",
  "graphicx"
]);

const FORBIDDEN_COMMANDS = [
  { pattern: /\\write18\b/i, name: "\\write18" },
  // Tectonic 0.17.0 disables shell escape under --untrusted but still reads
  // absolute paths, so the command filter is the barrier for file access.
  // \csname input\endcsname reaches \input without spelling it out.
  {
    pattern: /\\csname\b/i,
    name: "\\csname",
    reason: "Dynamic control-sequence construction can bypass the command filter."
  },
  { pattern: /\\endcsname\b/i, name: "\\endcsname" },
  { pattern: /\\XeTeXpdffile\b/i, name: "\\XeTeXpdffile" },
  { pattern: /\\pdfximage\b/i, name: "\\pdfximage" },
  { pattern: /\\input\b/i, name: "\\input" },
  { pattern: /\\include\b/i, name: "\\include" },
  { pattern: /\\includeonly\b/i, name: "\\includeonly" },
  { pattern: /\\openin\b/i, name: "\\openin" },
  { pattern: /\\openout\b/i, name: "\\openout" },
  { pattern: /\\read\b/i, name: "\\read" },
  { pattern: /\\immediate\b/i, name: "\\immediate" },
  { pattern: /\\directlua\b/i, name: "\\directlua" },
  { pattern: /\\latelua\b/i, name: "\\latelua" },
  { pattern: /\\special\b/i, name: "\\special" },
  { pattern: /\\includegraphics\b/i, name: "\\includegraphics" },
  { pattern: /\\lstinputlisting\b/i, name: "\\lstinputlisting" },
  { pattern: /\\verbatiminput\b/i, name: "\\verbatiminput" },
  { pattern: /\\inputminted\b/i, name: "\\inputminted" },
  { pattern: /\\usepackage\s*\{[^}]*shellesc/i, name: "shellesc package" },
  { pattern: /\\usepackage\s*\{[^}]*minted/i, name: "minted package" },
  { pattern: /\\usepackage\s*\{[^}]*pythontex/i, name: "pythontex package" },
  { pattern: /\\usepackage\s*\{[^}]*filecontents/i, name: "filecontents package" }
];

export class LatexCompileError extends Error {
  constructor(message, code = "LATEX_COMPILE_FAILED", statusCode = 422, details = {}) {
    super(message);
    this.name = "LatexCompileError";
    this.code = code;
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

/**
 * Validate untrusted LaTeX. This is defence in depth: the compiler itself runs
 * untrusted and cannot read arbitrary files, but rejecting dangerous commands
 * and unknown packages also gives users useful, early errors.
 */
export const validateLatexSource = (source) => {
  const text = String(source ?? "");
  if (!text.trim()) {
    throw new LatexCompileError("LaTeX source is empty.", "LATEX_EMPTY_SOURCE", 400);
  }
  if (text.length > env.latexMaxSourceBytes) {
    throw new LatexCompileError(
      `LaTeX source exceeds the ${env.latexMaxSourceBytes} character limit.`,
      "LATEX_SOURCE_TOO_LARGE",
      413
    );
  }

  const withoutComments = text.replace(/(?<!\\)%.*$/gm, "");

  for (const command of FORBIDDEN_COMMANDS) {
    if (command.pattern.test(withoutComments)) {
      throw new LatexCompileError(
        `${command.name} is not allowed in the resume compiler. ${
          command.reason || "File I/O and shell access are disabled."
        }`,
        "LATEX_FORBIDDEN_COMMAND",
        400,
        { line: findLineNumber(text, command.pattern) }
      );
    }
  }

  const packageMatches = [...withoutComments.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g)];
  for (const match of packageMatches) {
    const packages = match[1].split(",").map((name) => name.trim());
    for (const packageName of packages) {
      if (packageName && !ALLOWED_PACKAGES.has(packageName)) {
        throw new LatexCompileError(
          `Package "${packageName}" is not on the compiler allowlist. Allowed packages: ${[...ALLOWED_PACKAGES]
            .sort()
            .join(", ")}.`,
          "LATEX_PACKAGE_NOT_ALLOWED",
          400,
          { line: findLineNumber(text, match[0]) }
        );
      }
    }
  }

  const links = [...withoutComments.matchAll(/\\href\{([^}]*)\}/g)].map((match) => match[1]);
  for (const link of links) {
    const scheme = String(link).trim().toLowerCase();
    if (!/^(https?:\/\/|mailto:|#)/.test(scheme)) {
      throw new LatexCompileError(
        "Links must use http, https, mailto, or an in-document anchor.",
        "LATEX_UNSAFE_LINK",
        400
      );
    }
  }

  if (!/\\documentclass/.test(withoutComments) || !/\\begin\{document\}/.test(withoutComments) || !/\\end\{document\}/.test(withoutComments)) {
    throw new LatexCompileError(
      "The source must contain \\documentclass, \\begin{document}, and \\end{document}.",
      "LATEX_STRUCTURE_INVALID",
      400
    );
  }

  return text;
};

const findLineNumber = (text, pattern) => {
  const lines = String(text || "").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (typeof pattern === "string") {
      if (lines[index].includes(pattern)) return index + 1;
      continue;
    }
    pattern.lastIndex = 0;
    if (pattern.test(lines[index])) return index + 1;
  }
  return null;
};

let compilerCache = { checkedAt: 0, value: null };

const fileExists = (candidate) => {
  try {
    return fsSync.existsSync(candidate);
  } catch {
    return false;
  }
};

const canRun = (command) => {
  try {
    const result = spawnSync(command, ["--version"], {
      timeout: 4000,
      windowsHide: true,
      stdio: "ignore"
    });
    return result.status === 0;
  } catch {
    return false;
  }
};

export const findLocalCompiler = () => {
  const now = Date.now();
  if (compilerCache.value && now - compilerCache.checkedAt < 60_000) {
    return compilerCache.value;
  }

  const explicit = String(env.latexBin || "").trim();
  if (explicit && (fileExists(explicit) || canRun(explicit))) {
    compilerCache = { checkedAt: now, value: explicit };
    return explicit;
  }

  const localCandidates = [
    path.join(BACKEND_ROOT, ".tools", "tectonic.exe"),
    path.join(BACKEND_ROOT, ".tools", "tectonic"),
    path.join(BACKEND_ROOT, "node_modules", ".bin", "tectonic")
  ];
  for (const candidate of localCandidates) {
    if (fileExists(candidate) && canRun(candidate)) {
      compilerCache = { checkedAt: now, value: candidate };
      return candidate;
    }
  }

  for (const command of ["tectonic", "pdflatex"]) {
    if (canRun(command)) {
      compilerCache = { checkedAt: now, value: command };
      return command;
    }
  }

  compilerCache = { checkedAt: now, value: null };
  return null;
};

export const getCompilerStatus = () => {
  const remote = Boolean(env.latexCompileUrl);
  const localBin = findLocalCompiler();
  // In production a local binary is present on many hosts but will be refused
  // by compileLatex. Reporting "local-sandboxed" there would suggest PDF export
  // works when every compile returns LATEX_LOCAL_DISABLED.
  const localBlocked = env.nodeEnv === "production" && !env.latexAllowLocal;
  return {
    mode: remote ? "remote-isolated-service" : localBin && !localBlocked ? "local-sandboxed" : "unavailable",
    remoteConfigured: remote,
    localBinary: localBin ? path.basename(localBin) : "",
    localAllowedInProduction: Boolean(env.latexAllowLocal),
    localBlockedInProduction: localBlocked
  };
};

const sanitizedEnvironment = () => {
  const allow = [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "APPDATA",
    "LOCALAPPDATA",
    "USERPROFILE",
    "HOME",
    "XDG_CACHE_HOME",
    "XDG_DATA_HOME",
    "LANG",
    "LC_ALL"
  ];
  const result = {};
  for (const key of allow) {
    if (process.env[key]) result[key] = process.env[key];
  }
  // kpathsea limits. Tectonic ignores them; pdfLaTeX honours them.
  result.openin_any = "p";
  result.openout_any = "p";
  result.TEXMFOUTPUT = ".";
  result.SOURCE_DATE_EPOCH = "0";
  result.FORCE_SOURCE_DATE = "1";
  return result;
};

const killProcessTree = (child) => {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    // Tectonic/pdflatex can spawn helpers; /T kills the whole tree.
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

const runProcess = (command, args, { cwd, timeoutMs }) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: sanitizedEnvironment(),
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const capture = (chunk, append) => {
      if (append.length >= 512 * 1024) return append;
      return (append + chunk.toString("utf8")).slice(0, 512 * 1024);
    };

    child.stdout.on("data", (chunk) => {
      stdout = capture(chunk, stdout);
    });
    child.stderr.on("data", (chunk) => {
      stderr = capture(chunk, stderr);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child);
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

const parseLatexErrors = (log = "") => {
  const text = String(log || "");
  const errors = [];
  const seen = new Set();

  const add = (message, line, context = "") => {
    const key = `${line}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    errors.push({ message: message.trim(), line: line || null, context: context.trim().slice(0, 240) });
  };

  // pdfLaTeX style: "! LaTeX Error: ..." followed by "l.42 ..."
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("! ")) {
      const message = line.replace(/^!\s*/, "");
      let errorLine = null;
      for (let lookahead = index; lookahead < Math.min(index + 12, lines.length); lookahead += 1) {
        const match = lines[lookahead].match(/^l\.(\d+)\s*(.*)$/);
        if (match) {
          errorLine = Number(match[1]);
          add(message, errorLine, match[2]);
          break;
        }
      }
      if (!errorLine) add(message, null);
    }
    const direct = line.match(/^(?:error:\s*)?(?:.*?)(?:resume\.tex|\.\/resume\.tex):(\d+):\s*(.+)$/i);
    if (direct) add(direct[2], Number(direct[1]));
  }

  // Tectonic diagnostics: "error: ..." with "--> resume.tex:12:5"
  const tectonicPattern = /error:\s*([^\n]+)\n(?:.*\n){0,3}?\s*-->\s*(?:resume\.tex|\.\/resume\.tex):(\d+):(\d+)/g;
  let match;
  while ((match = tectonicPattern.exec(text)) !== null) {
    add(match[1], Number(match[2]));
  }

  if (!errors.length) {
    const fallback = text
      .split(/\r?\n/)
      .filter((line) => /^error:|^! |Emergency stop|Fatal error|Undefined control sequence/i.test(line.trim()))
      .slice(0, 10);
    for (const line of fallback) add(line.replace(/^error:\s*/i, ""), null);
  }

  return errors.slice(0, 20);
};

const parsePageCount = (log, pdfBuffer) => {
  const logMatch = String(log || "").match(/\((\d+)\s+pages?\b/i);
  if (logMatch) return Number(logMatch[1]);

  const pdfText = pdfBuffer.toString("latin1");
  const pageObjects = (pdfText.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
  if (pageObjects) return pageObjects;
  const countMatch = pdfText.match(/\/Count\s+(\d+)/);
  return countMatch ? Number(countMatch[1]) : 0;
};

const compileWithRemoteService = async (source) => {
  if (!env.latexCompileUrl) {
    throw new LatexCompileError("No isolated LaTeX compiler is configured.", "LATEX_COMPILER_UNAVAILABLE", 503);
  }

  try {
    const response = await axios.post(
      env.latexCompileUrl,
      { source },
      {
        timeout: env.latexTimeoutMs + 5000,
        responseType: "arraybuffer",
        maxContentLength: 10 * 1024 * 1024,
        maxRedirects: 0,
        headers: {
          "Content-Type": "application/json",
          ...(env.latexCompileToken ? { Authorization: `Bearer ${env.latexCompileToken}` } : {})
        }
      }
    );

    const buffer = Buffer.from(response.data);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      throw new LatexCompileError(
        "The isolated compiler returned a response that was not a PDF.",
        "LATEX_REMOTE_INVALID_RESPONSE",
        502
      );
    }

    const reportedMs = Number(response.headers?.["x-compile-ms"]);
    return {
      pdf: buffer,
      log: "",
      errors: [],
      pageCount: parsePageCount("", buffer),
      engine: "remote-isolated-latex",
      durationMs: Number.isFinite(reportedMs) ? reportedMs : 0
    };
  } catch (error) {
    if (error instanceof LatexCompileError) throw error;
    const raw = error.response?.data ? Buffer.from(error.response.data).toString("utf8") : "";
    let payload = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }

    // The isolated service reports its own status (400/413/422/503/504). Surface
    // it instead of flattening every remote failure into a generic 502.
    const remoteCode = payload?.error?.code;
    if (remoteCode) {
      const statusMap = {
        LATEX_EMPTY_SOURCE: 400,
        LATEX_FORBIDDEN_COMMAND: 400,
        LATEX_STRUCTURE_INVALID: 400,
        LATEX_INVALID_REQUEST: 400,
        LATEX_SOURCE_TOO_LARGE: 413,
        LATEX_OUTPUT_TOO_LARGE: 413,
        LATEX_TIMEOUT: 504,
        LATEX_COMPILE_FAILED: 422,
        LATEX_BUSY: 503
      };
      throw new LatexCompileError(
        payload.error.message || "The isolated LaTeX compiler could not compile this document.",
        remoteCode,
        statusMap[remoteCode] || 502,
        { log: String(payload.error.log || "").slice(-8000) }
      );
    }

    const details = raw ? raw.slice(0, 4000) : error.message;
    throw new LatexCompileError(
      "The isolated LaTeX compiler could not be reached or failed.",
      "LATEX_REMOTE_FAILED",
      502,
      { log: details }
    );
  }
};

const compileLocally = async (source) => {
  const compiler = findLocalCompiler();
  if (!compiler) {
    throw new LatexCompileError(
      "No LaTeX compiler is installed on this server. Configure LATEX_COMPILE_URL or install Tectonic.",
      "LATEX_COMPILER_UNAVAILABLE",
      503
    );
  }

  if (env.nodeEnv === "production" && !env.latexAllowLocal) {
    throw new LatexCompileError(
      "Local LaTeX compilation is disabled in production. Configure LATEX_COMPILE_URL to an isolated compiler service.",
      "LATEX_LOCAL_DISABLED",
      503
    );
  }

  const isTectonic = /tectonic/i.test(path.basename(compiler));
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "skillsync-tex-"));
  const outDir = path.join(workDir, "out");

  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(workDir, "resume.tex"), source, { mode: 0o600 });

    const args = isTectonic
      ? ["--untrusted", "--keep-logs", "--outdir", outDir, "resume.tex"]
      : [
          "-no-shell-escape",
          "-halt-on-error",
          "-interaction=nonstopmode",
          "-file-line-error",
          "-output-directory",
          outDir,
          "resume.tex"
        ];

    const result = await runProcess(compiler, args, { cwd: workDir, timeoutMs: env.latexTimeoutMs });

    let pdfBuffer = null;
    try {
      pdfBuffer = await fs.readFile(path.join(outDir, "resume.pdf"));
    } catch {
      pdfBuffer = null;
    }

    let log = `${result.stdout}\n${result.stderr}`;
    try {
      log = `${log}\n${await fs.readFile(path.join(outDir, "resume.log"), "utf8")}`;
    } catch {
      // pdflatex may not produce a log when it cannot start.
    }

    if (result.timedOut) {
      throw new LatexCompileError(
        `Compilation exceeded the ${Math.round(env.latexTimeoutMs / 1000)} second limit and was stopped.`,
        "LATEX_TIMEOUT",
        422,
        { log: log.slice(-8000), errors: [{ message: "Compilation timed out.", line: null }] }
      );
    }

    if (!pdfBuffer || result.code !== 0) {
      throw new LatexCompileError(
        "LaTeX could not compile this document. Fix the reported errors and try again.",
        "LATEX_COMPILE_FAILED",
        422,
        { log: log.slice(-8000), errors: parseLatexErrors(log) }
      );
    }

    const header = pdfBuffer.subarray(0, 5).toString("latin1");
    if (header !== "%PDF-") {
      throw new LatexCompileError("The compiler produced an invalid PDF.", "LATEX_INVALID_PDF", 500);
    }

    if (pdfBuffer.length > env.latexMaxOutputBytes) {
      throw new LatexCompileError(
        "The compiled PDF exceeded the output size limit.",
        "LATEX_OUTPUT_TOO_LARGE",
        413
      );
    }

    return {
      pdf: pdfBuffer,
      log: log.slice(-12000),
      errors: [],
      pageCount: parsePageCount(log, pdfBuffer),
      engine: `${isTectonic ? "tectonic" : "pdflatex"} (sandboxed)`,
      durationMs: result.durationMs
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

/**
 * Compile untrusted LaTeX into a PDF.
 *
 * In production the API server only forwards to LATEX_COMPILE_URL unless
 * LATEX_ALLOW_LOCAL is explicitly enabled. Local compilation is always
 * sandboxed in a fresh temp directory with --untrusted (Tectonic) or
 * -no-shell-escape (pdfLaTeX), a hard timeout, and output/size limits.
 */
export const compileLatex = async (source) => {
  const validated = validateLatexSource(source);
  if (env.latexCompileUrl) {
    return compileWithRemoteService(validated);
  }
  return compileLocally(validated);
};

export const compileResume = async (resume, templateId) => {
  const template = LATEX_TEMPLATES.find((item) => item.id === templateId) || LATEX_TEMPLATES[0];
  const source = buildLatexFromResume(resume, template.id);
  const result = await compileLatex(source);
  return { ...result, source, templateId: template.id };
};

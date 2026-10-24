import { Worker } from "node:worker_threads";
import { env } from "../config/env.js";

/**
 * Untrusted document ingestion.
 *
 * PDFs and DOCX files are attacker-controlled. Byte-size caps alone do not
 * bound the cost of parsing them: a 30 KB PDF can expand into millions of text
 * operators and seconds of blocking CPU inside pdf.js, and a DOCX is a zip
 * archive that can declare gigabytes of uncompressed XML.
 *
 * Everything here therefore treats the parser as hostile:
 *
 *   - pre-flight checks reject documents before a parser ever sees them
 *     (encryption, declared zip expansion, entry count);
 *   - the actual parse runs in a worker thread with a hard wall-clock timeout,
 *     a preemptible `terminate()` and a memory ceiling, so a pathological
 *     document cannot stall the event loop or exhaust the process heap;
 *   - concurrent parses are capped, because the CPU is a shared resource;
 *   - extracted text is normalised and capped, and empty text is an explicit
 *     error rather than a silently blank resume.
 *
 * The parser never touches the network, never writes files and never follows
 * links found in the document.
 */

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";
export const TEXT_MIME = "text/plain";

export class DocumentParseError extends Error {
  constructor(message, code = "DOCUMENT_INVALID", statusCode = 422) {
    super(message);
    this.name = "DocumentParseError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const LIMITS = {
  maxPdfPages: 40,
  maxTextChars: 200_000,
  timeoutMs: 10_000,
  concurrency: 1,
  queueWaitMs: 10_000,
  maxDocxUncompressedBytes: 64 * 1024 * 1024,
  maxDocxEntries: 512,
  maxCompressionRatio: 120,
  // One parse at a time: a single hostile document already peaks near 250 MB of
  // process RSS (measured), and the documented host has 512 MB. The worker heap
  // ceiling fails only that worker, never the API process.
  workerHeapMb: 192
};

/**
 * A small FIFO gate. Parsing is CPU-bound, so unbounded concurrency is a
 * denial-of-service vector even when each individual parse is time-limited.
 */
export const createParseLimiter = ({ concurrency = LIMITS.concurrency, waitMs = LIMITS.queueWaitMs } = {}) => {
  let active = 0;
  const queue = [];

  const release = () => {
    const next = queue.shift();
    if (!next) {
      active -= 1;
      return;
    }
    // The slot is handed straight to the queued task, so `active` is unchanged.
    clearTimeout(next.timer);
    next.grant();
  };

  const acquire = () =>
    new Promise((resolve, reject) => {
      if (active < concurrency) {
        active += 1;
        resolve(release);
        return;
      }

      const entry = {
        grant: () => resolve(release),
        timer: null
      };
      entry.timer = setTimeout(() => {
        const index = queue.indexOf(entry);
        if (index !== -1) queue.splice(index, 1);
        reject(new DocumentParseError("Other documents are being processed. Try again shortly.", "DOCUMENT_BUSY", 503));
      }, waitMs);
      entry.timer.unref?.();
      queue.push(entry);
    });

  return {
    acquire,
    get active() {
      return active;
    },
    get queued() {
      return queue.length;
    }
  };
};

const defaultLimiter = createParseLimiter();

const startsWith = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);

export const detectDocumentType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return PDF_MIME;
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) {
    return DOCX_MIME;
  }
  return TEXT_MIME;
};

/**
 * pdf.js asks for a password through `loadingTask.onPassword`, which pdf-parse
 * never sets, so an encrypted file rejects with a generic parse error. Detecting
 * the trailer dictionary first gives the user an actionable message instead.
 */
export const isEncryptedPdf = (buffer) => {
  const raw = buffer.toString("latin1");
  // `/Encrypt` only appears in the trailer dictionary of an encrypted document.
  return /\/Encrypt\s+\d+\s+\d+\s+R/.test(raw) || /\/Encrypt\s*<</.test(raw);
};

const findEndOfCentralDirectory = (buffer) => {
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
};

/**
 * Read the zip central directory without inflating anything. Declared sizes are
 * attacker-supplied, so this is a cheap early rejection: the worker's memory
 * ceiling is what catches a document that lies about them.
 */
export const readZipDirectory = (buffer) => {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) {
    throw new DocumentParseError("The document is not a valid DOCX archive.", "DOCUMENT_INVALID", 422);
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);

  if (entryCount === 0xffff || directoryOffset === 0xffffffff || directorySize === 0xffffffff) {
    throw new DocumentParseError("ZIP64 documents are not supported.", "DOCUMENT_UNSUPPORTED", 422);
  }
  if (entryCount > LIMITS.maxDocxEntries) {
    throw new DocumentParseError("The document contains too many embedded parts.", "DOCUMENT_TOO_COMPLEX", 422);
  }

  const entries = [];
  let cursor = directoryOffset;
  let totalUncompressed = 0;

  while (entries.length < entryCount) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new DocumentParseError("The DOCX archive directory is corrupt.", "DOCUMENT_INVALID", 422);
    }

    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);

    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
      throw new DocumentParseError("ZIP64 documents are not supported.", "DOCUMENT_UNSUPPORTED", 422);
    }

    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    entries.push({ name, compressedSize, uncompressedSize });
    totalUncompressed += uncompressedSize;

    if (totalUncompressed > LIMITS.maxDocxUncompressedBytes) {
      throw new DocumentParseError(
        "The document expands to too much data to process safely.",
        "DOCUMENT_TOO_COMPLEX",
        422
      );
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  if (buffer.length > 0 && totalUncompressed / buffer.length > LIMITS.maxCompressionRatio) {
    throw new DocumentParseError(
      "The document expands to too much data to process safely.",
      "DOCUMENT_TOO_COMPLEX",
      422
    );
  }

  if (!entries.some((entry) => entry.name === "word/document.xml")) {
    throw new DocumentParseError("The file is not a Word document.", "DOCUMENT_INVALID", 422);
  }

  return { entries, totalUncompressed };
};

/**
 * Extracted text is stored, rendered into LaTeX and sent to the AI provider, so
 * it is normalised first: no NULs, no C0 control characters, no runaway blank
 * lines, and a hard character ceiling.
 */
export const normalizeExtractedText = (value, maxChars = LIMITS.maxTextChars) => {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    // Keep newlines and tabs; drop every other C0/C1 control character.
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const truncated = text.length > maxChars;
  return { text: truncated ? text.slice(0, maxChars).trim() : text, truncated };
};

const workerUrl = new URL("./documentParseWorker.js", import.meta.url);

const mapWorkerFailure = (error) => {
  if (error instanceof DocumentParseError) return error;
  const code = String(error?.code || "");
  if (code === "ERR_WORKER_OUT_OF_MEMORY" || error?.name === "RangeError") {
    return new DocumentParseError(
      "The document is too large or too complex to process safely.",
      "DOCUMENT_TOO_COMPLEX",
      422
    );
  }
  return new DocumentParseError("Could not read that document.", "DOCUMENT_INVALID", 422);
};

const parseInWorker = (payload, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: payload,
      resourceLimits: { maxOldGenerationSizeMb: LIMITS.workerHeapMb, maxYoungGenerationSizeMb: 32 },
      stdout: true,
      stderr: true
    });

    // Discard the worker's console output. Parser warnings can be driven by the
    // document itself, and an unread stream would eventually block the worker.
    worker.stdout?.resume();
    worker.stderr?.resume();

    let settled = false;
    let timer = null;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      handler(value);
      // Never leave a parse running behind a settled promise.
      worker.terminate().catch(() => {});
    };

    timer = setTimeout(() => {
      finish(
        reject,
        new DocumentParseError(
          "Reading that document took too long. Try a smaller or simpler file.",
          "DOCUMENT_PARSE_TIMEOUT",
          422
        )
      );
    }, timeoutMs);
    timer.unref?.();

    worker.once("message", (message) => {
      if (message?.ok) finish(resolve, message.result);
      else finish(reject, mapWorkerFailure(message?.error ?? {}));
    });

    worker.once("error", (error) => finish(reject, mapWorkerFailure(error)));
    worker.once("exit", () => {
      // Reached only when the worker died before posting a result; a settled
      // promise is left alone.
      finish(reject, new DocumentParseError("The document could not be processed.", "DOCUMENT_INVALID", 422));
    });
  });

/**
 * Parse one uploaded document. `maxBytes` is re-checked here so the service is
 * safe even when it is called directly, without the upload middleware.
 */
export const extractDocumentText = async (
  { buffer, mimeType, filename = "", maxBytes = 8 * 1024 * 1024 },
  options = {}
) => {
  const type = String(mimeType || "").toLowerCase();
  const limits = {
    maxPdfPages: options.maxPdfPages ?? LIMITS.maxPdfPages,
    maxTextChars: options.maxTextChars ?? LIMITS.maxTextChars,
    timeoutMs: options.timeoutMs ?? env.documentParseTimeoutMs ?? LIMITS.timeoutMs
  };

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new DocumentParseError("The uploaded file is empty.", "DOCUMENT_EMPTY", 400);
  }
  if (buffer.length > maxBytes) {
    throw new DocumentParseError("The uploaded file is too large.", "DOCUMENT_TOO_LARGE", 413);
  }
  /** @type {typeof PDF_MIME | string | null} */
  let effectiveType = type;
  if (![PDF_MIME, DOCX_MIME, TEXT_MIME].includes(type)) {
    // The Content-Type header is client-controlled; the bytes decide.
    effectiveType = detectDocumentType(buffer);
    if (!effectiveType) {
      throw new DocumentParseError("Only PDF or DOCX files are allowed.", "DOCUMENT_UNSUPPORTED", 400);
    }
  }

  if (effectiveType === PDF_MIME) {
    if (!startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) {
      throw new DocumentParseError("Invalid PDF file signature.", "DOCUMENT_SIGNATURE_INVALID", 400);
    }
    if (isEncryptedPdf(buffer)) {
      throw new DocumentParseError(
        "That PDF is password-protected. Upload an unlocked copy.",
        "DOCUMENT_ENCRYPTED",
        422
      );
    }
  }

  if (effectiveType === DOCX_MIME) {
    if (
      !startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
      !startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])
    ) {
      throw new DocumentParseError("Invalid DOCX file signature.", "DOCUMENT_SIGNATURE_INVALID", 400);
    }
    readZipDirectory(buffer);
  }

  if (effectiveType === TEXT_MIME) {
    // Plain text needs no parser and cannot exhaust one.
    const sample = buffer.subarray(0, 1024);
    for (const byte of sample) {
      if (byte === 0) {
        throw new DocumentParseError("That file is not readable text.", "DOCUMENT_INVALID", 400);
      }
    }
    const decoded = buffer.toString("utf8");
    if (decoded.includes("\uFFFD")) {
      throw new DocumentParseError("That file is not readable text.", "DOCUMENT_INVALID", 400);
    }
    const normalized = normalizeExtractedText(decoded, limits.maxTextChars);
    if (!normalized.text) {
      throw new DocumentParseError("No text could be read from that file.", "DOCUMENT_NO_TEXT", 422);
    }
    return { ...normalized, pages: 1, filename: String(filename || "") };
  }

  const limiter = options.limiter ?? defaultLimiter;
  const release = await limiter.acquire();
  let parsed;
  try {
    parsed = await parseInWorker(
      {
        buffer,
        mimeType: effectiveType,
        maxPages: limits.maxPdfPages,
        maxChars: limits.maxTextChars
      },
      { timeoutMs: limits.timeoutMs }
    );
  } finally {
    release();
  }

  if (effectiveType === PDF_MIME && parsed.pages > limits.maxPdfPages) {
    throw new DocumentParseError(
      `That PDF has ${parsed.pages} pages. The limit is ${limits.maxPdfPages}.`,
      "DOCUMENT_TOO_MANY_PAGES",
      422
    );
  }

  const normalized = normalizeExtractedText(parsed.text, limits.maxTextChars);
  if (!normalized.text) {
    throw new DocumentParseError(
      "No text could be read from that file. Scanned or image-only documents need OCR, which is not supported.",
      "DOCUMENT_NO_TEXT",
      422
    );
  }

  return {
    ...normalized,
    pages: parsed.pages ?? null,
    filename: String(filename || "")
  };
};

export const documentLimits = { ...LIMITS };

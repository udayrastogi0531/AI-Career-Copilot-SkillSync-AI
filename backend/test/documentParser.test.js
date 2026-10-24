/**
 * Untrusted document parsing: containment, limits and error mapping.
 *
 * These tests are about what a hostile upload can make the server do: read
 * resources it should not, spend unbounded CPU, exhaust the heap, or pass a
 * parser something that is not what its Content-Type claims.
 */
import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/document_parser_test";
process.env.JWT_SECRET = "document-parser-test-secret-0123456789";
process.env.GEMINI_API_KEY = "invalid-test-key";

const { extractDocumentText, createParseLimiter, normalizeExtractedText, readZipDirectory, isEncryptedPdf } =
  await import("../src/services/documentParser.js");
const { buildPdf, buildDocx, buildDocxBomb, buildZip, patchZipEntryCount } = await import("./helpers/documents.js");

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TXT = "text/plain";

const code = (expected) => (error) => {
  assert.equal(error.code, expected, `expected ${expected}, got ${error.code}: ${error.message}`);
  return true;
};

test("rejects encrypted PDFs with an actionable error instead of a parse failure", async () => {
  const buffer = buildPdf({ encrypt: true });
  assert.equal(isEncryptedPdf(buffer), true);

  await assert.rejects(extractDocumentText({ buffer, mimeType: PDF }), code("DOCUMENT_ENCRYPTED"));
});

test("rejects a DOCX whose archive declares an unsafe expansion", async () => {
  const buffer = buildDocxBomb({ declaredSize: 900 * 1024 * 1024 });
  const started = Date.now();

  await assert.rejects(extractDocumentText({ buffer, mimeType: DOCX }), code("DOCUMENT_TOO_COMPLEX"));
  // The rejection must happen from the directory alone, before any inflation.
  assert.ok(Date.now() - started < 1000, "the bomb should be rejected without parsing");
});

test("rejects zip64 archives and archives without a document part", async () => {
  const zip64 = patchZipEntryCount(buildDocx(), 0xffff);
  await assert.rejects(extractDocumentText({ buffer: zip64, mimeType: DOCX }), code("DOCUMENT_UNSUPPORTED"));

  const noDocument = buildZip([{ name: "notes.txt", data: "just text" }]);
  await assert.rejects(extractDocumentText({ buffer: noDocument, mimeType: DOCX }), code("DOCUMENT_INVALID"));
});

test("the zip directory reader rejects on declared sizes without inflating them", () => {
  const bomb = buildDocxBomb({ declaredSize: 5 * 1024 * 1024 * 1024 - 1 });
  assert.ok(bomb.length < 4096, "the bomb itself is tiny on disk");
  assert.throws(() => readZipDirectory(bomb), code("DOCUMENT_TOO_COMPLEX"));

  // A normal document still parses, so the guard is not simply refusing zips.
  assert.equal(readZipDirectory(buildDocx()).entries.length, 3);
});

test("normalises control characters, collapses blank lines and caps length", () => {
  const messy = "Line one\u0000\u0007\r\n\n\n\nLine\u0008 two\u001b[31m";
  const { text } = normalizeExtractedText(messy);
  assert.equal(text, "Line one\n\nLine two[31m");

  const long = "a".repeat(50);
  const capped = normalizeExtractedText(long, 10);
  assert.equal(capped.text, "a".repeat(10));
  assert.equal(capped.truncated, true);
});

test("rejects empty, oversized, binary and mislabelled uploads", async () => {
  await assert.rejects(extractDocumentText({ buffer: Buffer.alloc(0), mimeType: PDF }), code("DOCUMENT_EMPTY"));

  await assert.rejects(
    extractDocumentText({ buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(9 * 1024 * 1024)]), mimeType: PDF }),
    code("DOCUMENT_TOO_LARGE")
  );

  await assert.rejects(
    extractDocumentText({ buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]), mimeType: TXT }),
    code("DOCUMENT_INVALID")
  );

  // A text file labelled as a PDF must be rejected on its bytes, not its header.
  await assert.rejects(
    extractDocumentText({ buffer: Buffer.from("<html>not a pdf</html>"), mimeType: PDF }),
    code("DOCUMENT_SIGNATURE_INVALID")
  );

  await assert.rejects(extractDocumentText({ buffer: Buffer.from("   \n\t  "), mimeType: TXT }), code("DOCUMENT_NO_TEXT"));
});

// The two extraction tests use a generous budget: worker startup loads pdf.js /
// mammoth from disk, and a cold or busy machine can take seconds. Preemption is
// covered by the dedicated timeout test below.
test("error responses never echo document content", async () => {
  const marker = "SECRETMARKER-XYZZY";
  const attempts = [
    () => extractDocumentText({ buffer: buildPdf({ text: marker, encrypt: true }), mimeType: PDF }),
    () => extractDocumentText({ buffer: buildPdf({ text: marker, truncate: 60 }), mimeType: PDF }),
    () =>
      extractDocumentText(
        { buffer: buildPdf({ text: marker, ops: 400000 }), mimeType: PDF },
        { timeoutMs: 300 }
      )
  ];

  for (const attempt of attempts) {
    await assert.rejects(attempt, (error) => {
      assert.ok(!String(error.message).includes(marker), `message leaked content: ${error.message}`);
      assert.ok(!JSON.stringify(error).includes(marker), "error object leaked content");
      return true;
    });
  }
});

test("extracts text from a real PDF in the isolated worker", async () => {
  const buffer = buildPdf({ text: "Ada Lovelace" });
  const result = await extractDocumentText({ buffer, mimeType: PDF }, { timeoutMs: 30000 });

  assert.match(result.text, /Ada Lovelace/);
  assert.equal(result.pages, 1);
  assert.equal(result.truncated, false);
});

test("extracts text from a real DOCX in the isolated worker", async () => {
  const buffer = buildDocx({ text: "Grace Hopper - COBOL" });
  const result = await extractDocumentText({ buffer, mimeType: DOCX }, { timeoutMs: 30000 });

  assert.match(result.text, /Grace Hopper/);
});

test("rejects a PDF with no extractable text rather than storing a blank resume", async () => {
  const buffer = buildPdf({ noText: true });
  await assert.rejects(extractDocumentText({ buffer, mimeType: PDF }), code("DOCUMENT_NO_TEXT"));
});

test("enforces the page ceiling", async () => {
  const buffer = buildPdf({ pages: 60 });
  await assert.rejects(extractDocumentText({ buffer, mimeType: PDF }), code("DOCUMENT_TOO_MANY_PAGES"));
});

test("terminates a pathological PDF at the timeout and keeps the process usable", async () => {
  // ~30 KB on the wire, seconds of blocking CPU inside pdf.js.
  const heavy = buildPdf({ ops: 400000 });
  assert.ok(heavy.length < 200 * 1024, "fixture should be small");

  const started = Date.now();
  await assert.rejects(
    extractDocumentText({ buffer: heavy, mimeType: PDF }, { timeoutMs: 500 }),
    code("DOCUMENT_PARSE_TIMEOUT")
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 4000, `timeout should be enforced promptly, took ${elapsed}ms`);

  // The worker was terminated, so the next parse must still work.
  const normal = await extractDocumentText({ buffer: buildPdf({ text: "still alive" }), mimeType: PDF }, { timeoutMs: 8000 });
  assert.match(normal.text, /still alive/);
});

test("caps concurrent parses and reports a busy service instead of queueing forever", async () => {
  const limiter = createParseLimiter({ concurrency: 1, waitMs: 50 });
  const release = await limiter.acquire();
  assert.equal(limiter.active, 1);

  await assert.rejects(limiter.acquire(), code("DOCUMENT_BUSY"));
  assert.equal(limiter.queued, 0, "a timed-out waiter must not stay queued");

  release();
  assert.equal(limiter.active, 0);
});

test("hands a freed slot to the next waiter", async () => {
  const limiter = createParseLimiter({ concurrency: 1, waitMs: 2000 });
  const releaseFirst = await limiter.acquire();
  const waiting = limiter.acquire();
  setTimeout(releaseFirst, 20);

  const releaseSecond = await waiting;
  assert.equal(limiter.active, 1);
  releaseSecond();
  assert.equal(limiter.active, 0);
  assert.equal(limiter.queued, 0);
});

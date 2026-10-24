import { parentPort, workerData } from "node:worker_threads";

/**
 * Isolated document parser.
 *
 * This file only ever runs inside a worker thread that the parent can terminate
 * and whose heap the parent has capped. It must stay free of I/O: no network, no
 * filesystem, no child processes.
 */

// pdf.js prints one warning per failing page straight to stdout. A crafted
// document could turn that into a log-flood, so parser chatter is suppressed
// here and only real failures are reported to the parent.
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => {};

const { buffer, mimeType, maxPages, maxChars } = workerData;

const normalize = (value) => String(value ?? "").replace(/\r\n?/g, "\n");

const renderPdfPage = (budget) => async (pageData) => {
  if (budget.remaining <= 0) return "";
  const content = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false
  });

  let text = "";
  let lastY;
  for (const item of content.items) {
    if (lastY === item.transform[5] || !lastY) text += item.str;
    else text += `\n${item.str}`;
    lastY = item.transform[5];
    if (text.length >= budget.remaining) break;
  }

  const slice = text.slice(0, Math.max(0, budget.remaining));
  budget.remaining -= slice.length;
  return slice;
};

const parsePdf = async () => {
  const { default: pdf } = await import("pdf-parse");
  const budget = { remaining: maxChars };
  const result = await pdf(buffer, {
    max: maxPages,
    pagerender: renderPdfPage(budget)
  });

  return {
    text: normalize(result.text),
    pages: result.numpages ?? null
  };
};

const parseDocx = async () => {
  const { default: mammoth } = await import("mammoth");
  // extractRawText ignores images and never resolves external relationships:
  // nothing in the document is fetched.
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: normalize(result.value).slice(0, maxChars),
    pages: null
  };
};

try {
  const result = mimeType === "application/pdf" ? await parsePdf() : await parseDocx();
  parentPort.postMessage({ ok: true, result });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: {
      name: error?.name,
      code: error?.code,
      // The message may quote document content, so it is never forwarded to the
      // client; the parent maps it to a safe error.
      message: String(error?.message || "parse failed").slice(0, 300)
    }
  });
}

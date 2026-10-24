/**
 * Contract tests for the isolated LaTeX compiler path.
 *
 * A local HTTP server stands in for the compiler container; no TeX runs here.
 * The point is that the API forwards the source with its bearer token, accepts
 * only real PDFs, and surfaces the service's own error codes instead of
 * flattening every failure into a generic 502.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

const TOKEN = "remote-test-token-0123456789";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1");

let server;
let compileLatex;
let LatexCompileError;
let seenAuth;

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      seenAuth = req.headers.authorization || "";
      const { source } = JSON.parse(body || "{}");

      if (!String(source).includes("\\documentclass")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "LATEX_STRUCTURE_INVALID", message: "Missing structure." } }));
        return;
      }
      if (String(source).includes("BADTEX")) {
        res.writeHead(422, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              code: "LATEX_COMPILE_FAILED",
              message: "LaTeX could not compile this document.",
              log: "! Undefined control sequence.\\nl.3 \\\\BADTEX"
            }
          })
        );
        return;
      }
      if (String(source).includes("SLOWTEX")) {
        res.writeHead(504, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "LATEX_TIMEOUT", message: "Compilation exceeded 20s." } }));
        return;
      }
      if (String(source).includes("NOTPDF")) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("this is not a pdf");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/pdf", "X-Compile-Ms": "1234" });
      res.end(PDF);
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  process.env.NODE_ENV = "test";
  process.env.LATEX_COMPILE_URL = `http://127.0.0.1:${port}/compile`;
  process.env.LATEX_COMPILE_TOKEN = TOKEN;

  const module = await import("../src/services/latexService.js");
  compileLatex = module.compileLatex;
  LatexCompileError = module.LatexCompileError;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const source = (marker = "") => `\\documentclass{article}\\begin{document}${marker}hello\\end{document}`;

test("remote compile forwards the source with the bearer token and returns the PDF", async () => {
  const result = await compileLatex(source());
  assert.equal(result.engine, "remote-isolated-latex");
  assert.equal(result.durationMs, 1234);
  assert.equal(result.pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.equal(seenAuth, `Bearer ${TOKEN}`);
});

test("remote validation errors keep their 4xx status instead of becoming 502", async () => {
  await assert.rejects(compileLatex("not latex at all"), (error) => {
    assert.ok(error instanceof LatexCompileError);
    assert.equal(error.code, "LATEX_STRUCTURE_INVALID");
    assert.equal(error.statusCode, 400);
    return true;
  });
});

test("remote compile failures surface the code, status, and compiler log", async () => {
  await assert.rejects(compileLatex(source("BADTEX")), (error) => {
    assert.equal(error.code, "LATEX_COMPILE_FAILED");
    assert.equal(error.statusCode, 422);
    assert.match(error.log, /Undefined control sequence/);
    return true;
  });
});

test("remote timeouts map to 504", async () => {
  await assert.rejects(compileLatex(source("SLOWTEX")), (error) => {
    assert.equal(error.code, "LATEX_TIMEOUT");
    assert.equal(error.statusCode, 504);
    return true;
  });
});

test("a non-PDF remote response is rejected", async () => {
  await assert.rejects(compileLatex(source("NOTPDF")), (error) => {
    assert.equal(error.code, "LATEX_REMOTE_INVALID_RESPONSE");
    assert.equal(error.statusCode, 502);
    return true;
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildLatexFromResume, escapeLatex, LATEX_TEMPLATES, renderTemplateSample } from "../src/services/latexTemplates.js";
import { compileLatex, findLocalCompiler, validateLatexSource } from "../src/services/latexService.js";

test("escapeLatex neutralises control characters exactly once", () => {
  const output = escapeLatex("C++ & Node.js_100% {ok} \\backslash ~caret^");
  assert.ok(output.includes("\\&"));
  assert.ok(output.includes("\\_"));
  assert.ok(output.includes("100\\%"));
  assert.ok(output.includes("\\{ok\\}"));
  assert.ok(!output.includes("\\\\textbackslash"));
  assert.ok(!/[\r\n]/.test(output));
});

test("escapeLatex strips emoji and unsupported glyphs", () => {
  const output = escapeLatex("Shipped 🚀 the feature ✅");
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(output));
  assert.ok(output.includes("Shipped"));
});

test("every template builds a structurally valid document", () => {
  for (const template of LATEX_TEMPLATES) {
    const source = renderTemplateSample(template.id);
    assert.ok(source.includes("\\documentclass"));
    assert.ok(source.includes("\\begin{document}"));
    assert.ok(source.includes("\\end{document}"));
    assert.ok(source.includes("\\begin{itemize}"));
    assert.ok(!source.includes("{{"), `${template.id} left an unresolved placeholder`);
  }
});

test("resume data is escaped inside generated LaTeX", () => {
  const source = buildLatexFromResume({
    fullName: "Jane & John 100%_Doe",
    summary: "Built C++ services with 30% latency reduction",
    skills: ["C++", "Node.js", "R&D"],
    experience: [{ role: "Eng", company: "A&B", description: "- Cut cost by 12%" }]
  });
  assert.ok(source.includes("Jane \\& John 100\\%\\_Doe"));
  assert.ok(source.includes("C++"));
  assert.ok(source.includes("R\\&D"));
  assert.ok(source.includes("12\\%"));
});

test("validateLatexSource blocks file I/O and shell access", () => {
  const base = "\\documentclass{article}\\begin{document}x\\end{document}";
  assert.throws(() => validateLatexSource(`${base}\\write18{rm -rf /}`), (error) => error.code === "LATEX_FORBIDDEN_COMMAND");
  assert.throws(() => validateLatexSource("\\documentclass{article}\\input{/etc/passwd}\\begin{document}x\\end{document}"), (error) =>
    error.code === "LATEX_FORBIDDEN_COMMAND"
  );
  assert.throws(
    () => validateLatexSource("\\documentclass{article}\\usepackage{shellesc}\\begin{document}x\\end{document}"),
    (error) => error.code === "LATEX_FORBIDDEN_COMMAND"
  );
  assert.throws(
    () => validateLatexSource("\\documentclass{article}\\usepackage{evilpkg}\\begin{document}x\\end{document}"),
    (error) => error.code === "LATEX_PACKAGE_NOT_ALLOWED"
  );
  assert.throws(
    () => validateLatexSource("\\documentclass{article}\\begin{document}\\href{javascript:alert(1)}{x}\\end{document}"),
    (error) => error.code === "LATEX_UNSAFE_LINK"
  );
  assert.throws(() => validateLatexSource("no document here"), (error) => error.code === "LATEX_STRUCTURE_INVALID");
  assert.throws(() => validateLatexSource("   "), (error) => error.code === "LATEX_EMPTY_SOURCE");
});

test("validateLatexSource blocks control-sequence construction and PDF embedding", () => {
  const base = "\\documentclass{article}\\begin{document}";
  const tail = "\\end{document}";
  // Tectonic honours --untrusted for shell escape but still reads absolute
  // paths, so these must be refused before the compiler is reached.
  const bypasses = [
    `${base}\\csname input\\endcsname{/etc/passwd}${tail}`,
    `${base}\\csname openin\\endcsname\\relax${tail}`,
    `${base}\\XeTeXpdffile "/etc/passwd"${tail}`,
    `${base}\\pdfximage{/etc/passwd}${tail}`
  ];
  for (const source of bypasses) {
    assert.throws(
      () => validateLatexSource(source),
      (error) => error.code === "LATEX_FORBIDDEN_COMMAND",
      `expected rejection for ${source}`
    );
  }

  assert.throws(
    () => validateLatexSource(`${base}\\csname input\\endcsname{/etc/passwd}${tail}`),
    (error) => /control-sequence construction/.test(error.message)
  );
});

test("compiles a real PDF when a local compiler is available", { timeout: 180000 }, async (t) => {
  if (!findLocalCompiler()) {
    t.diagnostic("No LaTeX compiler available; skipping real compilation.");
    return;
  }

  const result = await compileLatex(renderTemplateSample("ats-classic"));
  assert.equal(result.pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(result.pdf.length > 1000);
  assert.ok(result.pageCount >= 1);
  assert.match(result.engine, /tectonic|pdflatex/);
});

test("returns line-numbered errors for broken LaTeX", { timeout: 180000 }, async (t) => {
  if (!findLocalCompiler()) {
    t.diagnostic("No LaTeX compiler available; skipping error parsing check.");
    return;
  }

  const broken = "\\documentclass{article}\n\\begin{document}\nHello \\notacommand{world}\n\\end{document}\n";
  await assert.rejects(
    () => compileLatex(broken),
    (error) => {
      assert.equal(error.code, "LATEX_COMPILE_FAILED");
      assert.ok(Array.isArray(error.errors));
      assert.ok(error.errors.some((entry) => entry.line === 3), `expected a line 3 error, got ${JSON.stringify(error.errors)}`);
      return true;
    }
  );
});

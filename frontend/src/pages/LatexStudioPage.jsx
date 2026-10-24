import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileCode,
  History,
  Loader2,
  Redo2,
  RefreshCw,
  Sparkles,
  Undo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { highlightLatex } from "../lib/latexHighlight";

const AI_ACTIONS = [
  { id: "tailor_to_job", label: "Tailor to this job", needsJob: true },
  { id: "improve_summary", label: "Improve summary" },
  { id: "improve_bullet", label: "Improve selected text", needsSelection: true },
  { id: "improve_projects", label: "Improve projects" },
  { id: "missing_keywords", label: "Find missing keywords", needsJob: true },
  { id: "fix_formatting", label: "Fix ATS formatting" },
  { id: "shorten_one_page", label: "Shorten to one page" },
  { id: "explain_latex", label: "Explain LaTeX errors" }
];

const splitSourceIntoLines = (source) => {
  const lines = String(source ?? "").split("\n");
  return lines.map((line, index) => line || " ");
};

const downloadBlob = (data, filename, type) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};

const base64ToBlob = (base64, type = "application/pdf") => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
};

const formatTime = (value) => {
  if (!value) return "never";
  try {
    return new Date(value).toLocaleTimeString();
  } catch {
    return "unknown";
  }
};

const editorStyles = `
.latex-editor { position: relative; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 20px; }
.latex-editor pre, .latex-editor textarea {
  margin: 0; padding: 12px 12px 12px 0; font: inherit; line-height: 20px;
  white-space: pre; overflow-wrap: normal; tab-size: 2;
}
.latex-editor .layers { position: relative; }
.latex-editor pre {
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  color: #e2e8f0; background: transparent;
}
.latex-editor textarea {
  position: relative; width: 100%; min-height: 420px; resize: none;
  background: transparent; color: transparent; caret-color: #67e8f9;
  outline: none; border: 0;
}
.latex-editor textarea::selection { background: rgba(34, 211, 238, 0.35); }
.latex-editor .gutter {
  position: sticky; left: 0; width: 44px; padding: 12px 8px 12px 8px; text-align: right;
  color: #475569; user-select: none; background: rgba(2, 6, 23, 0.75);
}
.tok-command { color: #7dd3fc; }
.tok-env { color: #f0abfc; }
.tok-brace { color: #94a3b8; }
.tok-math { color: #fcd34d; }
.tok-comment { color: #64748b; font-style: italic; }
`;

export default function LatexStudioPage() {
  const [searchParams] = useSearchParams();
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [resume, setResume] = useState(null);
  const [source, setSource] = useState("");
  const [templates, setTemplates] = useState([]);
  const [compiler, setCompiler] = useState(null);
  const [templateId, setTemplateId] = useState("ats-classic");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [compiling, setCompiling] = useState(false);
  const [compileResult, setCompileResult] = useState(null);
  const [compileErrors, setCompileErrors] = useState([]);
  const [compileLog, setCompileLog] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [splitPct, setSplitPct] = useState(52);
  const [versions, setVersions] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef([""]);
  const historyIndexRef = useRef(0);
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState("");
  const [aiJob, setAiJob] = useState(() => {
    try {
      return localStorage.getItem("latex_studio_job") || "";
    } catch {
      return "";
    }
  });
  const [proposals, setProposals] = useState(null);
  const [approved, setApproved] = useState({});
  const [panel, setPanel] = useState("ai");
  const [dirty, setDirty] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);

  const textareaRef = useRef(null);
  const resetHistory = useCallback((value) => {
    historyRef.current = [value];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }, []);
  const autosaveTimer = useRef(null);
  const dragging = useRef(false);
  const containerRef = useRef(null);
  const lastCompiledSource = useRef("");

  const lineNumbers = useMemo(() => splitSourceIntoLines(source).map((_, index) => index + 1), [source]);
  const highlighted = useMemo(() => highlightLatex(source), [source]);

  /* ------------------------------ data loading ----------------------------- */

  const loadResume = useCallback(async (id) => {
    const { data } = await api.get(`/resumes/${id}`);
    const loaded = data.resume;
    setResume(loaded);
    setTemplateId(loaded.templateId || "ats-classic");
    if (loaded.latexSource) {
      setSource(loaded.latexSource);
      resetHistory(loaded.latexSource);
      setDirty(false);
    } else {
      const built = await api.post(`/latex/build/${id}`, {});
      setSource(built.data.source);
      resetHistory(built.data.source);
      setDirty(false);
    }
  }, [resetHistory]);

  const loadVersions = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/resumes/${id}/versions`);
      setVersions(data.versions || []);
    } catch {
      setVersions([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [listResponse, templateResponse] = await Promise.all([
          api.get("/resumes"),
          api.get("/latex/templates")
        ]);
        if (cancelled) return;
        const list = listResponse.data.resumes || [];
        setResumes(list);
        setTemplates(templateResponse.data.templates || []);
        setCompiler(templateResponse.data.compiler || null);

        const requested = searchParams.get("resumeId");
        const chosen = list.find((item) => item._id === requested) || list[0];
        if (chosen) {
          setResumeId(chosen._id);
          await loadResume(chosen._id);
          await loadVersions(chosen._id);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Unable to load the resume workspace");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [searchParams, loadResume, loadVersions]);

  /* --------------------------------- saving -------------------------------- */

  const pushHistory = useCallback((value) => {
    const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (trimmed[trimmed.length - 1] === value) return;
    const next = [...trimmed, value].slice(-60);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const saveLatex = useCallback(
    async ({ createVersion = false, label = "Studio save" } = {}) => {
      if (!resumeId) return;
      setSaving(true);
      setSaveStatus("Saving...");
      try {
        const { data } = await api.put(`/resumes/${resumeId}/latex`, {
          latexSource: source,
          templateId,
          latexMode: "manual",
          createVersion,
          label
        });
        setResume(data.resume);
        setSaveStatus(createVersion ? "Version saved" : "Saved");
        setDirty(false);
        if (createVersion) {
          await loadVersions(resumeId);
          toast.success("Version saved");
        }
      } catch (err) {
        setSaveStatus("Save failed");
        setError(err.response?.data?.message || "Unable to save LaTeX source");
      } finally {
        setSaving(false);
      }
    },
    [resumeId, source, templateId, loadVersions]
  );

  useEffect(() => {
    if (!resumeId || loading || !dirty) return undefined;
    setSaveStatus("Unsaved changes");
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveLatex({ createVersion: false, label: "Autosave" });
    }, 2500);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [source, dirty, resumeId, loading, saveLatex]);

  /* ------------------------------- compilation ----------------------------- */

  const compile = useCallback(
    async ({ silent = false } = {}) => {
      if (!source.trim()) {
        setError("There is no LaTeX source to compile.");
        return null;
      }

      setCompiling(true);
      if (!silent) setError("");
      try {
        const { data } = await api.post("/latex/compile", { source, resumeId, templateId });
        const blob = base64ToBlob(data.pdfBase64);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfBlob(blob);
        setPdfUrl(URL.createObjectURL(blob));
        setPreviewKey((key) => key + 1);
        setPage(1);
        setCompileResult({
          pageCount: data.pageCount,
          engine: data.engine,
          durationMs: data.durationMs,
          bytes: data.bytes
        });
        setCompileErrors([]);
        setCompileLog("");
        lastCompiledSource.current = source;
        if (!silent) toast.success(`Compiled in ${(data.durationMs / 1000).toFixed(1)}s`);
        return data;
      } catch (err) {
        const payload = err.response?.data || {};
        setCompileResult(null);
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
          setPdfUrl("");
        }
        setCompileErrors(payload.errors || []);
        setCompileLog(payload.log || "");
        const message =
          payload.code === "LATEX_COMPILER_UNAVAILABLE" || payload.code === "LATEX_LOCAL_DISABLED"
            ? payload.message
            : payload.errors?.length
            ? `${payload.errors.length} LaTeX error(s) found. Fix them and recompile.`
            : payload.message || "Compilation failed";
        setError(message);
        if (!silent) toast.error("Compilation failed");
        return null;
      } finally {
        setCompiling(false);
      }
    },
    [source, resumeId, templateId, pdfUrl]
  );

  /* ------------------------------ split dragging --------------------------- */

  useEffect(() => {
    const onMove = (event) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((event.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(78, Math.max(24, pct)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* --------------------------------- editing ------------------------------- */

  const handleSourceChange = (event) => {
    const value = event.target.value;
    setSource(value);
    setDirty(true);
    pushHistory(value);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const target = event.target;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = `${source.slice(0, start)}  ${source.slice(end)}`;
      setSource(next);
      setDirty(true);
      requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
      });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveLatex({ createVersion: true, label: "Manual save (Ctrl+S)" });
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      compile();
    }
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setSource(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    setDirty(true);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setSource(historyRef.current[historyIndexRef.current]);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    setDirty(true);
  };

  const jumpToLine = (line) => {
    const textarea = textareaRef.current;
    if (!textarea || !line) return;
    const lines = source.split("\n");
    let offset = 0;
    for (let index = 0; index < Math.min(line - 1, lines.length); index += 1) {
      offset += lines[index].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(offset, offset + (lines[line - 1]?.length || 0));
  };

  const applyTemplate = async (id) => {
    if (!resumeId) return;
    if (!window.confirm("Regenerating from resume data replaces the current LaTeX source. Continue?")) {
      setTemplateId(resume?.templateId || "ats-classic");
      return;
    }
    try {
      const { data } = await api.post(`/resumes/${resumeId}/latex/regenerate`, { templateId: id });
      setResume(data.resume);
      setSource(data.resume.latexSource);
      setTemplateId(data.resume.templateId || id);
      setDirty(false);
      toast.success("LaTeX regenerated from resume data");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to regenerate LaTeX");
    }
  };

  const restoreVersion = async (versionId) => {
    if (!window.confirm("Restore this version? Your current version is snapshotted first.")) return;
    try {
      const { data } = await api.post(`/resumes/${resumeId}/versions/${versionId}/restore`);
      setResume(data.resume);
      setSource(data.resume.latexSource || "");
      setDirty(false);
      await loadVersions(resumeId);
      toast.success("Version restored");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to restore version");
    }
  };

  const loadVersionIntoEditor = async (versionId) => {
    try {
      const { data } = await api.get(`/resumes/${resumeId}/versions/${versionId}`);
      setSource(data.version.latexSource || data.version.snapshot?.latexSource || "");
      setDirty(true);
      toast.info("Version loaded into the editor. Save or compile to keep it.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load version");
    }
  };

  /* ----------------------------------- AI ---------------------------------- */

  const runAiAction = async (action) => {
    if (!resumeId) return;
    const definition = AI_ACTIONS.find((item) => item.id === action);
    if (definition?.needsJob && !aiJob.trim()) {
      setError("Paste the job description to use this action.");
      return;
    }

    let selectedText = "";
    if (definition?.needsSelection) {
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
        selectedText = source.slice(textarea.selectionStart, textarea.selectionEnd);
      } else {
        setError("Select the resume text you want improved, then run this action.");
        return;
      }
    }

    setAiBusy(action);
    setError("");
    try {
      const { data } = await api.post("/copilot/propose", {
        resumeId,
        action,
        selectedText,
        jobDescription: aiJob,
        latexLog: action === "explain_latex" ? compileLog || compileErrors.map((item) => item.message).join("\n") : ""
      });
      const result = data.result;
      setProposals(result);
      setApproved(Object.fromEntries((result.proposals || []).map((proposal) => [proposal.id, true])));
      if (!result.proposals?.length) {
        toast.info("The assistant had no changes to propose.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "The AI assistant could not complete that action.");
    } finally {
      setAiBusy("");
    }
  };

  const applyApproved = async () => {
    if (!proposals?.proposals?.length) return;
    const accepted = proposals.proposals.filter((proposal) => approved[proposal.id] && proposal.section !== "note");
    if (!accepted.length) {
      setError("No applicable proposals are selected.");
      return;
    }

    setAiBusy("apply");
    try {
      const { data } = await api.post("/copilot/apply", { resumeId, proposals: accepted });
      setResume(data.result.resume);
      if (data.result.resume.latexSource) {
        setSource(data.result.resume.latexSource);
        setDirty(false);
      } else {
        const built = await api.post(`/latex/build/${resumeId}`, { templateId });
        setSource(built.data.source);
      }
      await loadVersions(resumeId);
      const skipped = data.result.skipped?.length || 0;
      toast.success(`Applied ${data.result.applied.length} change(s)${skipped ? `, skipped ${skipped}` : ""}`);
      setProposals(null);
      await compile({ silent: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to apply the approved changes");
    } finally {
      setAiBusy("");
    }
  };

  /* --------------------------------- render -------------------------------- */

  const compilerUnavailable = compiler && compiler.mode === "unavailable";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading LaTeX studio...
      </div>
    );
  }

  if (!resumes.length) {
    return (
      <section className="mx-auto max-w-3xl py-10 text-white">
        <h1 className="text-2xl font-bold">LaTeX Studio</h1>
        <p className="mt-3 text-slate-300">
          Create or import a resume first, then come back to edit its LaTeX source and compile a real PDF.
        </p>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-120px)] text-white">
      <style>{editorStyles}</style>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">LaTeX Resume Studio</p>
          <h1 className="mt-1 text-3xl font-extrabold">Source + live PDF</h1>
          <p className="mt-1 text-sm text-slate-400">
            Compiling with {compiler?.mode === "remote-isolated-service" ? "an isolated compiler service" : compiler?.localBinary || "no compiler"}.
            Autosave runs while you type; Ctrl+S saves a version.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={resumeId}
            onChange={async (event) => {
              const id = event.target.value;
              setResumeId(id);
              setLoading(true);
              await loadResume(id);
              await loadVersions(id);
              setLoading(false);
            }}
            className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm"
          >
            {resumes.map((item) => (
              <option key={item._id} value={item._id}>
                {item.title || "Untitled Resume"}
              </option>
            ))}
          </select>
          <select
            value={templateId}
            onChange={(event) => {
              const id = event.target.value;
              setTemplateId(id);
              applyTemplate(id);
            }}
            className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm"
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={undo} disabled={!canUndo} className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40" title="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40" title="Redo">
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowVersions((value) => !value)}
            className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-sm"
          >
            <History className="h-4 w-4" /> Versions ({versions.length})
          </button>
          <button
            type="button"
            onClick={() => saveLatex({ createVersion: true, label: "Manual save" })}
            disabled={saving}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save version"}
          </button>
          <button
            type="button"
            onClick={() => compile()}
            disabled={compiling}
            className="btn-glow flex items-center gap-2 px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            {compiling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {compiling ? "Compiling..." : "Recompile"}
          </button>
        </div>
      </header>

      <ErrorBanner message={error} />

      {compilerUnavailable && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-semibold">No LaTeX compiler is configured on the server.</p>
            <p className="mt-1 text-amber-100/80">
              Set <code>LATEX_COMPILE_URL</code> to an isolated compiler service, or install Tectonic and set
              <code> LATEX_BIN</code> for local development. The editor, versions, and .tex download still work.
            </p>
          </div>
        </div>
      )}

      {showVersions && (
        <div className="mb-4 rounded-xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Version history</h2>
          {versions.length === 0 && <p className="mt-2 text-sm text-slate-400">No saved versions yet.</p>}
          <ul className="mt-2 divide-y divide-white/5">
            {versions.map((version) => (
              <li key={version._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-200">{version.label}</p>
                  <p className="text-xs text-slate-400">
                    {version.reason} · {new Date(version.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => loadVersionIntoEditor(version._id)} className="rounded border border-white/15 px-3 py-1 text-xs">
                    Load into editor
                  </button>
                  <button type="button" onClick={() => restoreVersion(version._id)} className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={containerRef} className="flex flex-col gap-4 lg:flex-row">
        {/* Source pane */}
        <div style={{ width: `${splitPct}%` }} className="min-w-[280px] rounded-2xl border border-white/10 bg-slate-950/70">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <FileCode className="h-4 w-4" /> resume.tex
            </span>
            <span className={dirty ? "text-amber-300" : "text-emerald-300"}>{saveStatus}</span>
          </div>
          <div className="latex-editor flex max-h-[70vh] overflow-auto">
            <pre className="gutter" aria-hidden="true">
              {lineNumbers.map((line) => `${line}\n`).join("")}
            </pre>
            <div className="layers flex-1">
              <pre aria-hidden="true" dangerouslySetInnerHTML={{ __html: `${highlighted}\n` }} />
              <textarea
                ref={textareaRef}
                value={source}
                onChange={handleSourceChange}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                aria-label="LaTeX source"
                className="max-h-[70vh] min-h-[520px]"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={() => {
            dragging.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          className="hidden w-2 cursor-col-resize rounded bg-white/10 lg:block"
        />

        {/* Preview pane */}
        <div className="min-w-[280px] flex-1 rounded-2xl border border-white/10 bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="rounded border border-white/15 px-2 py-1 disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span>
                Page {page}
                {compileResult?.pageCount ? ` / ${compileResult.pageCount}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(compileResult?.pageCount || value + 1, value + 1))}
                disabled={compileResult?.pageCount ? page >= compileResult.pageCount : false}
                className="rounded border border-white/15 px-2 py-1 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setZoom((value) => Math.max(50, value - 10))} className="rounded border border-white/15 px-2 py-1">
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span>{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(200, value + 10))} className="rounded border border-white/15 px-2 py-1">
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {compileResult && (
                <span className="text-emerald-300">
                  {compileResult.engine} · {(compileResult.durationMs / 1000).toFixed(1)}s · {(compileResult.bytes / 1024).toFixed(0)} KB
                </span>
              )}
              <button
                type="button"
                onClick={() => pdfBlob && downloadBlob(pdfBlob, `${resume?.title || "resume"}.pdf`, "application/pdf")}
                disabled={!pdfBlob}
                className="flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-cyan-100 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(source, `${resume?.title || "resume"}.tex`, "text/x-tex")}
                className="flex items-center gap-1 rounded border border-white/15 px-2 py-1"
              >
                <Download className="h-3.5 w-3.5" /> .tex
              </button>
            </div>
          </div>

          <div className="h-[70vh] overflow-hidden rounded-b-2xl bg-slate-800">
            {pdfUrl ? (
              <iframe
                key={`${previewKey}-${page}-${zoom}`}
                title="Compiled resume PDF"
                src={`${pdfUrl}#page=${page}&zoom=${zoom}&toolbar=1`}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                <p>Compile to see the real PDF output.</p>
                <p className="text-xs">Last compiled {formatTime(lastCompiledSource.current ? resume?.lastCompiledAt : null)}</p>
              </div>
            )}
          </div>

          {compileErrors.length > 0 && (
            <div className="border-t border-red-400/30 bg-red-500/5 p-4">
              <h3 className="text-sm font-bold text-red-200">{compileErrors.length} compilation error(s)</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {compileErrors.map((item, index) => (
                  <li key={`${item.line}-${index}`}>
                    <button type="button" onClick={() => jumpToLine(item.line)} className="text-left text-red-100 underline decoration-dotted">
                      {item.line ? `Line ${item.line}: ` : ""}
                      {item.message}
                    </button>
                    {item.context && <p className="ml-4 text-slate-400">{item.context}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* AI assistant panel */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">AI assistant</h2>
          <div className="ml-auto flex gap-2 text-xs">
            <button type="button" onClick={() => setPanel("ai")} className={panel === "ai" ? "text-cyan-200" : "text-slate-500"}>
              Actions
            </button>
            <button type="button" onClick={() => setPanel("log")} className={panel === "log" ? "text-cyan-200" : "text-slate-500"}>
              Compiler log
            </button>
          </div>
        </div>

        {panel === "ai" ? (
          <>
            <textarea
              rows={3}
              value={aiJob}
              onChange={(event) => setAiJob(event.target.value)}
              placeholder="Optional: paste the job description to tailor the resume or find missing keywords."
              className="mb-3 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
            />
            <div className="flex flex-wrap gap-2">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => runAiAction(action.id)}
                  disabled={aiBusy === action.id}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/50 disabled:opacity-50"
                >
                  {aiBusy === action.id ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
                  {action.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Proposals are shown as a diff. Nothing changes until you approve it, and every applied change is snapshotted.
            </p>
          </>
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">
            {compileLog || "Compile the document to generate a log."}
          </pre>
        )}
      </div>

      {/* Diff review modal */}
      {proposals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl border border-white/15 bg-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Wand2 className="h-5 w-5 text-cyan-300" /> Proposed changes for {proposals.action}
                </h2>
                <p className="mt-1 text-xs text-slate-400">Review each change. Uncheck anything you do not want to apply.</p>
              </div>
              <button type="button" onClick={() => setProposals(null)} className="rounded border border-white/15 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {proposals.warnings?.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg border border-amber-400/30 bg-amber-500/5 p-3 text-xs text-amber-100">
                {proposals.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 space-y-3">
              {proposals.proposals.map((proposal) => (
                <label key={proposal.id} className="block cursor-pointer rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={approved[proposal.id] ?? false}
                      disabled={proposal.section === "note"}
                      onChange={(event) => setApproved((previous) => ({ ...previous, [proposal.id]: event.target.checked }))}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {proposal.section} {proposal.section !== "note" ? `#${proposal.index}` : ""}
                    </span>
                    <span className="text-xs text-slate-500">confidence: {proposal.confidence}</span>
                    {proposal.fabricationRisk && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-red-200">
                        new numbers detected
                      </span>
                    )}
                  </div>
                  {proposal.rationale && <p className="mt-2 text-xs text-slate-400">{proposal.rationale}</p>}
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div className="rounded-lg border border-red-400/20 bg-red-500/5 p-2">
                      <p className="text-[10px] font-bold uppercase text-red-300">Before</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">{proposal.before || "(new content)"}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2">
                      <p className="text-[10px] font-bold uppercase text-emerald-300">After</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">{proposal.after}</p>
                    </div>
                  </div>
                </label>
              ))}
              {proposals.proposals.length === 0 && <p className="text-sm text-slate-400">No changes were proposed.</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setProposals(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm">
                Reject all
              </button>
              <button
                type="button"
                onClick={applyApproved}
                disabled={aiBusy === "apply" || !proposals.proposals.length}
                className="btn-glow flex items-center gap-2 px-4 py-2 text-sm font-bold disabled:opacity-50"
              >
                {aiBusy === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Apply approved changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

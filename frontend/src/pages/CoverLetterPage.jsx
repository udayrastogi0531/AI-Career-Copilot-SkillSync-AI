import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { Copy, Download, FileText, History, RefreshCw, Save } from "lucide-react";

const TONES = [
  { id: "professional", label: "Professional", hint: "Polished and formal" },
  { id: "concise", label: "Concise", hint: "Short and direct" },
  { id: "technical", label: "Technical", hint: "Engineering detail" },
  { id: "enthusiastic", label: "Enthusiastic", hint: "Energetic but credible" }
];

export default function CoverLetterPage() {
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionId, setJobDescriptionId] = useState("");
  const [extractedJob, setExtractedJob] = useState(null);
  const [parsingJob, setParsingJob] = useState(false);
  const [tone, setTone] = useState("professional");
  const [letter, setLetter] = useState("");
  const [letterId, setLetterId] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadHistory = async () => {
    try {
      const { data } = await api.get("/analysis/cover-letters?limit=20");
      setHistory(data.letters || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    api
      .get("/resumes")
      .then(({ data }) => {
        const list = data.resumes || [];
        setResumes(list);
        if (list[0]?._id) setResumeId(list[0]._id);
      })
      .catch(() => setError("Unable to load resumes"));
    loadHistory();
  }, []);

  const extractJob = async () => {
    if (!jobDescription.trim()) {
      setError("Paste the job description first.");
      return;
    }
    setParsingJob(true);
    setError("");
    try {
      const { data } = await api.post("/job/parse", { text: jobDescription, resumeId: resumeId || null, save: true });
      setExtractedJob(data.job);
      setJobDescriptionId(data.jobDescriptionId || "");
      toast.success("Job requirements extracted");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to parse that job description");
    } finally {
      setParsingJob(false);
    }
  };

  const generateLetter = async () => {
    if (!resumeId || (!jobDescription.trim() && !jobDescriptionId)) {
      setError("Select a resume and provide the job description first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = jobDescriptionId
        ? { resumeId, jobDescriptionId, tone }
        : { resumeId, jobDescription: jobDescription.trim(), tone };
      const { data } = await api.post("/analysis/generate-cover-letter", payload);
      const result = data.result;
      setLetter(result.letter);
      setLetterId(result.id);
      setWarnings(result.warnings || []);
      setHighlights(result.highlights || []);
      toast.success("Cover letter generated. Review it before sending.");
      await loadHistory();
    } catch (err) {
      const payload = err.response?.data || {};
      setError(
        payload.code && payload.code.startsWith("AI_")
          ? `${payload.message} (${payload.code})`
          : payload.message || "Unable to generate cover letter"
      );
    } finally {
      setLoading(false);
    }
  };

  const saveEdits = async () => {
    if (!letterId || !letter.trim()) {
      setError("Generate a letter first, then save your edits.");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/analysis/cover-letters/${letterId}`, { content: letter });
      toast.success("Edits saved to your cover letter history");
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save the edits");
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const exportPdf = async () => {
    if (!letter.trim()) {
      setError("No cover letter to export");
      return;
    }

    setExporting(true);
    try {
      const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const margin = 15;
      const maxWidth = pdf.internal.pageSize.getWidth() - 2 * margin;
      const lines = pdf.splitTextToSize(letter, maxWidth);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(40, 40, 40);

      let yPos = margin + 8;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const lineHeight = 5;

      lines.forEach((line) => {
        if (yPos + lineHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += lineHeight;
      });

      pdf.save("cover-letter.pdf");
      toast.success("Cover letter exported");
    } catch (err) {
      setError(`Unable to export PDF: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const wordCount = letter.split(/\s+/).filter(Boolean).length;

  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Document Generator</p>
            <h1 className="mt-2 text-4xl font-extrabold">Cover Letter</h1>
            <p className="mt-2 text-slate-300">
              Grounded in your real resume and the extracted job requirements. Warnings appear if the letter claims numbers your resume does not contain.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((value) => !value)}
            className="flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-xs font-bold uppercase tracking-wider"
          >
            <History className="h-4 w-4" /> History ({history.length})
          </button>
        </div>
      </motion.div>

      <ErrorBanner message={error} />

      {showHistory && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Saved cover letters</h2>
          {history.length === 0 && <p className="mt-2 text-sm text-slate-400">No cover letters saved yet.</p>}
          <ul className="mt-2 divide-y divide-white/5">
            {history.map((item) => (
              <li key={item._id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-200">
                    {[item.role, item.company].filter(Boolean).join(" at ") || "Untitled role"} · {item.tone}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLetter(item.content);
                      setLetterId(item._id);
                      setTone(item.tone || "professional");
                      setWarnings([]);
                    }}
                    className="rounded border border-white/15 px-3 py-1 text-xs"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(item.content);
                      toast.success("Copied");
                    }}
                    className="rounded border border-white/15 px-3 py-1 text-xs"
                  >
                    Copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05, duration: 0.4 }} className="premium-card space-y-4">
          <h2 className="text-xl font-bold text-cyan-200">Inputs</h2>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Resume</label>
            <select value={resumeId} onChange={(event) => setResumeId(event.target.value)} disabled={loading}>
              <option value="">Select a resume</option>
              {resumes.map((resume) => (
                <option key={resume._id} value={resume._id}>
                  {resume.title || "Untitled Resume"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Tone</label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTone(option.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    tone === option.id ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-100" : "border-white/15 text-slate-300"
                  }`}
                >
                  <span className="block font-bold">{option.label}</span>
                  <span className="text-[10px] text-slate-400">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Job description</label>
            <textarea
              rows={9}
              value={jobDescription}
              onChange={(event) => {
                setJobDescription(event.target.value);
                setJobDescriptionId("");
                setExtractedJob(null);
              }}
              placeholder="Paste the full job description..."
              disabled={loading}
            />
            <button
              type="button"
              onClick={extractJob}
              disabled={parsingJob || !jobDescription.trim()}
              className="mt-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {parsingJob ? "Extracting..." : "Extract requirements"}
            </button>
          </div>

          {extractedJob && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-xs text-slate-200">
              <p className="font-bold text-cyan-200">{extractedJob.title || "Title not detected"}</p>
              <p className="mt-1 text-slate-300">{extractedJob.company || "Company not detected"}</p>
              <p className="mt-1 text-slate-400">
                Required: {extractedJob.requiredSkills?.join(", ") || "none detected"}
              </p>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={generateLetter}
            disabled={loading || !resumeId}
            className="btn-glow flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? "Generating..." : "Generate cover letter"}
          </motion.button>
          <p className="text-[11px] text-slate-500">
            The generator may not invent employers, metrics, or experience. Anything it cannot verify from your resume is flagged below.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="premium-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-cyan-200">Your cover letter</h2>
            {letter && <span className="text-xs text-slate-400">{wordCount} words</span>}
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          )}

          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {highlights.map((highlight, index) => (
                <span key={index} className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100">
                  {highlight}
                </span>
              ))}
            </div>
          )}

          <textarea
            rows={16}
            value={letter}
            onChange={(event) => setLetter(event.target.value)}
            placeholder="Your generated cover letter will appear here, or write your own."
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyToClipboard}
              disabled={!letter.trim()}
              className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 disabled:opacity-40"
            >
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={saveEdits}
              disabled={saving || !letterId || !letter.trim()}
              className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-40"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save edits"}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting || !letter.trim()}
              className="flex items-center gap-2 rounded-lg border border-slate-500/40 bg-slate-800/50 px-3 py-2 text-sm font-semibold text-slate-300 disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export PDF"}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Every generated letter is stored in your history so you can compare drafts, and one account can never read another account's letters.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

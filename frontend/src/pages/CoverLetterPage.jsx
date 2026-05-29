import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { Download, Copy, FileText } from "lucide-react";

export default function CoverLetterPage() {
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [letter, setLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get("/resumes")
      .then(({ data }) => {
        const list = data.resumes || [];
        setResumes(list);
        if (list[0]?._id) {
          setResumeId(list[0]._id);
        }
      })
      .catch(() => setError("Unable to load resumes"));
  }, []);

  const generateLetter = async () => {
    if (!resumeId || !jobDescription.trim()) {
      setError("Please select resume and add job description");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/analysis/generate-cover-letter", {
        resumeId,
        jobDescription: jobDescription.trim()
      });
      setLetter(data?.result?.letter || "No response generated");
      toast.success("Cover letter generated successfully!");
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Unable to generate cover letter";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    toast.success("Copied to clipboard!");
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
      toast.success("Cover letter exported as PDF!");
    } catch (err) {
      setError("Unable to export PDF: " + err.message);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Document Generator</p>
            <h1 className="mt-2 text-4xl font-extrabold">AI Cover Letter</h1>
            <p className="mt-2 text-slate-300">Generate tailored, professional cover letters in seconds</p>
          </div>
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
            <FileText className="h-8 w-8 text-cyan-300" />
          </div>
        </div>
      </motion.div>

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.45 }}
          className="premium-card space-y-4"
        >
          <h2 className="text-xl font-bold text-cyan-200">Generate Letter</h2>

          {/* Resume Selector */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Select Resume</label>
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25 disabled:opacity-50"
            >
              <option value="">Select a resume</option>
              {resumes.map((resume) => (
                <option key={resume._id} value={resume._id}>
                  {resume.title || resume.firstName ? `${resume.firstName} ${resume.lastName}` : "Untitled Resume"}
                </option>
              ))}
            </select>
          </div>

          {/* Job Description */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Job Description / Details</label>
            <textarea
              rows={10}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the complete job description here..."
              disabled={loading}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25 resize-none disabled:opacity-50"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={generateLetter}
            disabled={loading || !resumeId || !jobDescription.trim()}
            className="btn-glow w-full disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Cover Letter"}
          </motion.button>
        </motion.div>

        {/* Output Section */}
        {letter && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
            className="premium-card flex flex-col gap-4"
          >
            <h2 className="text-xl font-bold text-cyan-200">Your Cover Letter</h2>

            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={copyToClipboard}
                className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/30"
              >
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportPdf}
                disabled={exporting || !letter.trim()}
                className="flex items-center gap-2 rounded-lg border border-slate-500/40 bg-slate-800/50 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting..." : "Export PDF"}
              </motion.button>
            </div>

            <textarea
              rows={15}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
              placeholder="Your generated cover letter will appear here..."
              className="w-full flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/25 resize-none"
            />

            <p className="text-xs text-slate-400">💡 Edit freely. Your changes are saved locally until you export.</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

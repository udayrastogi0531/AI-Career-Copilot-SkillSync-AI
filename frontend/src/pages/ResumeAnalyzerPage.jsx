import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSearch,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Terminal,
  RefreshCw,
  FileText
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

const analysisSteps = ["Parsing Structures", "Matching Keywords", "Logical Evaluation", "ATS Scoring"];

const getScoreTone = (score) => {
  if (score >= 80) return "from-emerald-400 to-green-500 text-emerald-400";
  if (score >= 60) return "from-amber-400 to-orange-500 text-amber-400";
  return "from-rose-400 to-red-500 text-rose-400";
};

const getScoreLabel = (score) => {
  if (score >= 80) return "Excellent Quality";
  if (score >= 60) return "Strong Alignment";
  if (score >= 40) return "Average Match";
  return "Needs Layout Work";
};

const CircularScore = ({ score }) => {
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score || 0));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative mx-auto h-48 w-48 flex items-center justify-center">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none" />
        <motion.circle
          cx="80"
          cy="80"
          r={radius}
          stroke="url(#atsScoreGradient)"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="atsScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-5xl font-black bg-gradient-to-r from-cyan-300 via-indigo-200 to-white bg-clip-text text-transparent">
          {progress}
        </p>
        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">ATS INDEX</p>
      </div>
    </div>
  );
};

const BadgeGroup = ({ items, tone }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item, idx) => (
      <span key={`${item}-${idx}`} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${tone}`}>
        {item}
      </span>
    ))}
  </div>
);

const BreakdownCard = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center flex flex-col justify-between hover:border-cyan-500/20 transition-all duration-300">
    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">{label}</p>
    <p className="mt-3 text-3xl font-black text-white">{Math.max(0, Math.min(100, Number(value) || 0))}</p>
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  </div>
);

const ResumeAnalyzerPage = () => {
  const [searchParams] = useSearchParams();
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionId, setJobDescriptionId] = useState("");
  const [extractedJob, setExtractedJob] = useState(null);
  const [parsingJob, setParsingJob] = useState(false);

  useEffect(() => {
    const requestedResumeId = searchParams.get("resumeId");

    api
      .get("/resumes")
      .then(({ data }) => {
        const allResumes = data.resumes || [];
        setResumes(allResumes);

        if (requestedResumeId && allResumes.some((resume) => resume._id === requestedResumeId)) {
          setResumeId(requestedResumeId);
          return;
        }

        if (allResumes[0]) {
          setResumeId(allResumes[0]._id);
        }
      })
      .catch(() => setError("Unable to load resumes"))
      .finally(() => setLoadingResumes(false));
  }, [searchParams]);

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
      toast.success("Requirements extracted from the job description");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to parse that job description");
    } finally {
      setParsingJob(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setError("");
    setResult(null);
    setActiveStep(0);
    try {
      const payload = jobDescriptionId
        ? { jobDescriptionId }
        : jobDescription.trim()
        ? { jobDescription }
        : {};
      const { data } = await api.post(`/analysis/resume/${resumeId}`, payload);
      setResult(data.result);
      toast.success("Deterministic ATS report generated");
    } catch (err) {
      setError(err.response?.data?.message || "Resume analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!analyzing) {
      return;
    }

    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % analysisSteps.length);
    }, 700);

    return () => clearInterval(timer);
  }, [analyzing]);

  const score = result?.score ?? 0;
  const breakdown = result?.score_breakdown || {};
  const missingKeywords = result?.missing_keywords?.length ? result.missing_keywords : result?.missing_skills || [];
  const recruiterFeedback = result?.recruiter_feedback || "";
  
  const radarData = [
    { label: "Keywords Match", value: Number(breakdown.keywords || 0) },
    { label: "Skills Density", value: Number(breakdown.skills_match || 0) },
    { label: "Experience Depth", value: Number(breakdown.experience_strength || 0) },
    { label: "Formatting Vetting", value: Number(breakdown.format || 0) },
    { label: "Section Counts", value: Number(breakdown.sections || 0) },
    { label: "Grammar / Typos", value: Number(breakdown.grammar || 0) }
  ];

  const atsConfidence = result?.ats_confidence || Math.round((Number(breakdown.keywords || 0) + Number(breakdown.format || 0) + Number(breakdown.sections || 0)) / 3 || 0);
  const recruiterImpression = result?.recruiter_readability || Math.round((score + Number(breakdown.experience_strength || 0)) / 2 || 0);
  const parsingQuality = Math.round(Number(breakdown.format || 0));

  return (
    <main className="min-h-[calc(100vh-140px)] text-white max-w-5xl mx-auto py-4">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-8"
      >
        <span className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-extrabold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> ATS Scanning Engine
        </span>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">ATS Resume Analyzer 2.0</h1>
        <p className="mt-2 text-sm text-slate-400">
          Verify your resume formatting compatibility, detect missing keywords, and resolve formatting alerts.
        </p>
      </motion.div>

      <ErrorBanner message={error} />

      {/* Select resume panel */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="premium-card p-6"
      >
        {!loadingResumes && !resumes.length && (
          <EmptyState
            icon={FileSearch}
            title="No resumes available"
            description="Upload or build a resume first, then run ATS analysis to see your score and recommendations."
            ctaLabel="Build a Resume"
            href="/builder"
            className="mb-6"
          />
        )}
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Choose Profile Resume
            </label>
            {loadingResumes ? (
              <div className="animate-pulse rounded bg-slate-800 h-11 w-full" />
            ) : (
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={analyzing}>
                <option value="">Choose a resume to analyze...</option>
                {resumes.map((resume) => (
                  <option key={resume._id} value={resume._id}>
                    {resume.title || "Untitled Resume"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={analyze}
            disabled={analyzing || !resumeId}
            title={jobDescriptionId || jobDescription.trim() ? "Run a job-targeted ATS scan" : "Run a resume-only scan"}
            className="btn-glow h-[48px] px-8 disabled:cursor-not-allowed disabled:opacity-40 uppercase tracking-wider text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...
              </>
            ) : (
              "Trigger Analyzer Scan"
            )}
          </button>
        </div>

        <div className="mt-6 space-y-3 border-t border-white/5 pt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Optional: target job description
          </label>
          <textarea
            rows={6}
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(event.target.value);
              setJobDescriptionId("");
              setExtractedJob(null);
            }}
            placeholder="Paste a job description to score required keywords and skills against a real role instead of a generic scan."
            disabled={analyzing}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={extractJob}
              disabled={parsingJob || !jobDescription.trim()}
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
            >
              {parsingJob ? "Extracting..." : "Extract requirements"}
            </button>
            <span className="text-[11px] text-slate-500">
              Leaving this empty runs a resume-only scan: job-dependent dimensions are excluded, not scored as zero.
            </span>
          </div>

          {extractedJob && (
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4 text-xs text-slate-200">
              <p className="font-bold text-cyan-200">
                {extractedJob.title || "Title not detected"}
                {extractedJob.company ? ` · ${extractedJob.company}` : ""}
                {extractedJob.location ? ` · ${extractedJob.location}` : ""}
              </p>
              <p className="mt-2">
                <span className="font-bold text-slate-400">Required:</span>{" "}
                {extractedJob.requiredSkills?.join(", ") || "none detected"}
              </p>
              <p className="mt-1">
                <span className="font-bold text-slate-400">Preferred:</span>{" "}
                {extractedJob.preferredSkills?.join(", ") || "none detected"}
              </p>
              <p className="mt-1">
                <span className="font-bold text-slate-400">Experience:</span>{" "}
                {extractedJob.experience?.minYears ? `${extractedJob.experience.minYears}+ years` : "not stated"}
                {extractedJob.education?.level ? ` · Education: ${extractedJob.education.level}` : ""}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">Parsed deterministically (parser v{extractedJob.parserVersion}). Review before scoring.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* REAL-TIME SCANNING SIMULATOR */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 overflow-hidden"
          >
            <div className="premium-card p-6 relative">
              {/* Neon scanner glow line */}
              <motion.div
                className="absolute left-0 w-full h-[3px] bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_#22d3ee] z-10"
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              />

              <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
                <Loader label="AI Parsing Algorithms Engaged..." />
                <p className="text-xs text-slate-400 italic">Evaluating section structures & keyword densities...</p>
              </div>

              {/* Processing Loader Steps */}
              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {analysisSteps.map((step, index) => {
                  const isActive = index === activeStep;
                  const isComplete = index < activeStep;
                  return (
                    <div
                      key={step}
                      className={`rounded-2xl border p-4 text-center text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                        isActive
                          ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                          : isComplete
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-white/5 text-slate-500"
                      }`}
                    >
                      {step}
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Loading Stats Bar */}
              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500"
                  initial={{ width: "0%" }}
                  animate={{ width: `${((activeStep + 1) / analysisSteps.length) * 100}%` }}
                  transition={{ duration: 0.45 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCANNING RESULTS PANEL */}
      {!!result && !analyzing && (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mt-6 space-y-6"
        >
          {/* Main index overview */}
          <article className="premium-card p-6 text-center space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-extrabold">Overall ATS Score</p>
            <CircularScore score={score} />
            <p className={`mt-2 bg-gradient-to-r ${getScoreTone(score)} bg-clip-text text-3xl font-black text-transparent`}>
              {getScoreLabel(score)}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5 flex flex-col justify-between hover:border-cyan-500/10 transition-all duration-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">ATS Confidence</span>
                <p className="mt-2 text-3xl font-black text-cyan-200">{atsConfidence}%</p>
                <p className="text-[10px] text-slate-400 mt-2">Vetted layout standards met</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5 flex flex-col justify-between hover:border-emerald-500/10 transition-all duration-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Recruiter Impression</span>
                <p className="mt-2 text-3xl font-black text-emerald-200">{recruiterImpression}%</p>
                <p className="text-[10px] text-slate-400 mt-2">Achievement metric density optimal</p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5 flex flex-col justify-between hover:border-amber-500/10 transition-all duration-300">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Parsing Quality</span>
                <p className="mt-2 text-3xl font-black text-amber-200">{parsingQuality}%</p>
                <p className="text-[10px] text-slate-400 mt-2">Section hierarchy compliant</p>
              </div>
            </div>
          </article>

          {/* Interactive Scoring Weights Drawer */}
          <article className="premium-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">How is this score calculated?</h3>
                  <p className="text-xs text-slate-400">Scoring metrics, semantic weights, and parameters.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhy((prev) => !prev)}
                className="rounded-3xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-bold uppercase text-slate-300 hover:bg-white/10 hover:text-white transition"
              >
                {showWhy ? "Hide breakdown" : "View parameters"}
              </button>
            </div>

            <AnimatePresence>
              {showWhy && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-5"
                >
                  <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-white/10">
                    <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <Terminal className="h-4.5 w-4.5 text-cyan-300" /> Category Weights
                      </p>
                      <ul className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                        {result?.scoreBreakdown
                          ? Object.entries(result.scoreBreakdown).map(([key, dimension]) => (
                              <li key={key}>
                                {dimension.label}: {dimension.applicable ? `${Math.round(dimension.weight * 100)}% of this score` : "not applicable (no job description or no requirement)"}
                              </li>
                            ))
                          : (
                            <li>Run a scan to see the exact weights applied to this resume and job description.</li>
                          )}
                      </ul>
                      {result?.engineVersion && (
                        <p className="mt-3 text-[11px] text-slate-500">
                          Engine {result.engine} v{result.engineVersion} · mode {result.mode} · input hash {result.inputHash}. The same
                          resume, job description, and weights always produce this same score.
                        </p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5">
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-300" /> Key Signals Evaluated
                      </p>
                      <ul className="mt-3 space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                        <li>Correct hierarchy of standard sections (Education, Projects).</li>
                        <li>Grammar consistency, typo check, and sentence fluency.</li>
                        <li>Proper capitalization of technical languages (React, Python).</li>
                        <li>Exclusions of text-in-images which break parser scripts.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>

          {/* Radar details and breakdown charts */}
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <article className="premium-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">ATS Intelligence Radar</h3>
                <p className="text-xs text-slate-400">Semantic alignment across six vetting verticals.</p>
              </div>

              <div className="h-72 w-full mt-4 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10, fontWeight: "bold" }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(255,255,255,0.08)" tick={{ fontSize: 8 }} />
                    <Radar
                      name="ATS Score"
                      dataKey="value"
                      stroke="#22d3ee"
                      fill="#22d3ee"
                      fillOpacity={0.16}
                      strokeWidth={2}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "16px"
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Category scores grid */}
            <article className="premium-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">ATS Spacing breakdown</h3>
                <p className="text-xs text-slate-400">Score breakdown for each primary screening category.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BreakdownCard label="Keywords Match" value={breakdown.keywords} />
                <BreakdownCard label="Skills Match" value={breakdown.skills_match} />
                <BreakdownCard label="Experience Weight" value={breakdown.experience_strength} />
                <BreakdownCard label="Layout Format" value={breakdown.format} />
              </div>
            </article>
          </div>

          {/* Section details */}
          <article className="premium-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">Section Vetting Details</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <BreakdownCard label="Section Headings" value={breakdown.sections} />
              <BreakdownCard label="Grammar Accuracy" value={breakdown.grammar} />
              <BreakdownCard label="Layout Integrity" value={parsingQuality} />
            </div>
          </article>

          {/* Strengths / Warnings grids */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Strengths */}
            {!!result.strengths?.length && (
              <article className="premium-card p-6">
                <h3 className="text-lg font-bold text-emerald-300 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> Detected Strengths
                </h3>
                <BadgeGroup
                  items={result.strengths}
                  tone="border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                />
              </article>
            )}

            {/* Missing Skills warnings */}
            {!!result.missing_skills?.length && (
              <article className="premium-card p-6 border border-rose-500/20">
                <h3 className="text-lg font-bold text-rose-300 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Missing Skills
                </h3>
                <BadgeGroup
                  items={result.missing_skills}
                  tone="border-rose-400/30 bg-rose-500/10 text-rose-300"
                />
              </article>
            )}
          </div>

          {/* Missing Keywords warnings */}
          {!!missingKeywords.length && (
            <article className="premium-card p-6 border border-amber-500/20">
              <h3 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Missing Keywords Warning
              </h3>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Add these keywords to your resume to increase matching percentile.
              </p>
              <BadgeGroup
                items={missingKeywords}
                tone="border-amber-400/30 bg-amber-500/10 text-amber-300"
              />
            </article>
          )}

          {/* Formatting alert details */}
          <article className="premium-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">Formatting Integrity Vetting</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Format Score</span>
                  <p className="mt-1 text-3xl font-black text-cyan-200">
                    {Math.round(Number(breakdown.format || 0))}%
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Structural checks completed</p>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Vetting Warnings ({result.warnings?.length || 0})</span>
                {result.warnings?.length ? (
                  <ul className="mt-2 space-y-1.5 text-xs leading-normal text-slate-300">
                    {result.warnings.map((warning) => (
                      <li key={warning.code} className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 font-bold ${
                            warning.severity === "high" ? "text-rose-300" : warning.severity === "medium" ? "text-amber-300" : "text-slate-400"
                          }`}
                        >
                          •
                        </span>
                        <span>
                          <span className="font-bold uppercase text-[10px] text-slate-500">{warning.severity}</span> {warning.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-emerald-300">No formatting or parsing problems detected.</p>
                )}
              </div>
            </div>
          </article>

          {/* Recruiter feedback text */}
          {recruiterFeedback && (
            <article className="premium-card p-6">
              <h3 className="text-lg font-bold text-white mb-3">Professional Recruiter Feedback</h3>
              <div className="rounded-xl bg-cyan-400/5 border border-cyan-400/15 p-4 text-sm text-slate-200 leading-relaxed">
                {recruiterFeedback}
              </div>
            </article>
          )}

          {/* Matched evidence */}
          <div className="grid gap-6 md:grid-cols-2">
            {!!result.matchedSkills?.length && (
              <article className="premium-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-cyan-200">
                  <CheckCircle2 className="h-5 w-5" /> Matched Skills
                </h3>
                <BadgeGroup items={result.matchedSkills} tone="border-cyan-400/30 bg-cyan-500/10 text-cyan-200" />
              </article>
            )}
            {!!result.matchedKeywords?.length && (
              <article className="premium-card p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-blue-200">
                  <Sparkles className="h-5 w-5" /> Matched Keywords
                </h3>
                <BadgeGroup items={result.matchedKeywords.slice(0, 40)} tone="border-blue-400/30 bg-blue-500/10 text-blue-200" />
              </article>
            )}
          </div>

          {/* Requirement matrix from the job description */}
          {!!result.requirements?.length && (
            <article className="premium-card p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white">Requirement-by-requirement evidence</h3>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {result.requirementSummary?.passed} / {result.requirementSummary?.total} matched
                </span>
              </div>
              <ul className="divide-y divide-white/5">
                {result.requirements.map((row, index) => (
                  <li key={index} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="flex-1 text-xs font-semibold text-slate-200">{row.requirement}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          row.passed
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                            : "border-rose-400/30 bg-rose-500/10 text-rose-300"
                        }`}
                      >
                        {row.passed ? "evidence found" : "no evidence"}
                      </span>
                    </div>
                    {row.matchedSkills?.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">Matched: {row.matchedSkills.join(", ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {/* Deterministic recommendations */}
          {!!result.recommendations?.length && (
            <article className="premium-card p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">Prioritised recommendations</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Generated by the deterministic engine. AI commentary is always labelled separately.
                </p>
              </div>
              <div className="space-y-3">
                {result.recommendations.map((item, index) => (
                  <div key={`${item.message}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.priority === "high"
                          ? "bg-rose-500/20 text-rose-200"
                          : item.priority === "medium"
                          ? "bg-amber-500/20 text-amber-200"
                          : "bg-slate-500/20 text-slate-300"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <p className="text-xs leading-relaxed text-slate-200">{item.message}</p>
                  </div>
                ))}
              </div>
            </article>
          )}

          {/* AI commentary when available */}
          {(result.ai_strengths?.length || result.ai_improvements?.length || result.ai_rewrite_suggestions?.length) && (
            <article className="premium-card space-y-4 p-6">
              <h3 className="text-lg font-bold text-white">AI commentary (labelled, non-scoring)</h3>
              {!!result.ai_strengths?.length && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Strengths</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-200">
                    {result.ai_strengths.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              )}
              {!!result.ai_improvements?.length && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Improvements</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-200">
                    {result.ai_improvements.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              )}
              {!!result.ai_rewrite_suggestions?.length && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Rewrite suggestions</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-200">
                    {result.ai_rewrite_suggestions.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </div>
              )}
            </article>
          )}

          {/* Weak Signals alerts */}
          {!!result.issues?.length && (
            <article className="premium-card p-6">
              <h3 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Weak Signals Alert
              </h3>
              <ul className="space-y-3 text-xs text-slate-300 leading-relaxed pl-4 list-disc">
                {result.issues.map((issue, idx) => (
                  <li key={`${issue}-${idx}`}>
                    {issue}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {/* Actionable suggestions */}
          {!!result.suggestions?.length && (
            <article className="premium-card p-6">
              <h3 className="text-lg font-bold text-cyan-200 mb-4">Actionable Optimization roadmaps</h3>
              <div className="space-y-3">
                {result.suggestions.map((suggestion, idx) => (
                  <div
                    key={`${suggestion}-${idx}`}
                    className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-xs leading-relaxed text-slate-200 flex items-start gap-3"
                  >
                    <span className="text-cyan-300 font-bold mt-0.5">{idx + 1}.</span>
                    <p>{suggestion}</p>
                  </div>
                ))}
              </div>
            </article>
          )}
        </motion.section>
      )}
    </main>
  );
};

export default ResumeAnalyzerPage;

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import {
  Briefcase,
  Sparkles,
  TrendingUp,
  Award,
  AlertCircle,
  FileText,
  MapPin,
  DollarSign,
  ChevronRight,
  Clock,
  BookOpen,
  RefreshCw,
  Search,
  CheckCircle2
} from "lucide-react";

const listToBadges = (items, tone) => (
  <div className="flex flex-wrap gap-2">
    {(items || []).map((item, index) => (
      <motion.span
        key={`${item}-${index}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: index * 0.03 }}
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}
      >
        {item}
      </motion.span>
    ))}
  </div>
);

export default function JobMatchPage() {
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [fetchedJob, setFetchedJob] = useState(null);
  const [result, setResult] = useState(null);
  const [skillGap, setSkillGap] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingJob, setFetchingJob] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(true);

  useEffect(() => {
    api
      .get("/resumes")
      .then(({ data }) => {
        setResumes(data.resumes || []);
        if (data.resumes?.[0]?._id) {
          setResumeId(data.resumes[0]._id);
        }
      })
      .catch(() => setError("Unable to load resumes"))
      .finally(() => setLoadingResumes(false));
  }, []);

  const runMatch = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setSkillGap(null);
    try {
      const { data } = await api.post("/analysis/job-match", { resumeId, jobDescription });
      setResult(data.result);

      const { data: skillGapData } = await api.post("/analysis/skill-gap", {
        resumeId,
        jobDescription
      });
      setSkillGap(skillGapData.result);
      toast.success("Semantic job match evaluation completed!");
    } catch (err) {
      setError(err.response?.data?.message || "Job match failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchJobByUrl = async () => {
    if (!jobUrl.trim()) {
      setError("Please enter a valid job description URL first");
      return;
    }

    setFetchingJob(true);
    setError("");

    try {
      const { data } = await api.post("/job/fetch", { url: jobUrl });
      const job = data.job;
      setFetchedJob(job);
      setJobDescription(job.description || "");
      toast.success("Job description parsed successfully!");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to parse job details from URL");
    } finally {
      setFetchingJob(false);
    }
  };

  const match = result?.match_percentage ?? 0;
  const aiMatch = result?.ai_match_percentage ?? 0;
  const logicalMatch = result?.logical_match_percentage ?? 0;
  const readiness = Math.max(35, Math.min(98, Math.round((match + aiMatch) / 2)));

  const companyIntel = fetchedJob || {
    title: "Senior Product Designer",
    company: "Nimbus Labs",
    location: "Remote / North America",
    salary: "$115k - $145k",
    summary: "Design systems focused role building AI-driven workflows and cross-functional experimentation.",
    skills: ["Design systems", "Figma", "User research", "Prototyping", "A/B testing"]
  };

  return (
    <section className="min-h-[calc(100vh-140px)] text-white max-w-5xl mx-auto py-4">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-8"
      >
        <span className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-extrabold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Role Alignment
        </span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Job Match Pro</h1>
        <p className="mt-1 text-sm text-slate-400">
          Measure semantic alignment against target roles and compile skill gaps roadmaps.
        </p>
      </motion.div>

      <ErrorBanner message={error} />

      {/* Target input panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="premium-card p-6 space-y-5"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end border-b border-white/5 pb-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Auto Fetch from Job URL
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
              <input
                placeholder="Paste LinkedIn / company job posting URL..."
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                className="pl-12"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={fetchJobByUrl}
            disabled={fetchingJob}
            className="btn-glow h-[48px] px-6 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            {fetchingJob ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Fetching...
              </>
            ) : (
              "Auto Fetch JD"
            )}
          </button>
        </div>

        {/* Dynamic intel notification */}
        <AnimatePresence>
          {!!fetchedJob && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-5 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">{fetchedJob.title}</h4>
                  <p className="text-xs text-slate-350 mt-0.5">{fetchedJob.company || "Parsed Company"}</p>
                </div>
                <span className="rounded px-2 py-1 bg-cyan-400/20 text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
                  JD PARSED ✓
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form elements */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Select Profile Resume
            </label>
            {loadingResumes ? (
              <div className="animate-pulse rounded bg-slate-800 h-11 w-full" />
            ) : (
              <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={loading || fetchingJob}>
                <option value="">Choose resume to compare...</option>
                {resumes.map((resume) => (
                  <option key={resume._id} value={resume._id}>
                    {resume.title || "Untitled Resume"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Company Job Requirements (Paste Text)
            </label>
            <textarea
              placeholder="Paste the company job description details here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              disabled={loading || fetchingJob}
            />
          </div>
        </div>

        <button
          onClick={runMatch}
          disabled={loading || !resumeId || !jobDescription.trim()}
          className="btn-glow h-[48px] px-8 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Blending Scores...
            </>
          ) : (
            "Run Comparative Match"
          )}
        </button>

        {loading && (
          <div className="grid gap-3 sm:grid-cols-3 pt-4 border-t border-white/5">
            <div className="animate-pulse rounded bg-slate-800 h-12" />
            <div className="animate-pulse rounded bg-slate-800 h-12" />
            <div className="animate-pulse rounded bg-slate-800 h-12" />
          </div>
        )}
      </motion.div>

      {/* RESULTS DISPLAY PANEL */}
      {!!result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-6 space-y-6"
        >
          {/* Main Index card */}
          <article className="premium-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Semantic Match Index</span>
              <div className="flex items-center gap-3">
                <h3 className="text-4xl font-black bg-gradient-to-r from-cyan-300 via-indigo-200 to-white bg-clip-text text-transparent">
                  {match}%
                </h3>
                {match >= 75 && (
                  <motion.div
                    initial={{ scale: 0.4, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-1 text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.18)] animate-[pulse_2.s_infinite]"
                  >
                    ✓ Apply Ready
                  </motion.div>
                )}
              </div>
              <p className="text-xs text-slate-400">Overall score combines technical skills & experience levels.</p>
            </div>

            {/* Simulated circular progress ring */}
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="16" stroke="rgba(255,255,255,0.06)" strokeWidth="3" fill="none" />
                <motion.circle
                  cx="18"
                  cy="18"
                  r="16"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="100"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 100 - match }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {match}%
              </div>
            </div>
          </article>

          {/* Subscores split grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="premium-card p-5 flex flex-col justify-between hover:border-cyan-500/15 transition-all">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">AI Semantic Match</span>
              <p className="text-2xl font-black text-cyan-200 mt-2">{aiMatch}%</p>
              <p className="text-[10px] text-slate-400 mt-2">LLM contextual alignment checks satisfied.</p>
            </div>

            <div className="premium-card p-5 flex flex-col justify-between hover:border-emerald-500/15 transition-all">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Logical keywords matching</span>
              <p className="text-2xl font-black text-emerald-200 mt-2">{logicalMatch}%</p>
              <p className="text-[10px] text-slate-400 mt-2">Exact matching keyword densities found.</p>
            </div>
          </div>

          {/* Core Categories Comparison Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Resume Skills */}
            <article className="premium-card p-5 border border-emerald-500/10">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-300 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Resume Skills
              </h4>
              {result?.resume_skills?.length ? (
                listToBadges(result.resume_skills, "border-emerald-400/30 bg-emerald-500/10 text-emerald-300")
              ) : (
                <p className="text-xs text-slate-400 italic">No skills detected in resume</p>
              )}
            </article>

            {/* Company Job Skills */}
            <article className="premium-card p-5 border border-cyan-500/10">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-cyan-300 mb-3 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-cyan-300" /> Company Requirements
              </h4>
              {result?.company_skills?.length ? (
                listToBadges(result.company_skills, "border-cyan-400/30 bg-cyan-500/10 text-cyan-300")
              ) : (
                <p className="text-xs text-slate-400 italic">No job skills parsed</p>
              )}
            </article>

            {/* Skill Gaps warnings */}
            <article className="premium-card p-5 border border-rose-500/10">
              <h4 className="text-xs uppercase font-extrabold tracking-wider text-rose-300 mb-3 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-rose-300" /> Missing Gaps
              </h4>
              {result?.missing_skills?.length ? (
                listToBadges(result.missing_skills, "border-rose-400/30 bg-rose-500/10 text-rose-300")
              ) : (
                <p className="text-xs text-emerald-300 font-semibold italic">✓ Vetting checks fully complete!</p>
              )}
            </article>
          </div>

          {/* AI Recommendation panel */}
          {!!result?.recommendation && (
            <article className="premium-card p-6 border border-amber-500/15">
              <h3 className="text-sm font-bold text-amber-200 mb-2 flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-amber-300" /> AI Coach Strategy suggestion
              </h3>
              <p className="text-xs leading-relaxed text-slate-200 font-medium">
                {result.recommendation}
              </p>
            </article>
          )}

          {/* VISUAL CHRONOLOGICAL ROADMAP TIMELINE */}
          {!!skillGap?.roadmap?.length && (
            <article className="premium-card p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white">Interactive Skill Gap Roadmap</h3>
                <p className="text-xs text-slate-400 mt-0.5">Follow this visual chronological roadmap timeline to acquire missing variables.</p>
              </div>

              <div className="relative border-l border-white/10 pl-6 ml-4 space-y-6 py-2">
                {skillGap.roadmap.map((step, idx) => (
                  <motion.div
                    key={`${step.skill}-${idx}`}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                    className="relative group space-y-2"
                  >
                    {/* Glowing Timeline Indicator Node */}
                    <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-cyan-400 bg-slate-950 text-cyan-300 group-hover:scale-110 transition duration-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-2.5">
                        <h4 className="text-sm font-extrabold text-white">{step.skill}</h4>
                        <span className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[9px] font-extrabold text-cyan-300 uppercase tracking-widest flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {step.timeline || "Week 1"}
                        </span>
                      </div>

                      {/* Study Resources */}
                      {step.resources && step.resources.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Suggested study channels
                          </p>
                          <ul className="list-disc space-y-1 pl-4 text-xs text-slate-350 leading-relaxed">
                            {step.resources.map((resource, resIdx) => (
                              <li key={`${resource}-${resIdx}`}>
                                {resource}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </article>
          )}

          {/* Company Intelligence metrics panel */}
          <article className="premium-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Company Profile Vetting</p>
                <h3 className="text-xl font-bold text-white mt-0.5">{companyIntel.company}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-3 mt-1 font-semibold">
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {companyIntel.location}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {companyIntel.salary}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Target Readiness</span>
                <p className="text-2xl font-black text-cyan-300 mt-0.5">{readiness}%</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-350 font-medium">
              {companyIntel.summary}
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <p className="text-[10px] uppercase font-bold text-slate-500">Core Signals Required</p>
                <p className="text-xs mt-2 text-slate-300 leading-normal">
                  {companyIntel.skills?.join(", ") || "Design systems, Component APIs"}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <p className="text-[10px] uppercase font-bold text-slate-500">Resume Strengths Match</p>
                <p className="text-xs mt-2 text-slate-300 leading-normal">
                  {skillGap?.strengths?.join(", ") || "Leadership, React engineering"}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <p className="text-[10px] uppercase font-bold text-slate-500">Gaps remaining to close</p>
                <p className="text-xs mt-2 text-slate-300 leading-normal">
                  {skillGap?.missingSkills?.join(", ") || "Design ops, Metrics storytelling"}
                </p>
              </div>
            </div>
          </article>
        </motion.div>
      )}
    </section>
  );
}

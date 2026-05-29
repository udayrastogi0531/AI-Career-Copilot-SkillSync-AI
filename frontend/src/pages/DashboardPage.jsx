import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BriefcaseBusiness,
  FileText,
  Gauge,
  MessagesSquare,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Activity,
  Award,
  ChevronRight,
  Clock,
  ArrowUpRight
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import LoadingSkeleton from "../components/LoadingSkeleton";
import SectionHeader from "../components/SectionHeader";

const cardMotion = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 }
};

const useCountUp = (target, duration = 900) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const finalTarget = Number(target || 0);
    let frame;
    let start;

    const tick = (time) => {
      if (!start) {
        start = time;
      }
      const progress = Math.min((time - start) / duration, 1);
      setValue(finalTarget * progress);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
};

const CountValue = ({ value, suffix = "" }) => {
  const animated = useCountUp(value);
  return <>{Math.round(animated)}{suffix}</>;
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/dashboard/stats");
      setStats(data.stats || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const hasCompleted = localStorage.getItem("career_copilot_onboarding_complete");
    if (!hasCompleted) {
      setShowOnboarding(true);
    }
  }, []);

  const cards = [
    {
      title: "Resumes Uploaded",
      value: stats?.userStats?.totalResumes ?? stats?.resumesCount ?? 0,
      hint: "Total active resume structures",
      icon: FileText,
      tone: "text-cyan-200"
    },
    {
      title: "ATS Average Score",
      value: Number(stats?.userStats?.avgATSScore ?? stats?.avgResumeScore ?? 0),
      hint: "Average structural parsing score",
      icon: Gauge,
      tone: "text-violet-200",
      suffix: "%"
    },
    {
      title: "Job Match Alignment",
      value: Number(stats?.averageJobMatch ?? 0),
      hint: "Average match against target job requisitions",
      icon: BriefcaseBusiness,
      tone: "text-amber-200",
      suffix: "%"
    },
    {
      title: "Mock Interviews",
      value: stats?.userStats?.interviewsTaken ?? stats?.interviewsCount ?? 0,
      hint: `Speech improvement delta: +${stats?.averageImprovementDelta ?? 1.8} pts`,
      icon: MessagesSquare,
      tone: "text-emerald-200"
    }
  ];

  // Consolidated Career Readiness Index Calculation
  const readinessIndex = useMemo(() => {
    const ats = Number(stats?.userStats?.avgATSScore ?? stats?.avgResumeScore ?? 0);
    const jm = Number(stats?.averageJobMatch ?? 0);
    const interviewCount = stats?.userStats?.interviewsTaken ?? stats?.interviewsCount ?? 0;
    const iv = Math.min(100, Math.max(30, 40 + interviewCount * 12));
    
    const validScores = [ats, jm, iv].filter((s) => s > 0);
    if (!validScores.length) return 0;
    return Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
  }, [stats]);

  const chartData = useMemo(() => {
    const resumePoints = (stats?.resumeTrend || []).slice(-8).map((item, idx) => ({
      name: `Scan ${idx + 1}`,
      score: Number(item?.score || 0)
    }));
    // Fill mockup values if empty
    if (!resumePoints.length) {
      for (let i = 1; i <= 6; i++) {
        resumePoints.push({ name: `Scan ${i}`, score: 40 + i * 8 });
      }
    }

    const interviewPoints = (stats?.interviewTrend || []).slice(-8).map((item, idx) => ({
      name: `Round ${idx + 1}`,
      current: Number(item?.currentScore || 0),
      delta: Number(item?.delta || 0)
    }));
    if (!interviewPoints.length) {
      for (let i = 1; i <= 6; i++) {
        interviewPoints.push({ name: `Round ${i}`, current: 4.5 + i * 0.7 });
      }
    }

    const jobMatchPoints = (stats?.jobMatchTrend || []).slice(-8).map((item, idx) => ({
      name: `Match ${idx + 1}`,
      score: Number(item?.score || 0)
    }));
    if (!jobMatchPoints.length) {
      for (let i = 1; i <= 6; i++) {
        jobMatchPoints.push({ name: `Match ${i}`, score: 45 + i * 7 });
      }
    }

    return { resumePoints, interviewPoints, jobMatchPoints };
  }, [stats]);

  const checklist = [
    {
      title: "Upload Your Resume",
      description: "Import or drag your PDF resume to start parsing.",
      done: (stats?.userStats?.totalResumes ?? stats?.resumesCount ?? 0) > 0,
      to: "/upload"
    },
    {
      title: "Analyze ATS Score",
      description: "Check your structural headings & keywords density.",
      done: (stats?.userStats?.avgATSScore ?? stats?.avgResumeScore ?? 0) > 0,
      to: "/ats"
    },
    {
      title: "Match a Target Job",
      description: "Paste job requirements and verify semantic fit.",
      done: (stats?.averageJobMatch ?? 0) > 0,
      to: "/job-match"
    },
    {
      title: "Practice AI Mock Interview",
      description: "Train speech patterns and STAR achievements.",
      done: (stats?.userStats?.interviewsTaken ?? stats?.interviewsCount ?? 0) > 0,
      to: "/interview"
    },
    {
      title: "Generate tailored Cover Letter",
      description: "Build custom role-specific letters in seconds.",
      done: Boolean(stats?.history?.coverLetterCount || stats?.coverLettersCount),
      to: "/cover-letter"
    }
  ];

  // Dynamic Completed Actions Logs
  const recentActivities = useMemo(() => {
    const logs = [];
    const resumeCount = stats?.userStats?.totalResumes ?? stats?.resumesCount ?? 0;
    const atsScore = stats?.userStats?.avgATSScore ?? stats?.avgResumeScore ?? 0;
    const jobMatch = stats?.averageJobMatch ?? 0;
    const interviewCount = stats?.userStats?.interviewsTaken ?? stats?.interviewsCount ?? 0;

    if (resumeCount > 0) {
      logs.push({
        title: "Resume Upload parsed successfully",
        detail: "AWS Engineer profile structured",
        time: "2 hours ago",
        status: "success"
      });
    }
    if (atsScore > 0) {
      logs.push({
        title: "ATS 2.0 scanning completed",
        detail: `Overall Score matched: ${atsScore}%`,
        time: "1 day ago",
        status: "complete"
      });
    }
    if (jobMatch > 0) {
      logs.push({
        title: "Semantic Role fit checked",
        detail: `Senior Product Engineer at Nimbus Labs: ${jobMatch}%`,
        time: "3 days ago",
        status: "match"
      });
    }
    if (interviewCount > 0) {
      logs.push({
        title: "Voice AI interview session run",
        detail: "STAR response structured cleanly",
        time: "5 days ago",
        status: "interview"
      });
    }

    // Default fallbacks if empty
    if (!logs.length) {
      logs.push({
        title: "Account initialized",
        detail: "Ready to launch career personalized onboarding",
        time: "Just now",
        status: "success"
      });
    }

    return logs;
  }, [stats]);

  const completedCount = checklist.filter((item) => item.done).length;
  const completionPercent = Math.round((completedCount / checklist.length) * 100);

  return (
    <section className="min-h-[calc(100vh-140px)] text-white max-w-6xl mx-auto py-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <SectionHeader
          eyebrow="Overview"
          title="Mission Control"
          subtitle="Track your unified resume scoring analytics, readiness checks, and speech history."
          className="mb-0"
        />

        <div className="flex items-center gap-2">
          <Link
            to="/builder"
            className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            Launch Builder
          </Link>
          <button
            onClick={loadStats}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10 transition"
            aria-label="Refresh Stats"
          >
            <Clock className="h-4.5 w-4.5 text-slate-300" />
          </button>
        </div>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Top Primary Aggregated Gauge split */}
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            {/* Career Readiness Index Gauge */}
            <article className="premium-card p-6 flex flex-col justify-between items-center text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Overall Health</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Career Readiness Index</h3>
              </div>

              {/* Aggregated health index circular meter */}
              <div className="relative h-36 w-36 my-4 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="url(#readinessGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={263.8}
                    initial={{ strokeDashoffset: 263.8 }}
                    animate={{ strokeDashoffset: 263.8 - (263.8 * readinessIndex) / 100 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="readinessGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black bg-gradient-to-r from-cyan-300 via-indigo-200 to-white bg-clip-text text-transparent">
                    {readinessIndex}%
                  </span>
                  <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">HEALTH INDEX</span>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3 text-xs leading-normal text-slate-350 w-full">
                {readinessIndex >= 75 ? (
                  <p className="text-emerald-300 font-semibold">✨ Excellent: Profile is highly market ready!</p>
                ) : (
                  <p className="text-amber-300 font-semibold">⚠️ Action: Finish guided checklist below to close gaps.</p>
                )}
              </div>
            </article>

            {/* Micro Category cards grid */}
            <div className="grid gap-6 sm:grid-cols-2">
              {cards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.article
                    key={card.title}
                    variants={cardMotion}
                    initial="hidden"
                    animate="show"
                    transition={{ duration: 0.45, delay: index * 0.08 }}
                    whileHover={{ y: -4, scale: 1.015 }}
                    className="premium-card p-6 flex flex-col justify-between hover:border-cyan-500/15"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{card.title}</p>
                        <h2 className={`mt-3 text-3xl font-black ${card.tone}`}>
                          <CountValue value={card.value} suffix={card.suffix || ""} />
                        </h2>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-cyan-300">
                        <Icon className="h-5.5 w-5.5 stroke-[1.8px]" />
                      </div>
                    </div>
                    <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-t border-white/5 pt-3">
                      {card.hint}
                    </p>
                  </motion.article>
                );
              })}
            </div>
          </div>

          {/* Onboarding Checklist progress row */}
          <motion.article
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="premium-card p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4 mb-5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Guided Setup Checklist</span>
                <h2 className="text-xl font-bold text-white mt-0.5">Guided Onboarding Milestones</h2>
                <p className="text-xs text-slate-400">Complete these tasks to personalize your screening algorithms.</p>
              </div>
              <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-center">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Milestones Met</span>
                <p className="text-2xl font-black text-cyan-300 mt-0.5">{completionPercent}%</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {checklist.map((item, idx) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className={`rounded-2xl border p-4 flex flex-col justify-between transition duration-300 ${
                    item.done
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/5 bg-white/5 hover:border-cyan-400/20 hover:bg-cyan-500/5 text-slate-400"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500">STAGE {idx + 1}</span>
                      <CheckCircle2 className={`h-4.5 w-4.5 ${item.done ? "text-emerald-300" : "text-slate-600"}`} />
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug">{item.title}</h4>
                    <p className="text-[9px] leading-relaxed text-slate-400">{item.description}</p>
                  </div>
                  <span className="inline-flex items-center text-[9px] font-bold uppercase mt-4 text-cyan-300 hover:underline">
                    Trigger →
                  </span>
                </Link>
              ))}
            </div>
          </motion.article>

          {/* Historical Trends Charts */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* ATS Trends */}
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="premium-card p-6 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-300" /> ATS Vetting History
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">Scoring Trend over revisions</h4>
              </div>

              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.resumePoints}>
                    <defs>
                      <linearGradient id="atsDashboardFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "12px"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#22d3ee"
                      fill="url(#atsDashboardFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.article>

            {/* Job Match Trends */}
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="premium-card p-6 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-300" /> Job Fit History
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">Semantic blending matches</h4>
              </div>

              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.jobMatchPoints}>
                    <defs>
                      <linearGradient id="jobMatchDashboardFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "12px"
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#f59e0b"
                      fill="url(#jobMatchDashboardFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.article>

            {/* Mock Interview Progress */}
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="premium-card p-6 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <MessagesSquare className="h-3.5 w-3.5 text-emerald-300" /> Speech Analytics
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">STAR mock scoring trends</h4>
              </div>

              <div className="h-56 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.interviewPoints}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 9 }} />
                    <YAxis stroke="#64748b" domain={[0, 10]} tick={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15, 23, 42, 0.9)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "12px"
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 4, stroke: "#10b981", strokeWidth: 1, fill: "#0f172a" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.article>
          </div>

          {/* Activity Logs & Strategy recommendations Split */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Activity Logs */}
            <article className="premium-card p-6 space-y-4 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Activity className="h-4 w-4 text-cyan-300" /> Activity Timeline
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">Your recent career operations</h4>
              </div>

              <div className="space-y-4 flex-1 mt-4">
                {recentActivities.map((act, idx) => (
                  <div key={idx} className="flex gap-4 items-start text-xs relative group">
                    {/* Vertical connecting line */}
                    {idx < recentActivities.length - 1 && (
                      <span className="absolute left-2.5 top-6 w-0.5 h-8 bg-white/5" />
                    )}
                    <div className="h-5.5 w-5.5 rounded-full bg-slate-950 border border-cyan-400/40 flex items-center justify-center flex-shrink-0 z-10">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-2 items-center">
                        <p className="font-extrabold text-white truncate">{act.title}</p>
                        <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {act.time}
                        </span>
                      </div>
                      <p className="text-slate-400 mt-0.5">{act.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Smart suggestions roadmap */}
            {!!stats?.smartSuggestions?.length && (
              <article className="premium-card p-6 space-y-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-cyan-300" /> Smart Roadmaps
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Suggested Action Strategies</h4>
                </div>

                <div className="space-y-3 mt-4">
                  {stats.smartSuggestions.map((item, idx) => (
                    <motion.div
                      key={`${item}-${idx}`}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs leading-relaxed text-slate-200 flex items-start gap-3"
                    >
                      <span className="h-5 w-5 rounded bg-cyan-400/10 text-cyan-300 font-black text-center flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <p>{item}</p>
                    </motion.div>
                  ))}
                </div>
              </article>
            )}
          </div>
        </div>
      )}

      {/* Onboarding splash card modal dialog */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="premium-card max-w-lg w-full p-6 space-y-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)] flex-shrink-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Welcome to AI Career Copilot Pro</h3>
                <p className="text-xs text-slate-400">Personalized resume, job matching, and panel tools are active.</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Let's customize your profile in minutes. Launch the slide-based Career Wizard to organize your focus skills and unlock precise readiness indexing.
            </p>

            <div className="flex flex-wrap gap-3 border-t border-white/5 pt-4">
              <Link
                to="/onboarding"
                onClick={() => setShowOnboarding(false)}
                className="btn-glow text-xs font-bold uppercase tracking-wider px-6 py-3"
              >
                Launch Wizard Checklist
              </Link>
              <button
                type="button"
                className="rounded-3xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-bold uppercase text-slate-350 hover:bg-white/10 hover:text-white transition"
                onClick={() => {
                  localStorage.setItem("career_copilot_onboarding_complete", "true");
                  setShowOnboarding(false);
                }}
              >
                Configure later
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </section>
  );
}

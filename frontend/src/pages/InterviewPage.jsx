import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, ChevronRight, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";

const TypingBubble = ({ label }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
    <span>{label}</span>
    <span className="flex gap-1">
      <motion.span className="h-2 w-2 rounded-full bg-cyan-300" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity }} />
      <motion.span className="h-2 w-2 rounded-full bg-cyan-300" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: 0.18 }} />
      <motion.span className="h-2 w-2 rounded-full bg-cyan-300" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: 0.34 }} />
    </span>
  </div>
);

const ScoreCircle = ({ score, label = "Score" }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score || 0));
  const offset = circumference - (progress / 100) * circumference;
  const color = progress >= 8 ? "#10b981" : progress >= 6 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative mx-auto h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-3xl font-bold text-white">{progress}</p>
        <p className="text-xs text-slate-400">out of 10</p>
      </div>
    </div>
  );
};

export default function InterviewPage() {
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [improvedAnswers, setImprovedAnswers] = useState([]);
  const [improvementSummary, setImprovementSummary] = useState(null);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [improving, setImproving] = useState(false);
  const [showImproveForm, setShowImproveForm] = useState(false);
  const [listeningIndex, setListeningIndex] = useState(-1);
  const [voiceEvaluations, setVoiceEvaluations] = useState({});
  const [interviewMode, setInterviewMode] = useState("behavioral");
  const [recordingState, setRecordingState] = useState("idle");
  const [fillerWords, setFillerWords] = useState({});
  const [speechMetrics, setSpeechMetrics] = useState({});

  useEffect(() => {
    api
      .get("/resumes")
      .then(({ data }) => {
        setResumes(data.resumes || []);
        if (data.resumes?.[0]?._id) {
          setResumeId(data.resumes[0]._id);
        }
      })
      .catch(() => setError("Unable to load resumes"));
  }, []);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setImprovementSummary(null);
    try {
      const { data } = await api.post("/interviews/generate", {
        resumeId,
        company: company.trim(),
        role: role.trim(),
        interviewMode
      });
      setSession(data.session);
      const blankAnswers = (data.session?.questions || []).map(() => "");
      setAnswers(blankAnswers);
      setImprovedAnswers(blankAnswers);
      setShowImproveForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to generate interview");
    } finally {
      setGenerating(false);
    }
  };

  const submitAnswers = async () => {
    if (!session) return;
    setSubmitting(true);
    setError("");
    setImprovementSummary(null);
    try {
      const { data } = await api.post(`/interviews/${session._id}/evaluate`, { answers });
      setSession(data.session);
      setImprovedAnswers(data.session?.answers || answers);
    } catch (err) {
      setError(err.response?.data?.message || "Evaluation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const submitImprovedAnswers = async () => {
    if (!session) return;
    setImproving(true);
    setError("");
    try {
      const { data } = await api.post(`/interviews/${session._id}/improve`, {
        improvedAnswers
      });
      setSession(data.session);
      setImprovementSummary(data.improvementSummary || null);
      setShowImproveForm(false);
    } catch (err) {
      setError(err.response?.data?.message || "Improvement loop failed");
    } finally {
      setImproving(false);
    }
  };

  const questions = session?.questions || [];

  const startVoiceInput = (index) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const startedAt = Date.now();
    setListeningIndex(index);

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setAnswers((prev) => {
        const next = [...prev];
        next[index] = `${String(next[index] || "").trim()} ${transcript}`.trim();
        return next;
      });

      const fillerList = ["um", "uh", "like", "you know", "basically", "actually"]; 
      const transcriptLower = transcript.toLowerCase();
      const fillerCount = fillerList.reduce((acc, filler) => {
        const matches = transcriptLower.match(new RegExp(`\\b${filler}\\b`, "g"));
        return acc + (matches ? matches.length : 0);
      }, 0);
      setFillerWords((prev) => ({
        ...prev,
        [index]: fillerCount
      }));

      try {
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const { data } = await api.post("/interviews/voice-evaluate", {
          resumeId,
          question: questions[index],
          transcript,
          durationSec
        });

        setVoiceEvaluations((prev) => ({
          ...prev,
          [index]: data.result
        }));

        setSpeechMetrics((prev) => ({
          ...prev,
          [index]: {
            durationSec,
            wpm: data.result?.speaking_speed_wpm || Math.round((transcript.split(" ").length / durationSec) * 60),
            confidence: data.result?.confidence_score || 0
          }
        }));
      } catch (err) {
        setError(err.response?.data?.message || "Voice evaluation failed");
      }
    };

    recognition.onerror = () => {
      setError("Voice input failed. Please try again.");
      setListeningIndex(-1);
    };

    recognition.onend = () => {
      setListeningIndex(-1);
    };

    recognition.start();
  };

  return (
    <section className="min-h-[calc(100vh-130px)] text-white pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-8"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Interactive Prep</p>
        <h1 className="mt-2 text-4xl font-extrabold">AI Interview Simulator</h1>
        <p className="mt-2 text-slate-300">Practice with role-specific questions, get detailed feedback, and improve with guided re-evaluation.</p>
      </motion.div>

      <ErrorBanner message={error} />

      {!session && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="premium-card mb-6 max-w-2xl"
        >
          <h2 className="mb-4 text-xl font-bold text-cyan-100">Setup Interview</h2>
          <p className="mb-6 text-sm text-slate-300">Tell us about the role you're interviewing for so we can generate relevant questions.</p>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {/* Resume Selection */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Resume</label>
              <select
                value={resumeId}
                onChange={(e) => setResumeId(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              >
                <option value="">Select resume...</option>
                {resumes.map((resume) => (
                  <option key={resume._id} value={resume._id}>
                    {resume.title || "Untitled"}
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Company</label>
              <input
                type="text"
                placeholder="e.g., Google, Meta, Stripe"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500"
              />
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Role</label>
              <input
                type="text"
                placeholder="e.g., Senior Engineer, PM"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Interview Mode</label>
              <select
                value={interviewMode}
                onChange={(e) => setInterviewMode(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
              >
                <option value="behavioral">Behavioral</option>
                <option value="technical">Technical</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Recording</label>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                {recordingState === "idle" ? "Ready to record" : recordingState === "recording" ? "Recording..." : "Recorded"}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Session Length</label>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                25 minutes
              </div>
            </div>
          </div>

          <motion.button
            onClick={generate}
            disabled={generating || !resumeId || !company.trim() || !role.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-glow w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating Questions..." : "Generate Interview Questions"}
          </motion.button>
        </motion.div>
      )}

      {!!session && !session.evaluation && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 md:grid-cols-3"
          >
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Session Mode</p>
              <p className="mt-2 text-lg font-semibold text-cyan-200">{interviewMode}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recording</p>
              <button
                type="button"
                onClick={() => setRecordingState(recordingState === "recording" ? "stopped" : "recording")}
                className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${recordingState === "recording" ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"}`}
              >
                {recordingState === "recording" ? "Stop recording" : recordingState === "stopped" ? "Playback" : "Start recording"}
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Coach Focus</p>
              <p className="mt-2 text-sm text-slate-300">Structure, metrics, and confident delivery.</p>
            </div>
          </motion.div>
          {/* Progress Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="premium-card"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-300">Interview Progress</p>
              <p className="text-xs text-slate-400">{answers.filter(a => String(a || "").trim()).length} / {questions.length} answered</p>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
                initial={{ width: "0%" }}
                animate={{ width: `${(answers.filter(a => String(a || "").trim()).length / questions.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>

          {(generating || submitting) && <TypingBubble label="AI is typing" />}

          {questions.map((question, index) => (
            <motion.div
              key={`${question}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="space-y-3"
            >
              {/* Question */}
              <div className="mr-8 rounded-2xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 md:mr-20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                    Question {index + 1} of {questions.length}
                  </p>
                  {String(answers[index] || "").trim() && (
                    <span className="inline-block px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-xs text-emerald-100">✓</span>
                  )}
                </div>
                <p className="text-slate-100">{question}</p>
              </div>

              {/* Answer Input */}
              <div className="ml-8 rounded-2xl border border-violet-300/35 bg-violet-500/10 px-4 py-3 md:ml-20">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">Your Answer</p>
                <textarea
                  className="mt-3"
                  rows={5}
                  value={answers[index] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[index] = e.target.value;
                      return next;
                    })
                  }
                  placeholder="Share a specific example with context, actions, and results (STAR format recommended)."
                />

                {/* Voice Input & Metrics */}
                <div className="mt-4 flex flex-wrap gap-3">
                  <motion.button
                    type="button"
                    onClick={() => startVoiceInput(index)}
                    whileHover={{ scale: 1.05 }}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition-all ${
                      listeningIndex === index
                        ? "border-red-400/40 bg-red-500/10 text-red-200"
                        : "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                    }`}
                  >
                    {listeningIndex === index ? (
                      <>
                        <MicOff className="h-4 w-4" />
                        <span>Listening...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        <span>Use Mic</span>
                      </>
                    )}
                  </motion.button>

                  {voiceEvaluations[index] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
                    >
                      <p className="font-semibold">Voice Analysis</p>
                      <p className="mt-1 text-xs">📊 Clarity: {voiceEvaluations[index].score}/10</p>
                      <p>🎯 Confidence: {voiceEvaluations[index].confidence_score}/10</p>
                      <p>⚡ Speaking Speed: {voiceEvaluations[index].speaking_speed_wpm} WPM</p>
                      <p>🧩 Filler Words: {fillerWords[index] || 0}</p>
                      {voiceEvaluations[index].improvement && (
                        <p className="mt-2 font-semibold text-emerald-200">💡 Tip: {voiceEvaluations[index].improvement}</p>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          <motion.button
            onClick={submitAnswers}
            disabled={submitting || answers.some((item) => !String(item || "").trim())}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-glow w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Evaluating Answers..." : "Submit Answers for Evaluation"}
          </motion.button>
        </div>
      )}

      {!!session?.evaluation && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-6 space-y-6"
        >
          {improving && <TypingBubble label="AI is re-evaluating" />}

          <motion.div className="grid gap-4 md:grid-cols-3">
            <div className="premium-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Average WPM</p>
              <p className="mt-2 text-2xl font-bold text-cyan-200">
                {Math.round(
                  Object.values(speechMetrics).reduce((acc, item) => acc + (item?.wpm || 0), 0) /
                    Math.max(1, Object.values(speechMetrics).length)
                )}
              </p>
            </div>
            <div className="premium-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Filler Words</p>
              <p className="mt-2 text-2xl font-bold text-rose-200">
                {Object.values(fillerWords).reduce((acc, count) => acc + (count || 0), 0)}
              </p>
            </div>
            <div className="premium-card">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Confidence Avg</p>
              <p className="mt-2 text-2xl font-bold text-emerald-200">
                {Math.round(
                  Object.values(speechMetrics).reduce((acc, item) => acc + (item?.confidence || 0), 0) /
                    Math.max(1, Object.values(speechMetrics).length)
                )}/10
              </p>
            </div>
          </motion.div>

          {/* Overall Score Card */}
          <motion.div className="premium-card border-t-2 border-emerald-400/35 text-center">
            <p className="text-sm uppercase tracking-[0.18em] text-emerald-200 mb-4">Overall Interview Score</p>
            <div className="flex justify-center">
              <ScoreCircle score={session.evaluation.overallScore} />
            </div>
            <p className="mt-4 text-slate-300">
              {session.evaluation.overallScore >= 8
                ? "🌟 Excellent performance! You're well-prepared."
                : session.evaluation.overallScore >= 6
                ? "✅ Good responses with room for improvement."
                : "📚 Keep practicing—focus on the areas below."}
            </p>
          </motion.div>

          {/* Per-Question Feedback */}
          {session.evaluation.perQuestion?.map((item, index) => (
            <motion.article
              key={`${item.question}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="premium-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-300 mb-1">Question {index + 1}</p>
                  <p className="text-base font-semibold text-slate-100">{item.question}</p>
                </div>
                <motion.div className="rounded-full border border-cyan-400/45 bg-cyan-500/15 px-4 py-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-300" />
                  <span className="font-bold text-cyan-200">{item.score}/10</span>
                </motion.div>
              </div>

              {item.feedback && (
                <div className="mt-3 rounded-lg border border-slate-400/30 bg-slate-500/10 p-3">
                  <p className="text-sm text-slate-300">{item.feedback}</p>
                </div>
              )}

              {item.improvements?.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-300/35 bg-amber-300/10 p-3">
                  <p className="text-sm font-semibold text-amber-100 mb-2">💡 Improvements</p>
                  <ul className="space-y-1">
                    {item.improvements.slice(0, 3).map((tip, tipIndex) => (
                      <li key={`${index}-tip-${tipIndex}`} className="text-sm text-amber-50 flex items-start gap-2">
                        <span className="text-amber-300 mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.article>
          ))}

          {/* Improvement Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.button
              onClick={() => setShowImproveForm((prev) => !prev)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl border border-cyan-400/45 bg-cyan-500/15 px-5 py-3 font-semibold text-cyan-100 hover:bg-cyan-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="h-5 w-5" />
              {showImproveForm ? "Hide Improvement Form" : "Improve & Re-evaluate Answers"}
            </motion.button>

            {showImproveForm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="premium-card mt-4 space-y-4"
              >
                <p className="text-sm text-slate-300 mb-4">Refine your answers based on the feedback above and resubmit for re-evaluation.</p>
                {questions.map((question, index) => (
                  <div key={`improved-${index}`}>
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-slate-400 mb-1">Question {index + 1}</p>
                      <p className="text-sm font-semibold text-cyan-100">{question}</p>
                    </div>
                    <textarea
                      rows={4}
                      value={improvedAnswers[index] || ""}
                      onChange={(e) => {
                        setImprovedAnswers((prev) => {
                          const next = [...prev];
                          next[index] = e.target.value;
                          return next;
                        });
                      }}
                      placeholder="Strengthen with specific examples, metrics, and clear outcomes."
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500"
                    />
                  </div>
                ))}

                <motion.button
                  onClick={submitImprovedAnswers}
                  disabled={improving || improvedAnswers.some((item) => !String(item || "").trim())}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-glow w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {improving ? "Re-evaluating..." : "Submit Improved Answers"}
                </motion.button>
              </motion.div>
            )}
          </motion.div>

          {improvementSummary && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="premium-card border border-violet-400/35 bg-gradient-to-br from-violet-500/10 to-cyan-500/10"
            >
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="h-6 w-6 text-violet-300" />
                <div>
                  <p className="font-bold text-violet-100">Improvement Summary</p>
                  <p className="text-sm text-violet-200">
                    Score: {improvementSummary.previousScore}/10 → {improvementSummary.newScore}/10
                    <span className={`ml-2 font-bold ${improvementSummary.newScore > improvementSummary.previousScore ? "text-emerald-400" : "text-amber-400"}`}>
                      {improvementSummary.newScore > improvementSummary.previousScore ? "+" : ""}{improvementSummary.newScore - improvementSummary.previousScore}
                    </span>
                  </p>
                </div>
              </div>
              {improvementSummary.summary && (
                <p className="text-slate-200 text-sm">{improvementSummary.summary}</p>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </section>
  );
}

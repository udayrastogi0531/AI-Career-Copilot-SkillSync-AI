import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Clock, Trash2, AlertCircle, BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";

const statuses = ["applied", "interview", "offer", "rejected"];

const statusConfig = {
  applied: { color: "blue", label: "Applied", icon: "📨", bg: "bg-blue-500/20", border: "border-blue-400/30", text: "text-blue-100" },
  interview: { color: "amber", label: "Interview", icon: "💬", bg: "bg-amber-500/20", border: "border-amber-400/30", text: "text-amber-100" },
  offer: { color: "emerald", label: "Offer", icon: "🎉", bg: "bg-emerald-500/20", border: "border-emerald-400/30", text: "text-emerald-100" },
  rejected: { color: "rose", label: "Rejected", icon: "❌", bg: "bg-rose-500/20", border: "border-rose-400/30", text: "text-rose-100" }
};

export default function JobTrackerPage() {
  const [jobs, setJobs] = useState([]);
  const [insights, setInsights] = useState({ remindersDue: 0, followUps: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ company: "", role: "", status: "applied" });

  const loadJobs = async () => {
    try {
      const { data } = await api.get("/jobs");
      setJobs(data.jobs || []);
      setInsights(data.insights || { remindersDue: 0, followUps: [] });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load jobs");
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const addJob = async () => {
    if (!form.company.trim() || !form.role.trim()) return;
    setLoading(true);
    setError("");
    try {
      await api.post("/jobs", form);
      setForm({ company: "", role: "", status: "applied" });
      await loadJobs();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add job");
    } finally {
      setLoading(false);
    }
  };

  const moveJob = async (jobId, status) => {
    try {
      await api.patch(`/jobs/${jobId}`, { status });
      await loadJobs();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update job");
    }
  };

  const deleteJob = async (jobId) => {
    try {
      await api.delete(`/jobs/${jobId}`);
      await loadJobs();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete job");
    }
  };

  const onDropToColumn = async (event, status) => {
    event.preventDefault();
    const jobId = event.dataTransfer.getData("text/plain");
    if (!jobId) return;
    await moveJob(jobId, status);
  };

  return (
    <section className="min-h-[calc(100vh-130px)] text-white pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-8"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Application Tracking</p>
        <h1 className="mt-2 text-4xl font-extrabold">Job Tracker</h1>
        <p className="mt-2 text-slate-300">Track applications from Applied → Interview → Offer. Get AI-powered follow-up insights.</p>
      </motion.div>

      <ErrorBanner message={error} />

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="premium-card mb-6 grid gap-3 md:grid-cols-5"
      >
        <input
          placeholder="Company name"
          value={form.company}
          onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500"
        />
        <input
          placeholder="Job title"
          value={form.role}
          onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500"
        />
        <select
          value={form.status}
          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>{statusConfig[status].label}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-glow col-span-1"
          onClick={addJob}
          disabled={loading || !form.company.trim() || !form.role.trim()}
        >
          {loading ? "Saving..." : "Add Job"}
        </button>
      </motion.div>

      {/* Insights Section */}
      <div className="grid gap-4 mb-8 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-xl border border-amber-300/35 bg-amber-300/10 p-4"
        >
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-100">Follow-up Reminders</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">{insights.remindersDue || 0}</p>
              <p className="mt-1 text-xs text-amber-100/70">Jobs needing follow-up</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-cyan-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-cyan-100">Next Actions</p>
              {(insights.followUps || []).length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {(insights.followUps || []).slice(0, 2).map((item) => (
                    <li key={item.jobId} className="text-xs text-slate-200">
                      <span className="font-medium">{item.company}:</span> {item.suggestion}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-cyan-100/70">All caught up!</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Kanban Board */}
      {!jobs.length ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No job applications yet"
          description="Add your first application to unlock reminders, follow-up insights, and progress tracking."
          ctaLabel="Add Your First Job"
          onCta={() => {
            const input = document.querySelector("input[placeholder='Company name']");
            if (input) input.focus();
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {statuses.map((status, idx) => (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.08 }}
            className="flex flex-col max-h-96 overflow-y-auto"
          >
            {/* Column Header */}
            <div className={`premium-card mb-4 flex items-center justify-between ${statusConfig[status].bg} border-t-2 ${statusConfig[status].border}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{statusConfig[status].icon}</span>
                <div>
                  <p className={`font-bold ${statusConfig[status].text}`}>{statusConfig[status].label}</p>
                  <p className="text-xs text-slate-400">{jobs.filter((job) => job.status === status).length} items</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>

            {/* Cards */}
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropToColumn(event, status)}
              className="space-y-3 flex-1"
            >
              {jobs.filter((job) => job.status === status).map((job, cardIdx) => (
                <motion.article
                  key={job._id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", job._id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: cardIdx * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="group rounded-lg border border-white/15 bg-white/5 p-3 cursor-grab active:cursor-grabbing hover:bg-white/10 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-100 group-hover:text-cyan-100">{job.company}</p>
                      <p className="text-sm text-slate-400">{job.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteJob(job._id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded text-rose-400 hover:text-rose-300 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Badges */}
                  {(job.reminder_due || job.follow_up_suggestion) && (
                    <div className="mt-2 space-y-1">
                      {job.reminder_due && (
                        <p className="rounded-md border border-amber-400/35 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">
                          ⏰ Follow-up due
                        </p>
                      )}
                      {job.follow_up_suggestion && (
                        <p className="text-xs text-slate-300">{job.follow_up_suggestion}</p>
                      )}
                    </div>
                  )}

                  {/* Status Buttons */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {statuses.filter((next) => next !== status).map((next) => (
                      <motion.button
                        key={next}
                        type="button"
                        onClick={() => {
                          moveJob(job._id, next);
                          toast.success(`Moved to ${statusConfig[next].label}`);
                        }}
                        whileHover={{ scale: 1.05 }}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${statusConfig[next].border} ${statusConfig[next].text} hover:${statusConfig[next].bg}`}
                      >
                        → {statusConfig[next].label}
                      </motion.button>
                    ))}
                  </div>
                </motion.article>
              ))}

              {!jobs.some((job) => job.status === status) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-lg border-2 border-dashed border-white/10 p-4 text-center text-xs text-slate-500"
                >
                  Drag jobs here or add new
                </motion.div>
              )}
            </div>
          </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

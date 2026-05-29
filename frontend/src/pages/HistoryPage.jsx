import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";
import SectionHeader from "../components/SectionHeader";
import LoadingSkeleton from "../components/LoadingSkeleton";

export default function HistoryPage() {
  const [resumeTrend, setResumeTrend] = useState([]);
  const [interviewTrend, setInterviewTrend] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [recentInterviews, setRecentInterviews] = useState([]);
  const [atsHistory, setAtsHistory] = useState([]);
  const [jobMatchHistory, setJobMatchHistory] = useState([]);
  const [interviewHistory, setInterviewHistory] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [error, setError] = useState("");
  const [activityHeatmap, setActivityHeatmap] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [statsResponse, analysisResponse, interviewResponse] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/analysis/history?limit=50"),
          api.get("/interviews/history")
        ]);

        const stats = statsResponse.data.stats || {};

        setResumeTrend(
          (stats.resumeTrend || []).slice(-8).map((item, idx) => ({
            name: `R${idx + 1}`,
            score: Number(item.score || 0)
          }))
        );

        setInterviewTrend(
          (stats.interviewTrend || []).slice(-8).map((item, idx) => ({
            name: `I${idx + 1}`,
            current: Number(item.currentScore || 0),
            delta: Number(item.delta || 0)
          }))
        );

        setRecentAnalyses(stats.history?.recentAnalyses || []);
        setRecentInterviews(stats.history?.recentInterviews || []);
        setAtsHistory(stats.history?.atsHistory || []);
        setJobMatchHistory(stats.history?.jobMatchHistory || []);
        setInterviewHistory(stats.history?.interviewHistory || []);
        setActivityHeatmap(stats.history?.activityHeatmap || []);
        setBadges(stats.history?.badges || []);
        setAnalysisHistory(analysisResponse.data?.history || []);
        setInterviewSessions(interviewResponse.data?.history || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load history");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const hasHistory =
    resumeTrend.length ||
    interviewTrend.length ||
    recentAnalyses.length ||
    recentInterviews.length ||
    atsHistory.length ||
    jobMatchHistory.length ||
    interviewHistory.length ||
    activityHeatmap.length ||
    badges.length ||
    analysisHistory.length ||
    interviewSessions.length;

  const fallbackHeatmap = Array.from({ length: 21 }).map((_, idx) => ({
    id: idx,
    intensity: (idx * 7) % 10
  }));

  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <SectionHeader
        eyebrow="Insights"
        title="Performance Analytics"
        subtitle="Track ATS and interview outcomes to see measurable progress over time."
        className="mb-8"
      />

      <ErrorBanner message={error} />

      {loading && <LoadingSkeleton rows={4} />}

      {!loading && !hasHistory && (
        <EmptyState
          icon={Activity}
          title="No analytics yet"
          description="Run an ATS analysis or interview session to start tracking your progress here."
          ctaLabel="Run ATS Analysis"
          href="/ats"
          className="mb-8"
        />
      )}

      {!loading && (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">ATS Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={resumeTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line dataKey="score" stroke="#22d3ee" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Interview Delta</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={interviewTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Bar dataKey="delta" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {!loading && (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Recent Analyses</h2>
          <div className="space-y-3">
            {recentAnalyses.map((item) => {
              const score = item?.result?.score ?? item?.result?.match_percentage ?? 0;
              const labelMap = {
                resume: "ATS",
                "job-match": "Job Match",
                "resume-improve": "Resume Improve",
                "cover-letter": "Cover Letter"
              };
              const label = labelMap[item.analysisType] || "Analysis";
              return (
                <div key={item._id} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-100">{label}</p>
                    <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">{score}%</span>
                </div>
              );
            })}
            {!recentAnalyses.length && <p className="text-sm text-slate-400">No analysis history yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Recent Interviews</h2>
          <div className="space-y-3">
            {recentInterviews.map((item) => (
              <div key={item.sessionId} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-100">Session {String(item.sessionId).slice(-6)}</p>
                  <p className="text-xs text-slate-400">{new Date(item.updatedAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-200">{item.score ?? "-"}/10</p>
                  <p className="text-xs text-slate-400">Loops: {item.improvementCount}</p>
                </div>
              </div>
            ))}
            {!recentInterviews.length && <p className="text-sm text-slate-400">No interview history yet.</p>}
          </div>
        </section>
      </div>
      )}

      {!loading && (
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">ATS History</h2>
          <div className="space-y-3">
            {atsHistory.map((item) => (
              <div key={item._id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="font-medium text-slate-100">Score: {item?.data?.score ?? 0}%</p>
                <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!atsHistory.length && <p className="text-sm text-slate-400">No ATS attempts yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Job Match History</h2>
          <div className="space-y-3">
            {jobMatchHistory.map((item) => (
              <div key={item._id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="font-medium text-slate-100">Match: {item?.data?.match_percentage ?? 0}%</p>
                <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!jobMatchHistory.length && <p className="text-sm text-slate-400">No job match attempts yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Interview Attempts</h2>
          <div className="space-y-3">
            {interviewHistory.map((item) => (
              <div key={item._id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="font-medium text-slate-100">Event: {item?.data?.event || "run"}</p>
                <p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!interviewHistory.length && <p className="text-sm text-slate-400">No interview attempts yet.</p>}
          </div>
        </section>
      </div>
      )}

      {!loading && (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Weekly Activity Heatmap</h2>
          <div className="grid grid-cols-7 gap-2">
            {(activityHeatmap.length ? activityHeatmap : fallbackHeatmap).map((cell) => (
              <div
                key={cell.id}
                className="h-8 rounded-lg"
                style={{
                  background: `rgba(34, 211, 238, ${0.08 + cell.intensity * 0.08})`
                }}
                title={`Intensity: ${cell.intensity}`}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">More streaks = higher intensity signals.</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Achievements</h2>
          <div className="space-y-3">
            {(badges.length ? badges : [
              { id: 1, title: "ATS > 80%", detail: "Unlocked 3 days ago" },
              { id: 2, title: "3 Interviews Completed", detail: "Unlocked this week" },
              { id: 3, title: "5 Job Matches", detail: "Unlocked this month" }
            ]).map((badge) => (
              <div key={badge.id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <p className="font-medium text-slate-100">{badge.title}</p>
                <p className="text-xs text-slate-400">{badge.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      )}

      {!loading && (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Analysis History (API)</h2>
          <div className="space-y-3">
            {analysisHistory.map((item) => (
              <div key={item._id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-100">{item.analysisType || "analysis"}</p>
                  <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                {item.result?.score !== undefined && (
                  <p className="mt-2 text-xs text-cyan-200">Score: {item.result.score}%</p>
                )}
                {item.result?.match_percentage !== undefined && (
                  <p className="mt-2 text-xs text-amber-200">Match: {item.result.match_percentage}%</p>
                )}
              </div>
            ))}
            {!analysisHistory.length && <p className="text-sm text-slate-400">No analysis history from API.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Interview Sessions (API)</h2>
          <div className="space-y-3">
            {interviewSessions.map((session) => (
              <div key={session._id} className="rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-100">{session.role || "Interview"}</p>
                  <span className="text-xs text-slate-400">{new Date(session.updatedAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-300">{session.company || "Target company"}</p>
                <p className="mt-2 text-xs text-cyan-200">Score: {session.evaluation?.overallScore ?? "-"}/10</p>
              </div>
            ))}
            {!interviewSessions.length && <p className="text-sm text-slate-400">No interview sessions from API.</p>}
          </div>
        </section>
      </div>
      )}
    </section>
  );
}

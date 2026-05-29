import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ErrorBanner from "../components/ErrorBanner";

export default function ProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    experienceLevel: "junior",
    targetRoles: "",
    targetIndustries: "",
    focusSkills: "",
    photoUrl: "",
    headline: "",
    bio: "",
    location: "",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: "",
    skills: "",
    education: "",
    experience: "",
    careerGoal: ""
  });

  const recentActivity = [
    { id: 1, title: "Resume score improved to 82%", time: "Today" },
    { id: 2, title: "Completed mock interview: Backend", time: "Yesterday" },
    { id: 3, title: "Uploaded new resume version", time: "2 days ago" }
  ];

  const normalizeList = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  };

  useEffect(() => {
    Promise.all([api.get("/dashboard/stats"), api.get("/profile")])
      .then(([statsRes, profileRes]) => {
        setStats(statsRes.data.stats || null);

        const personalization = profileRes.data.profile?.personalization || {};
        const profileFields = profileRes.data.profile?.profile || {};
        setProfile({
          experienceLevel: personalization.experienceLevel || "junior",
          targetRoles: normalizeList(personalization.targetRoles).join(", "),
          targetIndustries: normalizeList(personalization.targetIndustries).join(", "),
          focusSkills: normalizeList(personalization.focusSkills).join(", "),
          photoUrl: profileFields.photoUrl || "",
          headline: profileFields.headline || "",
          bio: profileFields.bio || "",
          location: profileFields.location || "",
          phone: profileFields.phone || "",
          linkedin: profileFields.linkedin || "",
          github: profileFields.github || "",
          portfolio: profileFields.portfolio || "",
          skills: (profileFields.skills || []).join(", "),
          education: (profileFields.education || []).join("\n"),
          experience: (profileFields.experience || []).join("\n"),
          careerGoal: profileFields.careerGoal || ""
        });
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load profile"));
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      await api.patch("/profile", {
        personalization: {
          experienceLevel: profile.experienceLevel,
          targetRoles: normalizeList(profile.targetRoles),
          targetIndustries: normalizeList(profile.targetIndustries),
          focusSkills: normalizeList(profile.focusSkills)
        },
        profile: {
          photoUrl: profile.photoUrl,
          headline: profile.headline,
          bio: profile.bio,
          location: profile.location,
          phone: profile.phone,
          linkedin: profile.linkedin,
          github: profile.github,
          portfolio: profile.portfolio,
          skills: profile.skills,
          education: profile.education,
          experience: profile.experience,
          careerGoal: profile.careerGoal
        }
      });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save profile");
    } finally {
      setSaving(false);
    }
  };

  const userStats = stats?.userStats || {};

  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Account</p>
        <h1 className="mt-2 text-4xl font-extrabold">Profile</h1>
      </div>

      <ErrorBanner message={error} />

      <article className="premium-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {profile.photoUrl ? (
              <img src={profile.photoUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Photo</div>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-400">Name</p>
            <p className="text-xl font-bold text-cyan-100">{user?.name || "-"}</p>
            <p className="mt-2 text-sm text-slate-400">Email</p>
            <p className="text-lg font-semibold text-cyan-100">{user?.email || "-"}</p>
          </div>
        </div>
      </article>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="premium-card">
          <p className="text-sm text-slate-400">Total Resumes</p>
          <p className="text-3xl font-extrabold text-emerald-200">{userStats.totalResumes ?? 0}</p>
        </article>
        <article className="premium-card">
          <p className="text-sm text-slate-400">Average ATS Score</p>
          <p className="text-3xl font-extrabold text-violet-200">{userStats.avgATSScore ?? 0}%</p>
        </article>
        <article className="premium-card">
          <p className="text-sm text-slate-400">Interviews Taken</p>
          <p className="text-3xl font-extrabold text-cyan-200">{userStats.interviewsTaken ?? 0}</p>
        </article>
      </div>

      <article className="premium-card mt-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-100">Personalization</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Experience Level</label>
            <select value={profile.experienceLevel} onChange={(e) => setProfile((p) => ({ ...p, experienceLevel: e.target.value }))}>
              <option value="student">Student</option>
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Target Roles</label>
            <input value={profile.targetRoles} onChange={(e) => setProfile((p) => ({ ...p, targetRoles: e.target.value }))} placeholder="Frontend Developer, Fullstack Engineer" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Target Industries</label>
            <input value={profile.targetIndustries} onChange={(e) => setProfile((p) => ({ ...p, targetIndustries: e.target.value }))} placeholder="SaaS, FinTech" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Focus Skills</label>
            <input value={profile.focusSkills} onChange={(e) => setProfile((p) => ({ ...p, focusSkills: e.target.value }))} placeholder="React, Node.js" />
          </div>
        </div>
      </article>

      <article className="premium-card mt-6 space-y-4">
        <h2 className="text-xl font-bold text-cyan-100">Profile Details</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Photo URL</label>
            <input value={profile.photoUrl} onChange={(e) => setProfile((p) => ({ ...p, photoUrl: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Headline</label>
            <input value={profile.headline} onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))} placeholder="Senior Product Designer" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Bio</label>
            <textarea rows={3} value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} placeholder="Short professional bio" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Location</label>
            <input value={profile.location} onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))} placeholder="Mumbai, IN" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Phone</label>
            <input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 90000 00000" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">LinkedIn</label>
            <input value={profile.linkedin} onChange={(e) => setProfile((p) => ({ ...p, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">GitHub</label>
            <input value={profile.github} onChange={(e) => setProfile((p) => ({ ...p, github: e.target.value }))} placeholder="https://github.com/" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Portfolio</label>
            <input value={profile.portfolio} onChange={(e) => setProfile((p) => ({ ...p, portfolio: e.target.value }))} placeholder="https://yourportfolio.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Skills</label>
            <input value={profile.skills} onChange={(e) => setProfile((p) => ({ ...p, skills: e.target.value }))} placeholder="React, Node.js, Product" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Career Goal</label>
            <input value={profile.careerGoal} onChange={(e) => setProfile((p) => ({ ...p, careerGoal: e.target.value }))} placeholder="Lead Product Designer" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Education</label>
            <textarea rows={3} value={profile.education} onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))} placeholder="B.Tech, IIT Delhi (2018-2022)" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">Experience</label>
            <textarea rows={3} value={profile.experience} onChange={(e) => setProfile((p) => ({ ...p, experience: e.target.value }))} placeholder="Senior Designer, Acme (2022-present)" />
          </div>
        </div>
        <button type="button" className="btn-glow" onClick={saveProfile} disabled={saving}>
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </article>

      <article className="premium-card mt-6">
        <h2 className="text-xl font-bold text-cyan-100">Recent Activity</h2>
        <div className="mt-4 space-y-3">
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-sm text-slate-200">{item.title}</p>
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.time}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

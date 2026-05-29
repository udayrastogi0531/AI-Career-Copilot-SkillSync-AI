import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  User,
  Briefcase,
  FileText,
  Bookmark,
  Award,
  ChevronRight,
  Target
} from "lucide-react";
import { toast } from "sonner";

const onboardingKey = "career_copilot_onboarding_steps";

const wizardSteps = [
  {
    id: "welcome",
    title: "Define Professional Title",
    description: "Tell us your professional focus and career level so our AI can personalize your roadmap."
  },
  {
    id: "target",
    title: "Define Target Career Role",
    description: "What exact job are you target-applying for? This enables precise ATS and Job Match scores."
  },
  {
    id: "resume",
    title: "Optimize Professional Resume",
    description: "Select or upload an ATS-ready resume to kickstart high-fidelity semantic parsing."
  },
  {
    id: "personalize",
    title: "Focus Skills & Industries",
    description: "Choose focus technology stacks and industry verticals to refine career suggestions."
  },
  {
    id: "review",
    title: "Ready for Takeoff",
    description: "Review your completed guided setup before launching your unified mission control."
  }
];

const availableSkills = [
  "React", "Node.js", "Python", "TypeScript", "Figma", "Design Systems",
  "Product Metrics", "SQL", "Docker", "Agile Sprints", "Cloud Architecture"
];

const availableIndustries = [
  "SaaS", "FinTech", "HealthTech", "AI / ML", "Web3 / Blockchain", "E-commerce"
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

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Profile data state
  const [headline, setHeadline] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [targetRole, setTargetRole] = useState("");
  const [focusSkills, setFocusSkills] = useState([]);
  const [targetIndustries, setTargetIndustries] = useState([]);
  const [profileDetails, setProfileDetails] = useState({});
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  // Wizard active navigation
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1); // 1 = right, -1 = left

  useEffect(() => {
    const stored = localStorage.getItem(onboardingKey);
    if (stored) {
      try {
        setCompleted(JSON.parse(stored));
      } catch {
        localStorage.removeItem(onboardingKey);
      }
    }
  }, []);

  useEffect(() => {
    // Load current profile variables
    api
      .get("/profile")
      .then(({ data }) => {
        const personalization = data?.profile?.personalization || {};
        const profile = data?.profile?.profile || {};
        setProfileDetails(profile);

        setHeadline(profile.headline || "");
        setExperienceLevel(personalization.experienceLevel || "mid");
        const roles = normalizeList(personalization.targetRoles);
        setTargetRole(roles[0] || "");
        setFocusSkills(normalizeList(personalization.focusSkills));
        setTargetIndustries(normalizeList(personalization.targetIndustries));
      })
      .catch(() => {
        setError("Unable to load profile customization details");
      });

    // Load user resumes
    api
      .get("/resumes")
      .then(({ data }) => {
        const allResumes = data.resumes || [];
        setResumes(allResumes);
        if (allResumes[0]) {
          setSelectedResumeId(allResumes[0]._id);
        }
      })
      .catch(() => {
        toast.error("Unable to load resumes");
      });
  }, []);

  const toggleSkill = (skill) => {
    setFocusSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleIndustry = (industry) => {
    setTargetIndustries((prev) =>
      prev.includes(industry) ? prev.filter((i) => i !== industry) : [...prev, industry]
    );
  };

  const handleNext = () => {
    if (activeStepIdx === 0 && !headline.trim()) {
      setError("Please specify a professional headline/title first");
      return;
    }
    if (activeStepIdx === 1 && !targetRole.trim()) {
      setError("Please specify a target role first");
      return;
    }
    setError("");
    setSlideDirection(1);
    setActiveStepIdx((prev) => Math.min(prev + 1, wizardSteps.length - 1));
  };

  const handleBack = () => {
    setError("");
    setSlideDirection(-1);
    setActiveStepIdx((prev) => Math.max(prev - 1, 0));
  };

  const handleLaunchDashboard = async () => {
    setSaving(true);
    setError("");

    try {
      // Save personalization profile
      await api.patch("/profile", {
        personalization: {
          experienceLevel,
          targetRoles: [targetRole.trim()],
          targetIndustries,
          focusSkills
        },
        profile: {
          ...profileDetails,
          headline: headline.trim()
        }
      });

      // Mark onboarding as complete in localStorage
      localStorage.setItem("career_copilot_onboarding_complete", "true");
      localStorage.setItem(
        onboardingKey,
        JSON.stringify({
          profile: true,
          target: true,
          resume: !!selectedResumeId,
          personalize: true,
          dashboard: true
        })
      );

      toast.success("Profile personalization synced successfully!");
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to finalize profile onboarding");
    } finally {
      setSaving(false);
    }
  };

  // Completion calculation
  const completionPercent = useMemo(() => {
    return Math.round(((activeStepIdx + 1) / wizardSteps.length) * 100);
  }, [activeStepIdx]);

  // Framer motion variants
  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 120 : -120,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    },
    exit: (direction) => ({
      x: direction < 0 ? 120 : -120,
      opacity: 0,
      transition: { duration: 0.25, ease: "easeIn" }
    })
  };

  return (
    <section className="min-h-[calc(100vh-140px)] text-white max-w-4xl mx-auto py-4">
      {/* Header section with progress */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-extrabold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Career Wizard
          </span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Personalize Your AI Stack</h1>
          <p className="mt-1 text-sm text-slate-400">Follow the guided wizard to customize score roadmaps.</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress Ring / Percent */}
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center flex items-center gap-3">
            <div className="relative h-10 w-10 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <path
                  className="text-white/5"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <motion.path
                  className="text-cyan-300"
                  strokeWidth="3.5"
                  strokeDasharray={`${completionPercent}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  transition={{ duration: 0.3 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                {completionPercent}%
              </div>
            </div>
            <div className="text-left">
              <p className="text-[10px] uppercase font-bold text-slate-500">Step Progression</p>
              <p className="text-sm font-black text-cyan-200">
                {activeStepIdx + 1} of {wizardSteps.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ErrorBanner message={error} />

      {/* Main wizard cards container */}
      <div className="premium-card p-6 md:p-8 min-h-[420px] flex flex-col justify-between overflow-hidden relative">
        <AnimatePresence mode="wait" custom={slideDirection}>
          <motion.div
            key={wizardSteps[activeStepIdx].id}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-6"
          >
            {/* Step Meta */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                WIZARD STAGE {activeStepIdx + 1}
              </span>
              <h2 className="text-2xl font-black text-white mt-0.5">
                {wizardSteps[activeStepIdx].title}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {wizardSteps[activeStepIdx].description}
              </p>
            </div>

            {/* STEP 1: WELCOME & HEADLINE */}
            {wizardSteps[activeStepIdx].id === "welcome" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Professional Headline / Title
                  </label>
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Lead Product Engineer, Senior Frontend Developer"
                    className="w-full"
                  />
                  <p className="text-[10px] text-slate-500">This helps align your experience section keywords.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Experience Level
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {["entry", "mid", "senior", "lead"].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setExperienceLevel(lvl)}
                        className={`rounded-2xl px-4 py-3 text-xs font-bold uppercase transition border ${
                          experienceLevel === lvl
                            ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                            : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                        }`}
                      >
                        {lvl} Level
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: TARGET ROLE */}
            {wizardSteps[activeStepIdx].id === "target" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Target Role Title
                  </label>
                  <div className="relative">
                    <Target className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      placeholder="e.g. Senior UX Architect, Engineering Manager"
                      className="pl-12"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Your target role score matches are compiled against standard requisitions.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3: RESUME OPTIMIZATION */}
            {wizardSteps[activeStepIdx].id === "resume" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Select Active Resume
                  </label>
                  {resumes.length ? (
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      className="w-full"
                    >
                      <option value="">Select an existing resume...</option>
                      {resumes.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.title || "Untitled Resume"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center space-y-3">
                      <p className="text-xs text-slate-400">
                        You have not uploaded any resumes yet. Upload an ATS resume to start analytics.
                      </p>
                      <Link to="/upload" className="btn-glow inline-flex text-xs px-4 py-2">
                        Upload Resume File
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 4: PERSONALIZE TAGS */}
            {wizardSteps[activeStepIdx].id === "personalize" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Select Focus Skills
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableSkills.map((sk) => {
                      const isSelected = focusSkills.includes(sk);
                      return (
                        <button
                          key={sk}
                          type="button"
                          onClick={() => toggleSkill(sk)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition border ${
                            isSelected
                              ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
                              : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-500/20"
                          }`}
                        >
                          {sk} {isSelected ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Select Target Industry Verticals
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableIndustries.map((ind) => {
                      const isSelected = targetIndustries.includes(ind);
                      return (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => toggleIndustry(ind)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition border ${
                            isSelected
                              ? "border-indigo-400/45 bg-indigo-400/15 text-indigo-100"
                              : "border-white/10 bg-white/5 text-slate-400 hover:border-indigo-500/20"
                          }`}
                        >
                          {ind} {isSelected ? "✓" : "+"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: REVIEW SETUP */}
            {wizardSteps[activeStepIdx].id === "review" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Title & Career Stage</span>
                  <p className="text-sm font-bold text-white mt-1">{headline}</p>
                  <p className="text-xs text-cyan-300 uppercase tracking-wide font-semibold mt-0.5">
                    {experienceLevel} Level
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Target Role Focus</span>
                  <p className="text-sm font-bold text-white mt-1">{targetRole}</p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Selected Focus Tech</span>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {focusSkills.join(", ") || "No skills selected"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Industry Domains</span>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {targetIndustries.join(", ") || "No industries selected"}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Action Buttons */}
        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={activeStepIdx === 0}
            className="rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase text-slate-300 hover:bg-white/10 hover:text-white transition disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>

          {activeStepIdx === wizardSteps.length - 1 ? (
            <button
              type="button"
              onClick={handleLaunchDashboard}
              disabled={saving}
              className="btn-glow text-xs font-bold uppercase tracking-wider px-6 py-3 disabled:opacity-50"
            >
              {saving ? "Finalizing Profile..." : "Launch Mission Control ✓"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-3xl bg-white text-slate-950 px-5 py-3 text-xs font-bold uppercase hover:bg-slate-200 transition flex items-center gap-1.5"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Slide Navigation Micro-indicators */}
      <div className="mt-6 flex justify-center gap-2">
        {wizardSteps.map((s, idx) => (
          <span
            key={s.id}
            className={`h-2 rounded-full transition-all duration-300 ${
              activeStepIdx === idx ? "w-6 bg-cyan-300" : "w-2 bg-white/20"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

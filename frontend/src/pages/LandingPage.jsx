import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Download,
  Sparkles,
  Zap,
  TrendingUp,
  GitBranch,
  Globe,
  MessageCircle,
  Mail,
  Sun,
  Moon,
  CheckCircle2,
  Award,
  Terminal,
  Play,
  PlayCircle,
  RefreshCw,
  Volume2,
  AlertCircle,
  FileSearch,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Check,
  Users,
  ShieldAlert,
  Cpu
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

// Animation Presets
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1 }
};

// Database mockups
const trustBadges = ["SOC2 Certified", "GDPR Aligned", "Privacy First", "Enterprise Safe"];
const companies = ["Google", "Tesla", "Amazon", "Deloitte", "Microsoft", "Apple"];

const benefits = [
  {
    title: "Instant PDF Export",
    description: "Export high-fidelity ATS-optimized resumes in single-click.",
    icon: Download
  },
  {
    title: "AI Bullets Optimizer",
    description: "Rewrite generic work experience with strong quantifiable STAR achievements.",
    icon: Sparkles
  },
  {
    title: "Drag & Drop Layout",
    description: "Reorder experiences, projects, and skills to target different roles instantly.",
    icon: Zap
  },
  {
    title: "Historical Scoring",
    description: "Track your ATS score improvement metrics over multiple application revisions.",
    icon: TrendingUp
  }
];

const templateShowcase = [
  {
    name: "Modern Edge",
    role: "Product Designer / Frontend",
    description: "High-contrast styling with sleek left accent bars tailored for high-growth tech firms.",
    preview: {
      theme: "cyan",
      layout: "Left-bar"
    }
  },
  {
    name: "Classic Pro",
    role: "Management / Enterprise",
    description: "Conservative, single-column design structured specifically for heavy corporate screening.",
    preview: {
      theme: "indigo",
      layout: "Single-column"
    }
  },
  {
    name: "Minimal Clean",
    role: "Software Engineer / Architect",
    description: "Ultra-lean spacing prioritizing code stacks, system architectures, and metrics.",
    preview: {
      theme: "violet",
      layout: "Compact"
    }
  }
];

const testimonials = [
  {
    name: "Ava Martinez",
    role: "Product Designer",
    quote: "The ATS scanning details helped me discover key missing keywords, getting me Google & Figma loops in weeks.",
    company: "Figma",
    rating: 5,
    avatar: "AM"
  },
  {
    name: "Jordan Lee",
    role: "Fullstack Engineer",
    quote: "The voice AI interview simulator was exceptionally realistic. Practiced my STAR answers and crushed the Stripe round.",
    company: "Stripe",
    rating: 5,
    avatar: "JL"
  },
  {
    name: "Priya Sharma",
    role: "Growth PM",
    quote: "Job match semantic analytics showed me exactly where my system skills were missing. Closed the gap and landed the offer.",
    company: "Notion",
    rating: 5,
    avatar: "PS"
  }
];

const integrations = ["LinkedIn", "Notion", "Google Drive", "Dropbox", "DocuSign", "Calendly"];

const faqs = [
  {
    q: "How does the ATS Scanner evaluate my resume score?",
    a: "Our ATS Engine parses your resume formatting, layout, section headings, and semantic keyword density against target job domains. It scores candidates out of 100 based on standard recruiter screening logic to ensure maximum visibility."
  },
  {
    q: "Can I customize templates for different industries?",
    a: "Absolutely. We offer templates structured for corporate sectors (Classic Pro), tech-startups (Modern Edge), and concise formats (Minimal Clean). All designs use standard fonts and layouts vetted for high parsing fidelity."
  },
  {
    q: "How does the Job Match Pro semantic blending work?",
    a: "It blends standard keyword-matching checks with advanced LLM semantic reasoning. It checks not just the presence of specific words, but also experience level depth, project complexity, and core competencies."
  },
  {
    q: "Is my personal work history and chat data secure?",
    a: "Data privacy is our top priority. All uploaded documents, profiles, and interview transcripts are encrypted in transit and at rest. We never share your data with recruiters or sell it to third parties."
  },
  {
    q: "How does the AI Coach remember my focus roles?",
    a: "The AI Career Coach retains persistent thread history connected directly to your profile personalization variables. It recalls your target roles, industry, and missing skills to guide your next actions."
  },
  {
    q: "Does the Cover Letter builder write custom letters for every job?",
    a: "Yes. It parses the company job requirements and merges them directly with your resume achievements, producing cohesive, tailored, and fully custom cover letters optimized for the role."
  }
];

const pricing = [
  {
    name: "Starter",
    price: "$0",
    period: "Always free",
    description: "Essential career acceleration tools.",
    features: ["1 resume upload", "Basic ATS scoring", "Standard template", "5 AI Coach messages"],
    highlight: false
  },
  {
    name: "Pro",
    price: "$18",
    period: "per month",
    description: "Full suite for active job seekers.",
    features: ["Unlimited resumes", "Advanced ATS 2.0 insights", "Full template access", "Unlimited AI Coach", "Custom Cover Letters", "Skill Gap timelines"],
    highlight: true
  },
  {
    name: "Teams",
    price: "$39",
    period: "per seat / mo",
    description: "Analytics tools for cohort training.",
    features: ["Cohort analytics panel", "Admin seats controls", "Shared benchmarks", "Priority support API"],
    highlight: false
  }
];

// Interactive Showcase Databases
const atsScenarios = [
  {
    name: "Software Engineer",
    text: "Developed web application using React and JavaScript. Fixed bugs.",
    scoreBefore: 42,
    scoreAfter: 91,
    diffDeleted: "Developed web application using React and JavaScript. Fixed bugs.",
    diffAdded: "Architected modern MERN stack dashboard for 12K active users, leveraging React Query and Tailwind to reduce page load time by 42%.",
    missingKeywords: ["React Query", "Tailwind CSS", "MERN Stack", "Page Load optimization"]
  },
  {
    name: "Product Designer",
    text: "Created designer assets. Handed designs to engineering team.",
    scoreBefore: 38,
    scoreAfter: 89,
    diffDeleted: "Created designer assets. Handed designs to engineering team.",
    diffAdded: "Established visual design system in Figma, streamlining cross-functional handoffs to accelerate frontend engineering sprints by 35%.",
    missingKeywords: ["Design Systems", "Figma Components", "Cross-Functional Collaboration", "Sprints Agile"]
  }
];

const mockCoachPrompts = [
  {
    label: "Google Interview Prep",
    question: "How do I prepare for a systems design role at Google?",
    answer: "Focus on highly scalable services. Be sure to structure your answers around the **STAR methodology**:\n- **Situation**: Define high-throughput limits (e.g. 50K Requests/sec).\n- **Task**: Scope exact system boundaries and resource limits.\n- **Action**: Outline database caching layers (Redis), query optimization, and load balancers.\n- **Result**: Quantify improvements (e.g. 99th percentile latency under 120ms)."
  },
  {
    label: "Quantify Resume Bullets",
    question: "Give me a framework to rewrite my resume accomplishments.",
    answer: "Use the **STAR + Metrics Formula**:\n- **Generic Bullet**: *'Designed and shipped product updates.'*\n- **AI Premium Bullet**: *'Led collaborative redesign of payment checkout screen in React, driving conversion metrics up by **18.4%** while reducing click dropoffs by **25%**.'*"
  }
];

// Dynamic Components
const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-white/10 bg-white/5 transition hover:border-cyan-500/20"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition rounded-2xl"
      >
        <p className="font-semibold text-slate-100">{q}</p>
        <ChevronDown
          className={`h-5 w-5 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-6 py-5 bg-slate-950/20 text-sm leading-relaxed text-slate-300">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const useCountUp = (target, trigger, duration = 1200) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let start = null;
    let frame;

    const tick = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      setValue(Math.round(target * progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, trigger, duration]);

  return value;
};

const CountUpStat = ({ target, label, suffix = "", delay = 0 }) => {
  const [triggered, setTriggered] = useState(false);
  const val = useCountUp(target, triggered);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="premium-card text-center p-6"
    >
      <p className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
        {val}
        {suffix}
      </p>
      <p className="mt-2 text-xs uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
    </motion.div>
  );
};

// Main Export
export default function LandingPage() {
  const [isLight, setIsLight] = useState(false);

  // ATS Showcase states
  const [atsScenarioIdx, setAtsScenarioIdx] = useState(0);
  const [atsScore, setAtsScore] = useState(42);
  const [isAtsScanning, setIsAtsScanning] = useState(false);
  const [atsCompleted, setAtsCompleted] = useState(false);

  // AI Coach Simulator states
  const [coachActivePromptIdx, setCoachActivePromptIdx] = useState(-1);
  const [coachResponseText, setCoachResponseText] = useState("Click on one of the quick prompts to test our interactive Career Coach simulator.");
  const [isCoachTyping, setIsCoachTyping] = useState(false);

  // Interview Simulator states
  const [isInterviewRunning, setIsInterviewRunning] = useState(false);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewAudioActive, setInterviewAudioActive] = useState(false);

  // Job Match simulator states
  const [isMatching, setIsMatching] = useState(false);
  const [matchDone, setMatchDone] = useState(false);
  const [jobMatchScore, setJobMatchScore] = useState(0);

  // Cover Letter builder states
  const [coverLetterJd, setCoverLetterJd] = useState(
    "Looking for a Senior Product Engineer to establish our visual design system components and guide agile team sprints in Figma."
  );
  const [isGeneratingCl, setIsGeneratingCl] = useState(false);
  const [clCompleted, setClCompleted] = useState(false);
  const [clCopied, setClCopied] = useState(false);

  useEffect(() => {
    const className = "landing-light";
    if (isLight) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => document.body.classList.remove(className);
  }, [isLight]);

  // ATS trigger simulator
  const handleAtsScan = () => {
    setIsAtsScanning(true);
    setAtsCompleted(false);
    let count = 42;
    const interval = setInterval(() => {
      count += 5;
      if (count >= atsScenarios[atsScenarioIdx].scoreAfter) {
        clearInterval(interval);
        setAtsScore(atsScenarios[atsScenarioIdx].scoreAfter);
        setIsAtsScanning(false);
        setAtsCompleted(true);
      } else {
        setAtsScore(count);
      }
    }, 120);
  };

  // Switch ATS scenario
  useEffect(() => {
    setAtsScore(atsScenarios[atsScenarioIdx].scoreBefore);
    setAtsCompleted(false);
  }, [atsScenarioIdx]);

  // AI Coach trigger simulator
  const handleCoachPrompt = (idx) => {
    setCoachActivePromptIdx(idx);
    setIsCoachTyping(true);
    setCoachResponseText("");
    const targetText = mockCoachPrompts[idx].answer;
    let i = 0;
    const timer = setInterval(() => {
      setCoachResponseText((prev) => prev + targetText.charAt(i));
      i++;
      if (i >= targetText.length) {
        clearInterval(timer);
        setIsCoachTyping(false);
      }
    }, 12);
  };

  // Interview simulation rounds
  useEffect(() => {
    let t1, t2;
    if (isInterviewRunning) {
      setInterviewStep(1); // Play Question
      setInterviewAudioActive(true);
      t1 = setTimeout(() => {
        setInterviewStep(2); // Recording user response
        setInterviewAudioActive(false);
        t2 = setTimeout(() => {
          setInterviewStep(3); // Result ready
        }, 4000);
      }, 3000);
    }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isInterviewRunning]);

  // Job Match Simulation
  const handleJobMatchScan = () => {
    setIsMatching(true);
    setMatchDone(false);
    setJobMatchScore(0);
    let cur = 0;
    const timer = setInterval(() => {
      cur += 4;
      if (cur >= 89) {
        clearInterval(timer);
        setJobMatchScore(89);
        setIsMatching(false);
        setMatchDone(true);
      } else {
        setJobMatchScore(cur);
      }
    }, 80);
  };

  // Cover Letter generation
  const handleClGenerate = () => {
    setIsGeneratingCl(true);
    setClCompleted(false);
    setTimeout(() => {
      setIsGeneratingCl(false);
      setClCompleted(true);
    }, 1800);
  };

  return (
    <main className="landing-page relative min-h-screen overflow-hidden text-white">
      {/* Background Animated Gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.16),transparent_50%)]"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.2),transparent_40%)]"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
        {/* Floating Particles */}
        <motion.div
          className="absolute left-[8%] top-[18%] h-14 w-14 rounded-full border border-cyan-400/25 bg-cyan-400/10 backdrop-blur-sm"
          animate={{ y: [0, -20, 0], x: [0, 12, 0], rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[12%] top-[24%] h-10 w-10 rounded-2xl border border-violet-400/25 bg-violet-400/10 backdrop-blur-sm"
          animate={{ y: [0, 16, 0], rotate: [0, 18, -12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-[30%] top-[70%] h-8 w-8 rounded-full border border-indigo-400/20 bg-indigo-400/5 backdrop-blur-xs"
          animate={{ y: [-15, 15, -15] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:py-8">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/25">
            <Cpu className="h-5 w-5 text-slate-950 stroke-[2.5px]" />
          </div>
          <span className="text-xl font-extrabold tracking-wide bg-gradient-to-r from-cyan-200 via-indigo-200 to-white bg-clip-text text-transparent">
            AI Career Copilot
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsLight((prev) => !prev)}
            className="rounded-xl border border-white/15 bg-white/5 p-2.5 text-slate-200 backdrop-blur hover:bg-white/10 hover:border-cyan-300/35 transition"
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <Link
            to="/auth"
            className="hidden sm:inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 backdrop-blur hover:bg-white/10 hover:border-cyan-300/35 hover:text-cyan-200 transition"
          >
            Sign in
          </Link>
          <Link to="/auth" className="btn-glow text-sm px-5 py-2.5">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid w-full max-w-7xl gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:items-center lg:pt-16">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-start"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Premium AI Career Suite
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.15] sm:text-5xl md:text-6xl tracking-tight text-white">
            Architect Your
            <span className="block mt-1 bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Career Velocity
            </span>
            With AI Intelligence
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">
            An advanced, startup-grade AI platform for ATS optimization, custom resume architecture, voice interviews mockups, and persistent coaching feedback. Fast, structured, and recruiter ready.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 w-full sm:w-auto">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
              <Link to="/auth" className="btn-glow inline-flex w-full justify-center text-sm font-bold tracking-wide">
                Start Accelerating Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </motion.div>
            <a
              href="#features"
              className="w-full sm:w-auto text-center rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur hover:bg-white/10 hover:border-cyan-300/35 hover:text-cyan-200 transition"
            >
              Explore Features Showcase
            </a>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 w-full border-t border-white/10 pt-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold mb-3">Enterprise Standards</p>
            <div className="flex flex-wrap gap-2.5">
              {trustBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-200 font-semibold"
                >
                  🛡️ {badge}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Hero Interactive Showcase Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative lg:ml-6"
        >
          <div className="absolute -left-12 -top-12 -z-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-[60px]" />
          <div className="absolute -bottom-12 -right-12 -z-10 h-52 w-52 rounded-full bg-indigo-500/15 blur-[70px]" />

          <div className="premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold">MISSION CONTROL PREVIEW</p>
                <h3 className="text-lg font-bold text-white mt-0.5">Live Career Readiness Index</h3>
              </div>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="grid gap-4">
              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-cyan-500/35 bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 p-4 flex items-center justify-between transition-all"
              >
                <div>
                  <span className="text-xs text-cyan-200 uppercase tracking-wider font-semibold">ATS Profile Quality</span>
                  <p className="text-2xl font-black text-white mt-0.5">89 / 100</p>
                </div>
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/25 px-2.5 py-1 text-[10px] font-bold text-cyan-100 uppercase tracking-widest">
                  Excellent
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-indigo-500/35 bg-gradient-to-r from-indigo-500/15 to-indigo-500/5 p-4 flex items-center justify-between transition-all"
              >
                <div>
                  <span className="text-xs text-indigo-200 uppercase tracking-wider font-semibold">Job Match Readiness</span>
                  <p className="text-2xl font-black text-white mt-0.5">92% Match</p>
                </div>
                <div className="rounded-xl border border-indigo-400/30 bg-indigo-400/25 px-2.5 py-1 text-[10px] font-bold text-indigo-100 uppercase tracking-widest">
                  ✓ Apply Ready
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="rounded-2xl border border-violet-500/35 bg-gradient-to-r from-violet-500/15 to-violet-500/5 p-4 flex items-center justify-between transition-all"
              >
                <div>
                  <span className="text-xs text-violet-200 uppercase tracking-wider font-semibold">Interview Performance</span>
                  <p className="text-2xl font-black text-white mt-0.5">+2.4 Improvement</p>
                </div>
                <div className="rounded-xl border border-violet-400/30 bg-violet-400/25 px-2.5 py-1 text-[10px] font-bold text-violet-100 uppercase tracking-widest">
                  Active Trend
                </div>
              </motion.div>
            </div>

            <div className="mt-5 rounded-2xl bg-white/5 border border-white/5 p-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                AI Coach suggests: <strong className="text-white">Run ATS optimization</strong> to close design ops skill gaps.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature Navigation / Benefits */}
      <section id="features" className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">CORE CAPABILITIES</p>
          <h2 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
            Designed for Recruiter & ATS Signals
          </h2>
          <p className="mt-3 text-slate-400">
            A unified workflow engineered to build structural confidence, clear screening loops, and match roles effectively.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <motion.article
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.08] hover:border-cyan-500/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 text-cyan-300 transition group-hover:text-cyan-200 group-hover:scale-110">
                  <Icon className="h-6 w-6 stroke-[1.8px]" />
                </div>
                <h4 className="text-lg font-bold text-white">{b.title}</h4>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{b.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 1: ATS SHOWCASE SIMULATOR */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 1 • ATS INTELLIGENCE</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              ATS 2.0 Parser & Score Visualizer
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Verify your resume formatting compatibility and keyword density with our real-time scanning simulation. Highlight missing tags and generate instant STAR accomplishments to optimize results.
            </p>

            {/* Simulated Selector */}
            <div className="mt-6 flex flex-wrap gap-2 w-full">
              {atsScenarios.map((sc, i) => (
                <button
                  key={sc.name}
                  onClick={() => {
                    setAtsScenarioIdx(i);
                    setAtsCompleted(false);
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition border ${
                    atsScenarioIdx === i
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20"
                  }`}
                >
                  {sc.name} Scenario
                </button>
              ))}
            </div>

            <button
              onClick={handleAtsScan}
              disabled={isAtsScanning}
              className="btn-glow mt-6 inline-flex text-xs font-bold tracking-wider uppercase px-5 py-3 w-full sm:w-auto justify-center"
            >
              {isAtsScanning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Scanning Resume...
                </>
              ) : (
                "Trigger Scan Simulation"
              )}
            </button>
          </div>

          {/* Simulated Scan Panel */}
          <div className="premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            {/* Mock Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <FileSearch className="h-4 w-4 text-cyan-300" /> ATS Analyzer console
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/10 text-slate-300">
                MERN STACK V2
              </span>
            </div>

            {/* Interactive Panel Content */}
            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 relative overflow-hidden">
                {isAtsScanning && (
                  <motion.div
                    className="absolute left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_#22d3ee]"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                  />
                )}
                <p className="text-xs uppercase text-slate-500 font-bold tracking-wider">Raw Bullet Input</p>
                <p className="text-sm mt-1.5 text-slate-300 font-mono italic">
                  "{atsScenarios[atsScenarioIdx].text}"
                </p>
              </div>

              {/* Dynamic Score Ring Meter */}
              <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <div className="relative h-28 w-28 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#22d3ee"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={263.8}
                      strokeDashoffset={263.8 - (263.8 * atsScore) / 100}
                      transition={{ duration: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{atsScore}</span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">ATS SCORE</span>
                  </div>
                </div>

                <div className="flex-1 w-full text-center sm:text-left">
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Evaluation status</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {isAtsScanning
                      ? "AI parsing..."
                      : atsCompleted
                      ? "✨ Optimal Score Ready!"
                      : "Awaiting trigger command..."}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {atsCompleted
                      ? "STAR metrics satisfied. Bullet achieves high parsing clarity."
                      : "Quantifiable numbers are missing from candidate input."}
                  </p>
                </div>
              </div>

              {/* Before/After Diff Block */}
              {atsCompleted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs">
                    <p className="font-bold text-rose-300 uppercase tracking-widest mb-1">DELETED UNOPTIMIZED</p>
                    <p className="text-rose-100 italic">"{atsScenarios[atsScenarioIdx].diffDeleted}"</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                    <p className="font-bold text-emerald-300 uppercase tracking-widest mb-1">AI PREMIUM STAR BULLET REWRITE</p>
                    <p className="text-emerald-100 font-semibold leading-relaxed">
                      "{atsScenarios[atsScenarioIdx].diffAdded}"
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 2: RESUME BUILDER SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="lg:order-2 flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 2 • DYNAMIC CREATION</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              Professional Resume Architect
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Build your resume through clean form categories. Dynamically arrange sections and manage critical tabs such as Basic Info, Experience, Education, Projects, Certifications, Links, and Templates.
            </p>
            <div className="mt-6 space-y-3.5 w-full">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm text-slate-200">Dedicated Certifications tab for professional credentials.</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm text-slate-200">Validated social/portfolio links with quick inputs.</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm text-slate-200">Real-time side-by-side builder compilation previews.</span>
              </div>
            </div>
            <Link to="/auth" className="btn-glow mt-8 text-xs font-bold tracking-wide uppercase">
              Launch Live Builder
            </Link>
          </div>

          {/* Builder Simulated Preview */}
          <div className="lg:order-1 premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            {/* Mock Tabs */}
            <div className="flex items-center gap-1 border-b border-white/10 pb-3 mb-5 overflow-x-auto whitespace-nowrap scrollbar-none">
              {["Info", "Experience", "Projects", "Certs", "Links", "Style"].map((t, idx) => (
                <span
                  key={t}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border ${
                    idx === 3
                      ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-300"
                      : "border-white/5 bg-white/5 text-slate-400"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-slate-950/20 p-4">
                <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">ACTIVE CREDENTIALS FORM</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Credential Name</label>
                    <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
                      AWS Certified Solutions Architect
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Issuing Entity</label>
                    <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
                      Amazon Web Services
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Expiration Date</label>
                    <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">
                      2029-05-29
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500">Verification URL</label>
                    <div className="mt-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-cyan-300 font-mono truncate">
                      aws.amazon.com/verify/10293
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulated PDF Layout Preview */}
              <div className="rounded-xl border border-white/5 bg-white/5 p-4 relative overflow-hidden">
                <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-2">Live Canvas Preview</p>
                <div className="bg-slate-950/40 rounded-lg p-3 text-[10px] font-mono space-y-2 border border-white/5">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <div>
                      <p className="font-bold text-white text-xs">AWS Certified Solutions Architect</p>
                      <p className="text-slate-400">Amazon Web Services • ID: AWS-90182</p>
                    </div>
                    <span className="text-cyan-300 font-semibold">Active</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Issued: May 2026</span>
                    <span>Expires: May 2029</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 3: RESUME TEMPLATES SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 3 • THEME DESIGNS</span>
          <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
            Vetted Recruiter Layouts
          </h3>
          <p className="mt-3 text-slate-300">
            Choose a visual architecture designed precisely around industry screening guidelines. Switch styles seamlessly without losing details.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {templateShowcase.map((t, idx) => (
            <motion.article
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              whileHover={{ y: -6 }}
              className="premium-card p-6 flex flex-col justify-between group hover:border-cyan-400/30"
            >
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">TEMPLATE STYLING</span>
                <h4 className="text-xl font-bold text-white mt-1 group-hover:text-cyan-300 transition-colors">
                  {t.name}
                </h4>
                <p className="text-xs text-cyan-200 mt-0.5 uppercase tracking-wide font-semibold">{t.role}</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{t.description}</p>
              </div>

              <div className="mt-6 space-y-3">
                {/* Mock Visual Layout */}
                <div className="h-28 rounded-lg bg-slate-950/40 border border-white/5 p-3 flex flex-col justify-between">
                  <div className="flex gap-1.5 items-center">
                    <span className="h-2 w-2 rounded-full bg-cyan-300" />
                    <span className="h-1.5 w-12 rounded bg-white/10" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block h-1 w-full rounded bg-white/5" />
                    <span className="block h-1 w-5/6 rounded bg-white/5" />
                    <span className="block h-1 w-4/5 rounded bg-white/5" />
                  </div>
                  <div className="flex gap-2">
                    <span className="h-3 w-10 rounded-sm bg-white/5" />
                    <span className="h-3 w-12 rounded-sm bg-white/5" />
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Layout: <strong className="text-slate-300">{t.preview.layout}</strong></span>
                  <span className="text-cyan-300 group-hover:underline">Preview Layout →</span>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 4: AI INTERVIEW SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 4 • AUDIO DIALOGUES</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              Voice AI Interview simulator
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Train with real-world panel questions customized by target companies. Simulate voice delivery and receive scored analytics evaluating speech speed, confidence, fillers, and clarity.
            </p>

            <button
              onClick={() => {
                setIsInterviewRunning(true);
                setTimeout(() => setIsInterviewRunning(false), 8000);
              }}
              disabled={isInterviewRunning}
              className="btn-glow mt-6 inline-flex text-xs font-bold tracking-wider uppercase px-5 py-3 w-full sm:w-auto justify-center"
            >
              {isInterviewRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Simulator Active...
                </>
              ) : (
                "Trigger Interview Simulation"
              )}
            </button>
          </div>

          {/* Interactive Simulator Screen */}
          <div className="premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-cyan-300" /> Voice Simulator Engine
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-4">
              {/* Question Screen */}
              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                <span className="text-[10px] uppercase font-bold text-cyan-300">INTERVIEWER SYSTEM QUESTION</span>
                <p className="text-sm text-slate-100 font-medium mt-1 leading-relaxed">
                  "Tell me about a time you established cross-functional visual standards to solve developer workflow friction. What were the results?"
                </p>
              </div>

              {/* Active Voice Wave pulse */}
              {isInterviewRunning && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 flex flex-col items-center justify-center space-y-2"
                >
                  <p className="text-xs text-cyan-200 uppercase font-bold tracking-widest">
                    {interviewStep === 1 ? "📢 Playing Question" : "🎙️ Recording response"}
                  </p>
                  <div className="flex items-center gap-1 h-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => (
                      <motion.span
                        key={b}
                        className="w-1 rounded bg-cyan-400"
                        animate={{ height: interviewAudioActive ? [10, 32, 10] : [10, 24, 10] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: b * 0.05,
                          ease: "easeInOut"
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Result display */}
              {(!isInterviewRunning || interviewStep === 3) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid gap-3 sm:grid-cols-3"
                >
                  <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Confidence</p>
                    <p className="text-xl font-bold text-white mt-1">8.6 / 10</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Clarity Fit</p>
                    <p className="text-xl font-bold text-white mt-1">Excellent</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3 text-center">
                    <p className="text-[10px] uppercase text-slate-500 font-bold">Filler Words</p>
                    <p className="text-xl font-bold text-white mt-1">0.5 / min</p>
                  </div>
                  <div className="sm:col-span-3 rounded-xl border border-white/5 bg-white/5 p-3 text-xs leading-relaxed text-slate-300">
                    💡 <strong className="text-white">Interviewer feedback:</strong> Great STAR delivery. Shorten your situation metrics setup to give more time to the technical actions.
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 5: AI COACH SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="lg:order-2 flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 5 • CAREER MENTORSHIP</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              Persistent AI Coach Console
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Consult with a dedicated AI Coach that remembers your target roles, focus skills, and profile history. Navigate prompts tailored around high-growth milestones and interview frameworks.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5 w-full">
              {mockCoachPrompts.map((p, idx) => (
                <button
                  key={p.label}
                  onClick={() => handleCoachPrompt(idx)}
                  disabled={isCoachTyping}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    coachActivePromptIdx === idx
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-500/20"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Chat Console Simulator */}
          <div className="lg:order-1 premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <MessageCircle className="h-4 w-4 text-cyan-300" /> AI Coach Simulator
              </span>
              <span className="text-[10px] font-bold text-slate-500">ACTIVE SESSION</span>
            </div>

            <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
              {/* Coach Bubble */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 text-xs font-black">
                  AC
                </div>
                <div className="flex-1 rounded-2xl border border-white/5 bg-slate-950/30 p-4 text-xs leading-relaxed text-slate-300">
                  Hello! 👋 I'm your AI Career Coach. Click on one of the quick prompts to test our interactive Career Coach simulator.
                </div>
              </div>

              {/* User Bubble */}
              {coachActivePromptIdx >= 0 && (
                <div className="flex gap-3 justify-end">
                  <div className="max-w-[70%] rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-xs text-cyan-50 font-medium">
                    "{mockCoachPrompts[coachActivePromptIdx].question}"
                  </div>
                </div>
              )}

              {/* Bot Response Typing */}
              {coachActivePromptIdx >= 0 && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 text-xs font-black">
                    AC
                  </div>
                  <div className="flex-1 rounded-2xl border border-white/5 bg-slate-950/30 p-4 text-xs leading-relaxed text-slate-100 font-mono whitespace-pre-line">
                    {coachResponseText}
                    {isCoachTyping && <span className="animate-pulse font-black text-cyan-300">|</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 6: JOB MATCH SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 6 • FIT ALIGNMENT</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              Semantic Job Match & Score blending
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Test semantic alignment by matching your profile with job requirements. Combine textual keywords with LLM logic processing. Display a glowing "Apply Ready" badge on matches reaching a score of 75% or higher.
            </p>

            <button
              onClick={handleJobMatchScan}
              disabled={isMatching}
              className="btn-glow mt-6 inline-flex text-xs font-bold tracking-wider uppercase px-5 py-3 w-full sm:w-auto justify-center"
            >
              {isMatching ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Blending Scores...
                </>
              ) : (
                "Run Match Simulation"
              )}
            </button>
          </div>

          {/* Job Match Panel */}
          <div className="premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <span className="text-xs font-semibold text-slate-400">Job Fit Intel</span>
              {matchDone && (
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.2)] animate-[pulse_2s_infinite]"
                >
                  ✓ Apply Ready
                </motion.div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 uppercase tracking-wider font-semibold">Semantic Match Score</span>
                <span className="text-xl font-black text-cyan-300">{jobMatchScore}%</span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
                  style={{ width: `${jobMatchScore}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Scored Metrics */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">AI Skill Gap Match</p>
                  <p className="text-lg font-bold text-white mt-1">{matchDone ? "91%" : "--"}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/20 p-3">
                  <p className="text-[10px] uppercase text-slate-500 font-bold">Logical Text Check</p>
                  <p className="text-lg font-bold text-white mt-1">{matchDone ? "87%" : "--"}</p>
                </div>
              </div>

              {/* Timeline Roadmap */}
              {matchDone && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/5 bg-slate-950/40 p-4"
                >
                  <p className="text-xs uppercase text-slate-400 font-bold tracking-wider mb-3">Timeline Roadmap</p>
                  <div className="space-y-3 text-xs leading-normal">
                    <div className="border-l-2 border-cyan-400/40 pl-3">
                      <p className="font-bold text-cyan-300">Week 1: Visual Design Systems in Figma</p>
                      <p className="text-slate-400">Resources: Figma Advanced Component Architecture</p>
                    </div>
                    <div className="border-l-2 border-cyan-400/40 pl-3">
                      <p className="font-bold text-cyan-300">Week 2: Quantifying Project Sprints</p>
                      <p className="text-slate-400">Resources: Agile Metrics & Engineering STAR logs</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 7: COVER LETTER SHOWCASE */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="lg:order-2 flex flex-col items-start">
            <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 7 • CUSTOM ENCLOSURES</span>
            <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
              AI Cover Letter Generator
            </h3>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Generate cohesive, highly tailored cover letters referencing target requirements directly. Edit templates, export directly to professional formats, and save results in a streamlined interface.
            </p>
            <div className="mt-6 w-full space-y-3">
              <label className="text-[10px] uppercase font-bold text-slate-400">Simulate Job Requirements Input</label>
              <textarea
                value={coverLetterJd}
                onChange={(e) => setCoverLetterJd(e.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-xs outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/30"
              />
            </div>
            <button
              onClick={handleClGenerate}
              disabled={isGeneratingCl}
              className="btn-glow mt-6 inline-flex text-xs font-bold tracking-wider uppercase px-5 py-3 w-full sm:w-auto justify-center"
            >
              {isGeneratingCl ? "Quantifying JD..." : "Generate Cover Letter"}
            </button>
          </div>

          {/* Cover Letter Document Panel */}
          <div className="lg:order-1 premium-card p-6 border-white/15 bg-gradient-to-br from-slate-900/60 to-slate-950/60 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <span className="text-xs font-semibold text-slate-400">Generated Cover Letter Document</span>
              {clCompleted && (
                <button
                  onClick={() => {
                    setClCopied(true);
                    setTimeout(() => setClCopied(false), 2000);
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-slate-300 hover:text-white flex items-center gap-1"
                >
                  {clCopied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy Letter
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/30 p-4 min-h-[220px] flex flex-col justify-center">
              {isGeneratingCl ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-8">
                  <RefreshCw className="h-6 w-6 text-cyan-300 animate-spin" />
                  <p className="text-xs text-slate-400">Blending requirements with resume...</p>
                </div>
              ) : clCompleted ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] font-mono leading-relaxed space-y-3 text-slate-300"
                >
                  <p>Dear Hiring Manager,</p>
                  <p>
                    I am writing to express my strong interest in the Senior Product Engineer position. My background in visual component design systems in Figma and collaborative sprint optimizations aligns perfectly with your engineering mission.
                  </p>
                  <p>
                    During my previous experience, I architected a modern MERN stack dashboard in React, utilizing custom Figma component handoffs to reduce overall developer sprint friction by 35%. I am eager to bring these systems design skills to your team.
                  </p>
                  <p>Sincerely,<br />Your Candidate Profile</p>
                </motion.div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-500 italic">Enter requirements above and click 'Generate' to see simulated output.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 8: TESTIMONIALS */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 8 • USER RESULTS</span>
          <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
            Success At Top Companies
          </h3>
          <p className="mt-3 text-slate-300">
            Discover how professionals use our platform to optimize their resumes and clear panel screenings.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, idx) => (
            <motion.article
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="premium-card p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-cyan-300">★</span>
                  ))}
                </div>
                <p className="text-sm italic text-slate-200 leading-relaxed">
                  "{t.quote}"
                </p>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-white/5 pt-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-xs uppercase">
                  {t.avatar}
                </div>
                <div>
                  <h5 className="text-sm font-bold text-white">{t.name}</h5>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                    {t.role} • <strong className="text-cyan-300">{t.company}</strong>
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Trust Badges Company logo stream */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16 border-t border-white/10 bg-slate-950/20">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-slate-500 font-bold mb-8">
          OUR MEMBERS ACHIEVE CALLBACKS FROM TOP BRANDS
        </p>
        <div className="flex items-center justify-center gap-8 overflow-x-auto flex-wrap">
          {companies.map((c, idx) => (
            <motion.div
              key={c}
              initial={{ opacity: 0.4, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-xs font-extrabold text-slate-300 uppercase tracking-widest hover:border-cyan-400/20 transition cursor-default"
            >
              {c}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Count-Up Statistics */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 border-t border-white/10">
        <div className="grid gap-6 sm:grid-cols-3">
          <CountUpStat target={12450} label="Active Professionals" suffix="+" />
          <CountUpStat target={92} label="Average Improvement score" suffix="%" delay={0.1} />
          <CountUpStat target={285000} label="Simulated Interviews Run" suffix="+" delay={0.2} />
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 9: FAQ */}
      {/* ========================================== */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-6 py-20 border-t border-white/10">
        <div className="mb-12 text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">SHOWCASE 9 • SYSTEM GUIDE</span>
          <h3 className="mt-2 text-3xl font-extrabold text-white md:text-4xl">
            Frequently Asked Questions
          </h3>
          <p className="mt-3 text-slate-400">
            Find details regarding parsing algorithms, templates customization, and privacy.
          </p>
        </div>

        <div className="grid gap-4">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16 mb-20">
        <div className="relative rounded-3xl border border-cyan-400/25 bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 p-8 md:p-12 overflow-hidden text-center">
          <div className="absolute -left-20 -top-20 -z-10 h-52 w-52 bg-cyan-400/10 blur-[80px]" />
          <div className="absolute -right-20 -bottom-20 -z-10 h-52 w-52 bg-indigo-500/10 blur-[80px]" />

          <h3 className="text-3xl font-extrabold text-white md:text-4xl">
            Ready to Clear Recruiters screening?
          </h3>
          <p className="mt-4 text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
            Create your account today and launch your guided onboarding checklist to unlock live ATS score optimization.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/auth" className="btn-glow text-sm font-bold tracking-wide uppercase px-8 py-4">
              Get Started Free Now
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================== */}
      {/* SHOWCASE 10: FOOTER */}
      {/* ========================================== */}
      <footer className="relative z-20 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-7xl px-6 py-16">
          <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-4 mb-12">
            {/* Column 1: Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
                  <Cpu className="h-4.5 w-4.5 stroke-[2.5px]" />
                </div>
                <span className="font-extrabold tracking-wide text-white">AI Career Copilot</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Premium startup-quality MERN career intelligence platform. Optimize your resume for professional screening.
              </p>
              <div className="mt-6 flex gap-3">
                <a href="#" className="rounded-lg bg-white/5 border border-white/10 p-2 text-slate-400 hover:text-cyan-300 transition">
                  <GitBranch className="h-4 w-4" />
                </a>
                <a href="#" className="rounded-lg bg-white/5 border border-white/10 p-2 text-slate-400 hover:text-cyan-300 transition">
                  <Globe className="h-4 w-4" />
                </a>
                <a href="#" className="rounded-lg bg-white/5 border border-white/10 p-2 text-slate-400 hover:text-cyan-300 transition">
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Product */}
            <div>
              <h4 className="mb-4 text-xs uppercase font-extrabold tracking-widest text-slate-200">Suite Modules</h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li><Link to="/builder" className="hover:text-cyan-300 transition-colors">Resume Architect</Link></li>
                <li><Link to="/ats" className="hover:text-cyan-300 transition-colors">ATS 2.0 Analyzer</Link></li>
                <li><Link to="/job-match" className="hover:text-cyan-300 transition-colors">Job Match Analytics</Link></li>
                <li><Link to="/interview" className="hover:text-cyan-300 transition-colors">Voice AI Interview</Link></li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div>
              <h4 className="mb-4 text-xs uppercase font-extrabold tracking-widest text-slate-200">Resources</h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li><a href="#" className="hover:text-cyan-300 transition-colors">STAR Rewrite Guide</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Templates Vetting</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">System Benchmarks</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Interactive API Docs</a></li>
              </ul>
            </div>

            {/* Column 4: Legal & Contact */}
            <div>
              <h4 className="mb-4 text-xs uppercase font-extrabold tracking-widest text-slate-200">Legal & Support</h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-cyan-300 transition-colors">Cookie Policy</a></li>
                <li><a href="mailto:support@careercopilot.com" className="hover:text-cyan-300 transition-colors flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> support@careercopilot.com</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex items-center justify-between gap-4 text-xs text-slate-500 flex-col sm:flex-row">
            <p>© {new Date().getFullYear()} AI Career Copilot. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/auth" className="hover:text-cyan-300 transition">Sign In</Link>
              <Link to="/auth" className="font-semibold text-cyan-400 hover:text-cyan-300 transition">Start Free</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

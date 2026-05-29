import { Link } from "react-router-dom";

const cards = [
  {
    title: "Build Resume",
    description: "Create and edit your resume with structured sections.",
    to: "/builder",
    cta: "Open Builder"
  },
  {
    title: "Upload Resume",
    description: "Upload PDF or DOCX with drag-and-drop parsing.",
    to: "/upload",
    cta: "Open Upload"
  },
  {
    title: "Templates",
    description: "Choose visual style and customization presets.",
    to: "/templates",
    cta: "Browse Templates"
  },
  {
    title: "ATS Analysis",
    description: "Run ATS checks and see score, issues, and suggestions.",
    to: "/ats",
    cta: "Analyze Resume"
  }
];

export default function ResumeHubPage() {
  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Resume Module</p>
        <h1 className="mt-2 text-4xl font-extrabold">Resume Workspace</h1>
        <p className="mt-2 text-slate-300">Create, upload, style, and analyze your resume from one place.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.title} className="premium-card">
            <h2 className="text-2xl font-bold text-cyan-100">{card.title}</h2>
            <p className="mt-3 text-slate-300">{card.description}</p>
            <Link to={card.to} className="btn-glow mt-5 inline-block">
              {card.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

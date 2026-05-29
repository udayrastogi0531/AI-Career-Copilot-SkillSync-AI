import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const templates = [
  {
    id: "modern",
    name: "Modern Edge",
    description: "Bold headings and high contrast for product and frontend roles."
  },
  {
    id: "classic",
    name: "Classic Pro",
    description: "Traditional structure optimized for ATS and enterprise hiring."
  },
  {
    id: "minimal",
    name: "Minimal Clean",
    description: "Lightweight, clean presentation for concise storytelling."
  }
];

// Sample resume data for preview
const sampleResume = {
  fullName: "Alex Johnson",
  email: "alex@example.com",
  phone: "(555) 123-4567",
  summary: "Product-focused engineer with 5+ years building scalable systems and leading cross-functional teams.",
  skills: "React, Node.js, TypeScript, AWS, Docker, PostgreSQL, System Design, Product Strategy",
  experience: [
    {
      company: "Tech Corp",
      role: "Senior Product Engineer",
      startDate: "2022",
      endDate: "Present",
      description: "Led development of customer dashboard serving 50K+ users. Improved API performance by 40%."
    },
    {
      company: "StartupXYZ",
      role: "Full Stack Engineer",
      startDate: "2019",
      endDate: "2022",
      description: "Built and shipped 3 major product features. Mentored 2 junior engineers."
    }
  ],
  education: [
    {
      institution: "State University",
      degree: "BS",
      fieldOfStudy: "Computer Science",
      graduationYear: "2019"
    }
  ],
  certifications: [
    { credential: "AWS Solutions Architect Associate", issuer: "Amazon AWS" }
  ]
};

// Modern Template Component
const ModernTemplate = () => (
  <div className="space-y-6 p-8 bg-white text-gray-900 font-sans text-sm">
    {/* Header */}
    <div className="border-b-4 border-cyan-500 pb-4">
      <h1 className="text-3xl font-black text-gray-900">{sampleResume.fullName}</h1>
      <p className="text-xs text-gray-600 mt-1 tracking-wider">
        {sampleResume.email} • {sampleResume.phone}
      </p>
    </div>

    {/* Summary */}
    <div>
      <p className="text-gray-700 leading-relaxed">{sampleResume.summary}</p>
    </div>

    {/* Experience */}
    <div>
      <h2 className="text-lg font-black text-gray-900 mb-3 uppercase tracking-widest">Experience</h2>
      <div className="space-y-3">
        {sampleResume.experience.map((exp, idx) => (
          <div key={idx} className="border-l-2 border-cyan-500 pl-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900">{exp.role}</p>
                <p className="text-xs text-gray-600">{exp.company}</p>
              </div>
              <p className="text-xs text-gray-600">{exp.startDate}–{exp.endDate}</p>
            </div>
            <p className="text-xs text-gray-700 mt-1">{exp.description}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Skills */}
    <div>
      <h2 className="text-lg font-black text-gray-900 mb-2 uppercase tracking-widest">Skills</h2>
      <p className="text-xs text-gray-700 leading-relaxed">{sampleResume.skills}</p>
    </div>

    {/* Education */}
    <div>
      <h2 className="text-lg font-black text-gray-900 mb-2 uppercase tracking-widest">Education</h2>
      {sampleResume.education.map((edu, idx) => (
        <div key={idx} className="text-xs">
          <p className="font-bold text-gray-900">{edu.degree} in {edu.fieldOfStudy}</p>
          <p className="text-gray-600">{edu.institution} • {edu.graduationYear}</p>
        </div>
      ))}
    </div>
  </div>
);

// Classic Template Component
const ClassicTemplate = () => (
  <div className="space-y-4 p-8 bg-white text-gray-900 font-serif text-xs">
    {/* Header */}
    <div className="text-center pb-4 border-b border-gray-400">
      <h1 className="text-2xl font-bold text-gray-900">{sampleResume.fullName}</h1>
      <p className="text-xs text-gray-700 mt-2">
        {sampleResume.email} | {sampleResume.phone}
      </p>
    </div>

    {/* Summary */}
    <div>
      <p className="text-gray-800 leading-relaxed">{sampleResume.summary}</p>
    </div>

    {/* Experience */}
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-2">PROFESSIONAL EXPERIENCE</h2>
      <div className="space-y-2">
        {sampleResume.experience.map((exp, idx) => (
          <div key={idx}>
            <div className="flex justify-between">
              <p className="font-bold text-gray-900">{exp.role}</p>
              <p className="text-gray-700">{exp.startDate}–{exp.endDate}</p>
            </div>
            <p className="text-gray-700">{exp.company}</p>
            <p className="text-gray-800 text-xs leading-snug">{exp.description}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Education */}
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-2">EDUCATION</h2>
      {sampleResume.education.map((edu, idx) => (
        <div key={idx}>
          <p className="font-bold text-gray-900">{edu.degree} in {edu.fieldOfStudy}</p>
          <div className="flex justify-between">
            <p className="text-gray-700">{edu.institution}</p>
            <p className="text-gray-700">{edu.graduationYear}</p>
          </div>
        </div>
      ))}
    </div>

    {/* Skills */}
    <div>
      <h2 className="text-sm font-bold text-gray-900 mb-1">TECHNICAL SKILLS</h2>
      <p className="text-gray-800 text-xs leading-relaxed">{sampleResume.skills}</p>
    </div>
  </div>
);

// Minimal Template Component
const MinimalTemplate = () => (
  <div className="space-y-5 p-8 bg-white text-gray-900 font-sans text-xs">
    {/* Header */}
    <div>
      <h1 className="text-xl font-light text-gray-900">{sampleResume.fullName}</h1>
      <p className="text-xs text-gray-600 mt-1">{sampleResume.email} • {sampleResume.phone}</p>
    </div>

    {/* Summary */}
    <p className="text-gray-800 leading-relaxed text-xs">{sampleResume.summary}</p>

    {/* Experience */}
    <div>
      <p className="text-xs font-semibold text-gray-900 mb-2">EXPERIENCE</p>
      <div className="space-y-2">
        {sampleResume.experience.map((exp, idx) => (
          <div key={idx}>
            <p className="font-semibold text-gray-900 text-xs">{exp.role} <span className="text-gray-600 font-normal">— {exp.company}</span></p>
            <p className="text-xs text-gray-600">{exp.startDate}–{exp.endDate}</p>
            <p className="text-xs text-gray-800 mt-1">{exp.description}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Education */}
    <div>
      <p className="text-xs font-semibold text-gray-900 mb-2">EDUCATION</p>
      {sampleResume.education.map((edu, idx) => (
        <div key={idx}>
          <p className="text-xs text-gray-900 font-semibold">{edu.degree} in {edu.fieldOfStudy}</p>
          <p className="text-xs text-gray-600">{edu.institution}, {edu.graduationYear}</p>
        </div>
      ))}
    </div>

    {/* Skills */}
    <div>
      <p className="text-xs font-semibold text-gray-900 mb-2">SKILLS</p>
      <p className="text-xs text-gray-800">{sampleResume.skills}</p>
    </div>
  </div>
);

// Template Preview Wrapper
const TemplatePreview = ({ templateId }) => {
  switch (templateId) {
    case "modern":
      return <ModernTemplate />;
    case "classic":
      return <ClassicTemplate />;
    case "minimal":
      return <MinimalTemplate />;
    default:
      return <ModernTemplate />;
  }
};

export default function ResumeTemplatesPage() {
  return (
    <section className="min-h-[calc(100vh-130px)] text-white py-12">
      <div className="mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Design System</p>
        <h1 className="mt-2 text-4xl font-extrabold">Resume Templates</h1>
        <p className="mt-2 text-slate-300">Choose a style that matches your professional brand. Customize colors and typography in the builder.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {templates.map((template, idx) => (
          <motion.article 
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: idx * 0.1 }}
            className="flex flex-col"
          >
            {/* Preview */}
            <div className="rounded-t-xl border border-white/10 bg-white shadow-lg overflow-hidden mb-4">
              <div className="transform scale-[0.6] origin-top-left h-96">
                <TemplatePreview templateId={template.id} />
              </div>
            </div>

            {/* Info Card */}
            <motion.div 
              className="premium-card flex-1 flex flex-col"
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <h2 className="text-xl font-bold text-cyan-100">{template.name}</h2>
              <p className="mt-2 text-sm text-slate-300 flex-1">{template.description}</p>
              <Link 
                to="/builder" 
                className="btn-glow mt-4 inline-block text-center"
              >
                Use In Builder
              </Link>
            </motion.div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

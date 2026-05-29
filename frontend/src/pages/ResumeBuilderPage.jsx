import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle2, GripVertical, Sparkles, Wand2 } from "lucide-react";
import { api } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import Loader from "../components/Loader";
import Skeleton from "../components/Skeleton";

const initialExperience = { company: "", role: "", startDate: "", endDate: "", description: "" };
const initialEducation = { institution: "", degree: "", fieldOfStudy: "", graduationYear: "" };
const initialProject = { name: "", description: "", technologies: "" };
const initialCertification = { credential: "", issuer: "", issueDate: "", expirationDate: "" };
const initialLink = { label: "", url: "" };
const initialAchievement = { title: "", description: "", date: "" };
const initialPublication = { title: "", publisher: "", date: "", link: "" };
const initialVolunteer = { organization: "", role: "", date: "", description: "" };
const initialHackathon = { name: "", project: "", date: "", award: "" };
const initialLanguage = { name: "", level: "" };
const initialAward = { title: "", issuer: "", date: "" };

const toneOptions = ["Professional", "FAANG-ready", "Startup-focused", "Fresher", "Executive"];

const ResumeBuilderPage = () => {
  const [searchParams] = useSearchParams();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [deletingResumeId, setDeletingResumeId] = useState("");
  const [quickActionResumeId, setQuickActionResumeId] = useState("");
  const [quickUploadFile, setQuickUploadFile] = useState(null);
  const [quickUploading, setQuickUploading] = useState(false);
  const [improvingResume, setImprovingResume] = useState(false);
  const [quickJobDescription, setQuickJobDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("basic");
  const [template, setTemplate] = useState("modern");
  const [accentColor, setAccentColor] = useState("#22d3ee");
  const [fontFamily, setFontFamily] = useState("Inter, sans-serif");
  const [layoutStyle, setLayoutStyle] = useState("single");
  const [rewriteTone, setRewriteTone] = useState("Professional");
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [previewDevice, setPreviewDevice] = useState("desktop");
  const [draggingSection, setDraggingSection] = useState("");
  const [showPhoto, setShowPhoto] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sectionSpacing, setSectionSpacing] = useState(6);
  const previewRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const [sectionOrder, setSectionOrder] = useState([
    "summary",
    "skills",
    "experience",
    "education",
    "projects",
    "certifications",
    "links",
    "achievements",
    "publications",
    "volunteer",
    "hackathons",
    "languages",
    "awards"
  ]);
  const [form, setForm] = useState({
    title: "",
    fullName: "",
    email: "",
    phone: "",
    summary: "",
    skills: "",
    experience: [initialExperience],
    education: [initialEducation],
    projects: [initialProject],
    certifications: [initialCertification],
    links: [initialLink],
    achievements: [initialAchievement],
    publications: [initialPublication],
    volunteer: [initialVolunteer],
    hackathons: [initialHackathon],
    languages: [initialLanguage],
    awards: [initialAward]
  });

  const loadResumes = async () => {
    try {
      const { data } = await api.get("/resumes");
      setResumes(data.resumes);
      const nextResumes = data.resumes || [];

      if (!nextResumes.length) {
        setQuickActionResumeId("");
        return;
      }

      const queryResumeId = searchParams.get("resumeId");
      if (queryResumeId && nextResumes.some((resume) => resume._id === queryResumeId)) {
        setQuickActionResumeId(queryResumeId);
        return;
      }

      const selectedStillExists = nextResumes.some((resume) => resume._id === quickActionResumeId);
      if (!selectedStillExists) {
        setQuickActionResumeId(nextResumes[0]._id);
      }
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadResumes().catch(() => {
      setError("Unable to load resumes");
    });
  }, [searchParams]);

  const hydrateFormFromResume = (resume) => {
    if (!resume) return;
    setForm((prev) => ({
      ...prev,
      title: resume.title || prev.title,
      fullName: resume.fullName || prev.fullName,
      email: resume.email || prev.email,
      phone: resume.phone || prev.phone,
      summary: resume.summary || prev.summary,
      skills: Array.isArray(resume.skills) ? resume.skills.join(", ") : prev.skills,
      experience: Array.isArray(resume.experience) && resume.experience.length ? resume.experience : prev.experience,
      education: Array.isArray(resume.education) && resume.education.length ? resume.education : prev.education,
      projects: Array.isArray(resume.projects) && resume.projects.length
        ? resume.projects.map((item) => ({
            ...item,
            technologies: Array.isArray(item.technologies) ? item.technologies.join(", ") : item.technologies
          }))
        : prev.projects
    }));
  };

  useEffect(() => {
    if (!quickActionResumeId) return;
    api
      .get(`/resumes/${quickActionResumeId}`)
      .then(({ data }) => {
        hydrateFormFromResume(data.resume);
      })
      .catch(() => {
        setError("Unable to load resume details");
      });
  }, [quickActionResumeId]);

  useEffect(() => {
    const draft = localStorage.getItem("resume_builder_draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setForm((prev) => ({ ...prev, ...parsed }));
      } catch {
        localStorage.removeItem("resume_builder_draft");
      }
    }
  }, []);

  useEffect(() => {
    if (success) {
      toast.success(success);
    }
  }, [success]);

  useEffect(() => {
    setAutosaveStatus("Saving...");
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem("resume_builder_draft", JSON.stringify(form));
        setAutosaveStatus("Saved");
      } catch {
        setAutosaveStatus("Save failed");
      }
    }, 800);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [form]);

  const resumeScore = useMemo(() => {
    const skillsCount = form.skills.split(",").map((s) => s.trim()).filter(Boolean).length;
    const experienceDepth = (form.experience || []).reduce((acc, item) => acc + String(item.description || "").length, 0);
    const sectionsFilled = [
      form.summary,
      form.skills,
      form.experience?.length,
      form.education?.length,
      form.projects?.length
    ].filter(Boolean).length;
    const skillScore = Math.min(30, skillsCount * 3);
    const experienceScore = Math.min(40, Math.round(experienceDepth / 40));
    const sectionScore = sectionsFilled * 6;
    return Math.min(100, skillScore + experienceScore + sectionScore);
  }, [form]);

  const suggestedSkills = useMemo(() => {
    const defaults = [
      "Communication",
      "Leadership",
      "Problem Solving",
      "Stakeholder Management",
      "Data Analysis",
      "System Design",
      "Project Management",
      "Agile",
      "Testing",
      "Documentation"
    ];
    const existing = new Set(
      form.skills
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    return defaults.filter((skill) => !existing.has(skill.toLowerCase())).slice(0, 6);
  }, [form.skills]);

  const previewWidth = useMemo(() => {
    if (previewDevice === "mobile") return "max-w-sm";
    if (previewDevice === "tablet") return "max-w-2xl";
    return "max-w-4xl";
  }, [previewDevice]);

  const [leftSections, rightSections] = useMemo(() => {
    if (layoutStyle !== "two-column") {
      return [sectionOrder, []];
    }
    const midpoint = Math.ceil(sectionOrder.length / 2);
    return [sectionOrder.slice(0, midpoint), sectionOrder.slice(midpoint)];
  }, [layoutStyle, sectionOrder]);

  const handleSectionDragStart = (key) => {
    setDraggingSection(key);
  };

  const handleSectionDrop = (key) => {
    if (!draggingSection || draggingSection === key) return;
    setSectionOrder((prev) => {
      const next = [...prev];
      const fromIndex = next.indexOf(draggingSection);
      const toIndex = next.indexOf(key);
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingSection);
      return next;
    });
    setDraggingSection("");
  };

  const rewriteWithTone = (text) => {
    if (!text.trim()) return text;
    const replacements = {
      "Professional": ["worked on", "delivered"],
      "FAANG-ready": ["worked on", "engineered"],
      "Startup-focused": ["worked on", "shipped"],
      "Fresher": ["worked on", "supported"],
      "Executive": ["worked on", "led"]
    };
    const [from, to] = replacements[rewriteTone] || replacements.Professional;
    return text.replace(new RegExp(from, "gi"), to);
  };

  const convertToStar = (text) => {
    const sentences = String(text).split(".").map((s) => s.trim()).filter(Boolean);
    if (!sentences.length) return text;
    const situation = sentences[0] || "";
    const task = sentences[1] || sentences[0] || "";
    const action = sentences[2] || sentences[1] || sentences[0] || "";
    const result = sentences[3] || sentences[2] || sentences[1] || sentences[0] || "";
    return `Situation: ${situation}. Task: ${task}. Action: ${action}. Result: ${result}.`;
  };

  const renderPreviewSection = (key) => {
    switch (key) {
      case "summary":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Summary</h4>
            <p className="mt-1 text-sm text-slate-700">{form.summary || "Your professional summary appears here."}</p>
          </div>
        );
      case "skills":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Skills</h4>
            <p className="mt-1 text-sm text-slate-700">{form.skills || "Add comma-separated skills to preview them here."}</p>
          </div>
        );
      case "experience":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Experience</h4>
            <div className="mt-2 space-y-3">
              {form.experience.map((item, idx) => (
                <div key={`preview-exp-${idx}`}>
                  <p className="font-semibold text-slate-800">{item.role || "Role"} {item.company ? `at ${item.company}` : ""}</p>
                  <p className="text-xs text-slate-500">{item.startDate || "Start"} - {item.endDate || "End"}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{item.description || "Experience details"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "education":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Education</h4>
            <div className="mt-2 space-y-3">
              {form.education.map((item, idx) => (
                <div key={`preview-edu-${idx}`}>
                  <p className="font-semibold text-slate-800">{item.degree || "Degree"} {item.fieldOfStudy ? `in ${item.fieldOfStudy}` : ""}</p>
                  <p className="text-xs text-slate-500">{item.institution || "Institution"} {item.graduationYear ? `• ${item.graduationYear}` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "projects":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Projects</h4>
            <div className="mt-2 space-y-3">
              {form.projects.map((item, idx) => (
                <div key={`preview-proj-${idx}`}>
                  <p className="font-semibold text-slate-800">{item.name || "Project"}</p>
                  <p className="text-xs text-slate-500">{item.technologies || "Tech stack"}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{item.description || "Project description"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "certifications":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Certifications</h4>
            <div className="mt-2 space-y-2">
              {form.certifications.map((item, idx) => (
                <p key={`preview-cert-${idx}`} className="text-sm text-slate-700">
                  {item.credential || "Credential"}{item.issuer ? ` • ${item.issuer}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "links":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Links</h4>
            <div className="mt-2 space-y-1">
              {form.links.map((item, idx) => (
                <p key={`preview-link-${idx}`} className="text-sm text-slate-700">
                  {item.label || "Link"} {item.url ? `• ${item.url}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "achievements":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Achievements</h4>
            <div className="mt-2 space-y-2">
              {form.achievements.map((item, idx) => (
                <p key={`preview-ach-${idx}`} className="text-sm text-slate-700">
                  {item.title || "Achievement"}{item.date ? ` • ${item.date}` : ""} {item.description ? `— ${item.description}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "publications":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Publications</h4>
            <div className="mt-2 space-y-2">
              {form.publications.map((item, idx) => (
                <p key={`preview-pub-${idx}`} className="text-sm text-slate-700">
                  {item.title || "Publication"}{item.publisher ? ` • ${item.publisher}` : ""} {item.date ? `(${item.date})` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "volunteer":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Volunteer</h4>
            <div className="mt-2 space-y-2">
              {form.volunteer.map((item, idx) => (
                <p key={`preview-vol-${idx}`} className="text-sm text-slate-700">
                  {item.role || "Role"} {item.organization ? `• ${item.organization}` : ""} {item.description ? `— ${item.description}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "hackathons":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Hackathons</h4>
            <div className="mt-2 space-y-2">
              {form.hackathons.map((item, idx) => (
                <p key={`preview-hack-${idx}`} className="text-sm text-slate-700">
                  {item.name || "Hackathon"} {item.project ? `• ${item.project}` : ""} {item.award ? `— ${item.award}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "languages":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Languages</h4>
            <div className="mt-2 space-y-1">
              {form.languages.map((item, idx) => (
                <p key={`preview-lang-${idx}`} className="text-sm text-slate-700">
                  {item.name || "Language"} {item.level ? `• ${item.level}` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      case "awards":
        return (
          <div className="mt-6">
            <h4 className="text-lg font-bold" style={{ color: accentColor }}>Awards</h4>
            <div className="mt-2 space-y-1">
              {form.awards.map((item, idx) => (
                <p key={`preview-award-${idx}`} className="text-sm text-slate-700">
                  {item.title || "Award"} {item.issuer ? `• ${item.issuer}` : ""} {item.date ? `(${item.date})` : ""}
                </p>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const onFieldChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const onArrayChange = (key, index, field, value) => {
    setForm((prev) => {
      const copy = [...prev[key]];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, [key]: copy };
    });
  };

  const addItem = (key, emptyItem) => {
    setForm((prev) => ({ ...prev, [key]: [...prev[key], emptyItem] }));
  };

  const saveResume = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/resumes", {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        projects: (form.projects || []).map((p) => ({
          name: String(p.name || "").trim(),
          description: String(p.description || "").trim(),
          technologies: String(p.technologies || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        }))
      });
      setSuccess("Resume saved successfully");
      await loadResumes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save resume");
    } finally {
      setLoading(false);
    }
  };

  const uploadPdf = async (resumeId, file) => {
    const payload = new FormData();
    payload.append("resumePdf", file);
    await api.post(`/resumes/${resumeId}/upload-pdf`, payload, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    await loadResumes();
  };

  const handleUploadForResume = async (resumeId, file) => {
    const payload = new FormData();
    payload.append("resume", file);
    payload.append("resumeId", resumeId);

    try {
      await api.post("/resumes/upload", payload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSuccess("Resume file uploaded successfully");
      await loadResumes();
    } catch (firstError) {
      try {
        await uploadPdf(resumeId, file);
        setSuccess("Resume file uploaded successfully");
      } catch (fallbackError) {
        const message =
          fallbackError?.response?.data?.message ||
          firstError?.response?.data?.message ||
          "PDF upload failed";

        if (
          message.toLowerCase().includes("invalid pdf") ||
          message.toLowerCase().includes("only pdf") ||
          message.toLowerCase().includes("docx")
        ) {
          setError("Invalid file. Upload PDF or DOCX.");
          return;
        }

        setError(message);
      }
    }
  };

  const deleteResume = async (resumeId) => {
    const confirmed = window.confirm("Delete this resume? This also removes related analysis and interview data.");
    if (!confirmed) {
      return;
    }

    setDeletingResumeId(resumeId);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/resumes/${resumeId}`);
      setSuccess("Resume deleted successfully");
      await loadResumes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete resume");
    } finally {
      setDeletingResumeId("");
    }
  };

  const handleQuickUpload = async () => {
    if (!quickActionResumeId || !quickUploadFile) {
      setError("Please select resume and file first");
      return;
    }

    setQuickUploading(true);
    setError("");
    setSuccess("");

    try {
      await handleUploadForResume(quickActionResumeId, quickUploadFile);
      setQuickUploadFile(null);
    } finally {
      setQuickUploading(false);
    }
  };

  const handleQuickImprove = async () => {
    if (!quickActionResumeId) {
      setError("Please select resume first");
      return;
    }

    setImprovingResume(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/analysis/improve-resume", {
        resumeId: quickActionResumeId,
        jobDescription: quickJobDescription
      });

      const improvedResume = data?.result?.resume;
      if (improvedResume) {
        setForm((prev) => ({
          ...prev,
          summary: improvedResume.summary || prev.summary,
          skills: Array.isArray(improvedResume.skills) ? improvedResume.skills.join(", ") : prev.skills,
          experience: Array.isArray(improvedResume.experience) && improvedResume.experience.length
            ? improvedResume.experience
            : prev.experience
        }));
      }

      setSuccess("AI resume improvements applied");
      await loadResumes();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to improve resume");
    } finally {
      setImprovingResume(false);
    }
  };

  const exportPreviewAsPdf = async () => {
    if (!previewRef.current) {
      return;
    }

    setExportingPdf(true);
    setError("");
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf")
      ]);

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff"
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${(form.title || "resume").replace(/\s+/g, "-").toLowerCase()}.pdf`);
      setSuccess("PDF exported successfully");
    } catch {
      setError("Unable to export PDF right now. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const tabs = [
    { key: "basic", label: "📝 Basic Info" },
    { key: "experience", label: "💼 Experience" },
    { key: "education", label: "🎓 Education" },
    { key: "projects", label: "🏗️ Projects" },
    { key: "certifications", label: "🏆 Certs" },
    { key: "links", label: "🔗 Links" },
    { key: "achievements", label: "🏅 Achievements" },
    { key: "publications", label: "📚 Publications" },
    { key: "volunteer", label: "🤝 Volunteer" },
    { key: "hackathons", label: "🏁 Hackathons" },
    { key: "languages", label: "🌍 Languages" },
    { key: "awards", label: "🎖️ Awards" },
    { key: "template", label: "🎨 Template" }
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#020617] text-white py-12 px-6">
      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold mb-2">Resume Builder</h1>
            <p className="text-gray-400">Create, refine, and optimize your resume with AI guidance.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Score</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="text-2xl font-bold text-cyan-200">{resumeScore}%</p>
              {resumeScore >= 75 && (
                <span className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-100">
                  Apply Ready
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">Autosave: {autosaveStatus}</p>
          </div>
        </div>

        <ErrorBanner message={error} />
        {success && <div className="fade-in-up bg-green-500/20 border border-green-500/50 text-green-300 px-6 py-3 rounded-lg mb-6 animate-fade-in">✅ {success}</div>}
        {listLoading && (
          <div className="mb-8 space-y-3">
            <Loader label="Loading resumes..." />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!!resumes.length && (
          <div className="mb-8 rounded-2xl border border-cyan-500/25 bg-[#0f172a]/60 p-6">
            <h2 className="mb-4 text-2xl font-bold">⚡ Quick Actions</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">Select Resume</label>
                <select
                  value={quickActionResumeId}
                  onChange={(e) => setQuickActionResumeId(e.target.value)}
                  className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white"
                >
                  {resumes.map((resume) => (
                    <option key={resume._id} value={resume._id}>
                      {resume.title || "Untitled Resume"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-300">Choose Resume File</label>
                <input
                  type="file"
                  accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => setQuickUploadFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-gray-300">Target Job Description (optional)</label>
                <textarea
                  rows={3}
                  value={quickJobDescription}
                  onChange={(e) => setQuickJobDescription(e.target.value)}
                  placeholder="Paste job description to tailor AI improvements"
                  className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3">

              <button
                type="button"
                onClick={handleQuickUpload}
                disabled={quickUploading}
                className="bg-blue-500/20 border border-blue-500/40 hover:border-blue-500/60 text-blue-300 px-5 py-2 rounded-lg font-bold transition disabled:opacity-60"
              >
                {quickUploading ? "Uploading..." : "📤 Upload File"}
              </button>

              <button
                type="button"
                onClick={handleQuickImprove}
                disabled={improvingResume}
                className="bg-violet-500/20 border border-violet-500/40 hover:border-violet-500/60 text-violet-300 px-5 py-2 rounded-lg font-bold transition disabled:opacity-60"
              >
                {improvingResume ? "Improving..." : "✨ Improve Resume"}
              </button>

              <Link
                to={`/resume-analyzer?resumeId=${quickActionResumeId}`}
                className="bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-300 px-5 py-2 rounded-lg font-bold transition text-center"
              >
                📊 Analyze
              </Link>
              </div>
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-2 mb-8 bg-[#0f172a]/50 rounded-2xl p-2 border border-cyan-500/20 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2 rounded-2xl font-semibold transition ${activeTab === tab.key ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white" : "text-gray-400 hover:text-gray-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* FORM SECTIONS */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1a1f2e] border border-cyan-500/20 rounded-2xl p-8 shadow-lg animate-fade-in">

          {/* BASIC INFO TAB */}
          {activeTab === "basic" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Resume Title *</label>
                <input name="title" placeholder="e.g. Senior React Developer Resume" value={form.title} onChange={onFieldChange} required className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
                <input name="fullName" placeholder="John Doe" value={form.fullName} onChange={onFieldChange} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
                <input name="email" placeholder="john@example.com" value={form.email} onChange={onFieldChange} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Phone</label>
                <input name="phone" placeholder="+1 (555) 000-0000" value={form.phone} onChange={onFieldChange} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Professional Summary</label>
                <textarea name="summary" rows={4} placeholder="A brief summary of your professional background and career goals..." value={form.summary} onChange={onFieldChange} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition resize-none" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, summary: rewriteWithTone(String(prev.summary || "")) }))}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200"
                  >
                    <Wand2 className="h-4 w-4" /> Rewrite summary ({rewriteTone})
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, summary: convertToStar(String(prev.summary || "")) }))}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200"
                  >
                    <Sparkles className="h-4 w-4" /> STAR format
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Skills (comma-separated)</label>
                <input name="skills" placeholder="React, JavaScript, TypeScript, Node.js, Express, MongoDB..." value={form.skills} onChange={onFieldChange} className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                {!!suggestedSkills.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestedSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, skills: prev.skills ? `${prev.skills}, ${skill}` : skill }))}
                        className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
                      >
                        + {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Rewrite Tone</label>
                <div className="flex flex-wrap gap-2">
                  {toneOptions.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setRewriteTone(tone)}
                      className={`rounded-full border px-3 py-1 text-xs ${rewriteTone === tone ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EXPERIENCE TAB */}
          {activeTab === "experience" && (
            <div className="space-y-4">
              {form.experience.map((item, idx) => {
                const hasMetric = /\d+%|\d+\+|\$\d+|\d+x/i.test(String(item.description || ""));
                return (
                <div key={`exp-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">💼 Experience {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            experience: prev.experience.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Company" value={item.company} onChange={(e) => onArrayChange("experience", idx, "company", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Role/Position" value={item.role} onChange={(e) => onArrayChange("experience", idx, "role", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Start date (MM/YYYY)" value={item.startDate} onChange={(e) => onArrayChange("experience", idx, "startDate", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="End date (MM/YYYY)" value={item.endDate} onChange={(e) => onArrayChange("experience", idx, "endDate", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <textarea rows={3} placeholder="What did you do? Key achievements and responsibilities..." value={item.description} onChange={(e) => onArrayChange("experience", idx, "description", e.target.value)} className="md:col-span-2 bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition resize-none" />
                  <div className="md:col-span-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onArrayChange("experience", idx, "description", rewriteWithTone(String(item.description || "")))}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200"
                    >
                      <Wand2 className="h-4 w-4" /> Rewrite ({rewriteTone})
                    </button>
                    <button
                      type="button"
                      onClick={() => onArrayChange("experience", idx, "description", convertToStar(String(item.description || "")))}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200"
                    >
                      <Sparkles className="h-4 w-4" /> Convert to STAR
                    </button>
                    {!hasMetric && (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200">
                        Metric tip: add numbers (%, $, users, time saved)
                      </span>
                    )}
                  </div>
                </div>
              );
              })}
              <button type="button" onClick={() => addItem("experience", initialExperience)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Experience
              </button>
            </div>
          )}

          {/* EDUCATION TAB */}
          {activeTab === "education" && (
            <div className="space-y-4">
              {form.education.map((item, idx) => (
                <div key={`edu-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🎓 Education {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            education: prev.education.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Institution/University" value={item.institution} onChange={(e) => onArrayChange("education", idx, "institution", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Degree" value={item.degree} onChange={(e) => onArrayChange("education", idx, "degree", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Field of study" value={item.fieldOfStudy} onChange={(e) => onArrayChange("education", idx, "fieldOfStudy", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Graduation year" value={item.graduationYear} onChange={(e) => onArrayChange("education", idx, "graduationYear", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("education", initialEducation)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Education
              </button>
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === "projects" && (
            <div className="space-y-4">
              {form.projects.map((item, idx) => (
                <div key={`project-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🏗️ Project {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            projects: prev.projects.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input
                    placeholder="Project name"
                    value={item.name}
                    onChange={(e) => onArrayChange("projects", idx, "name", e.target.value)}
                    className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                  <input
                    placeholder="Technologies (comma-separated)"
                    value={item.technologies}
                    onChange={(e) => onArrayChange("projects", idx, "technologies", e.target.value)}
                    className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                  <textarea
                    rows={3}
                    placeholder="Project description"
                    value={item.description}
                    onChange={(e) => onArrayChange("projects", idx, "description", e.target.value)}
                    className="md:col-span-2 bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition resize-none"
                  />
                </div>
              ))}
              <button type="button" onClick={() => addItem("projects", initialProject)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Project
              </button>
            </div>
          )}

          {/* CERTIFICATIONS TAB */}
          {activeTab === "certifications" && (
            <div className="space-y-4">
              {form.certifications.map((item, idx) => (
                <div key={`cert-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🏆 Certification {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            certifications: prev.certifications.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Credential Name" value={item.credential} onChange={(e) => onArrayChange("certifications", idx, "credential", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Issuer/Organization" value={item.issuer} onChange={(e) => onArrayChange("certifications", idx, "issuer", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Issue date (MM/YYYY)" value={item.issueDate} onChange={(e) => onArrayChange("certifications", idx, "issueDate", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Expiration date (MM/YYYY) - optional" value={item.expirationDate} onChange={(e) => onArrayChange("certifications", idx, "expirationDate", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("certifications", initialCertification)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Certification
              </button>
            </div>
          )}

          {/* LINKS TAB */}
          {activeTab === "links" && (
            <div className="space-y-4">
              {form.links.map((item, idx) => (
                <div key={`link-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🔗 Link {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            links: prev.links.filter((_, i) => i !== idx)
                          }));
                        }}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Label (e.g. GitHub, LinkedIn)" value={item.label} onChange={(e) => onArrayChange("links", idx, "label", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="URL (https://...)" type="url" value={item.url} onChange={(e) => onArrayChange("links", idx, "url", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("links", initialLink)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Link
              </button>
            </div>
          )}

          {activeTab === "achievements" && (
            <div className="space-y-4">
              {form.achievements.map((item, idx) => (
                <div key={`ach-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🏅 Achievement {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, achievements: prev.achievements.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Achievement title" value={item.title} onChange={(e) => onArrayChange("achievements", idx, "title", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Date (optional)" value={item.date} onChange={(e) => onArrayChange("achievements", idx, "date", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <textarea rows={3} placeholder="Describe the achievement and impact" value={item.description} onChange={(e) => onArrayChange("achievements", idx, "description", e.target.value)} className="md:col-span-2 bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition resize-none" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("achievements", initialAchievement)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Achievement
              </button>
            </div>
          )}

          {activeTab === "publications" && (
            <div className="space-y-4">
              {form.publications.map((item, idx) => (
                <div key={`pub-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">📚 Publication {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, publications: prev.publications.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Title" value={item.title} onChange={(e) => onArrayChange("publications", idx, "title", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Publisher" value={item.publisher} onChange={(e) => onArrayChange("publications", idx, "publisher", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Date" value={item.date} onChange={(e) => onArrayChange("publications", idx, "date", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Link (optional)" value={item.link} onChange={(e) => onArrayChange("publications", idx, "link", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("publications", initialPublication)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Publication
              </button>
            </div>
          )}

          {activeTab === "volunteer" && (
            <div className="space-y-4">
              {form.volunteer.map((item, idx) => (
                <div key={`vol-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🤝 Volunteer {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, volunteer: prev.volunteer.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Organization" value={item.organization} onChange={(e) => onArrayChange("volunteer", idx, "organization", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Role" value={item.role} onChange={(e) => onArrayChange("volunteer", idx, "role", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Date" value={item.date} onChange={(e) => onArrayChange("volunteer", idx, "date", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <textarea rows={3} placeholder="Impact summary" value={item.description} onChange={(e) => onArrayChange("volunteer", idx, "description", e.target.value)} className="md:col-span-2 bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition resize-none" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("volunteer", initialVolunteer)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Volunteer
              </button>
            </div>
          )}

          {activeTab === "hackathons" && (
            <div className="space-y-4">
              {form.hackathons.map((item, idx) => (
                <div key={`hack-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🏁 Hackathon {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, hackathons: prev.hackathons.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Event name" value={item.name} onChange={(e) => onArrayChange("hackathons", idx, "name", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Project" value={item.project} onChange={(e) => onArrayChange("hackathons", idx, "project", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Date" value={item.date} onChange={(e) => onArrayChange("hackathons", idx, "date", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Award (optional)" value={item.award} onChange={(e) => onArrayChange("hackathons", idx, "award", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("hackathons", initialHackathon)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Hackathon
              </button>
            </div>
          )}

          {activeTab === "languages" && (
            <div className="space-y-4">
              {form.languages.map((item, idx) => (
                <div key={`lang-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🌍 Language {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, languages: prev.languages.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Language" value={item.name} onChange={(e) => onArrayChange("languages", idx, "name", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Proficiency (e.g., Native, C1)" value={item.level} onChange={(e) => onArrayChange("languages", idx, "level", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("languages", initialLanguage)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Language
              </button>
            </div>
          )}

          {activeTab === "awards" && (
            <div className="space-y-4">
              {form.awards.map((item, idx) => (
                <div key={`award-${idx}`} className="grid gap-3 rounded-xl bg-[#1a1f2e] border border-cyan-500/20 p-6 md:grid-cols-2 hover:border-cyan-500/40 transition">
                  <div className="md:col-span-2 flex justify-between items-center">
                    <span className="text-sm text-cyan-400 font-bold">🎖️ Award {idx + 1}</span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, awards: prev.awards.filter((_, i) => i !== idx) }))}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <input placeholder="Award title" value={item.title} onChange={(e) => onArrayChange("awards", idx, "title", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Issuer" value={item.issuer} onChange={(e) => onArrayChange("awards", idx, "issuer", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                  <input placeholder="Date" value={item.date} onChange={(e) => onArrayChange("awards", idx, "date", e.target.value)} className="bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition" />
                </div>
              ))}
              <button type="button" onClick={() => addItem("awards", initialAward)} className="border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-400 px-6 py-2 rounded-lg font-bold transition">
                + Add Award
              </button>
            </div>
          )}

          {activeTab === "template" && (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Template</label>
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  <option value="modern">Modern</option>
                  <option value="classic">Classic</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Accent Color</label>
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-full rounded-lg border border-gray-600 bg-[#0f172a]" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Font</label>
                <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Layout</label>
                <select value={layoutStyle} onChange={(e) => setLayoutStyle(e.target.value)}>
                  <option value="single">Single Column</option>
                  <option value="two-column">Two Column</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Preview Device</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "desktop", label: "Desktop" },
                    { key: "tablet", label: "Tablet" },
                    { key: "mobile", label: "Mobile" }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setPreviewDevice(item.key)}
                      className={`rounded-full border px-3 py-1 text-xs ${previewDevice === item.key ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Section Spacing ({sectionSpacing})</label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={sectionSpacing}
                  onChange={(e) => setSectionSpacing(Number(e.target.value))}
                />
              </div>
              <div className="md:col-span-3 grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <input type="checkbox" checked={showPhoto} onChange={(e) => setShowPhoto(e.target.checked)} />
                  Show Profile Photo
                </label>
                <input
                  placeholder="Profile image URL (optional)"
                  value={profilePhoto}
                  onChange={(e) => setProfilePhoto(e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Section Order (Drag to reorder)</label>
                <div className="grid gap-2 md:grid-cols-2">
                  {sectionOrder.map((section) => (
                    <div
                      key={section}
                      draggable
                      onDragStart={() => handleSectionDragStart(section)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleSectionDrop(section)}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
                    >
                      <span className="capitalize">{section.replace("_", " ")}</span>
                      <GripVertical className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* SAVE BUTTON */}
        <button
          type="submit"
          disabled={loading}
          onClick={saveResume}
          className="btn-glow mt-8 w-full disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {loading ? "⏳ Saving..." : "💾 Save Resume"}
        </button>

        <div className="mt-8 rounded-2xl border border-cyan-500/25 bg-white p-6 text-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">👁️ Live Preview</h2>
            <button
              type="button"
              onClick={exportPreviewAsPdf}
              disabled={exportingPdf}
              className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingPdf ? "Preparing PDF..." : "⬇️ Export PDF"}
            </button>
          </div>

          <div className={`mx-auto ${previewWidth}`}>
            <div ref={previewRef} className={`rounded-xl border border-slate-200 bg-white p-8 shadow-sm ${template === "minimal" ? "" : ""}`} style={{ fontFamily }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-3xl font-extrabold" style={{ color: accentColor }}>{form.fullName || "Your Name"}</h3>
                <p className="mt-1 text-sm text-slate-600">{form.email || "email@example.com"} {form.phone ? `| ${form.phone}` : ""}</p>
              </div>
              {showPhoto && (
                <img
                  src={profilePhoto || "https://via.placeholder.com/80"}
                  alt="Profile"
                  className="h-20 w-20 rounded-full border border-slate-300 object-cover"
                />
              )}
            </div>
            <div style={{ marginTop: `${sectionSpacing * 4}px` }} className={layoutStyle === "two-column" ? "grid gap-8 md:grid-cols-[1fr_1fr]" : ""}>
              <div>
                {leftSections.map((section) => (
                  <div key={section}>{renderPreviewSection(section)}</div>
                ))}
              </div>
              {layoutStyle === "two-column" && (
                <div>
                  {rightSections.map((section) => (
                    <div key={section}>{renderPreviewSection(section)}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* SAVED RESUMES */}
        <div className="mt-12">
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <span>📚</span> Saved Resumes
          </h2>
          <div className="space-y-3">
            {resumes.map((resume) => (
              <div key={resume._id} className="rounded-xl bg-gradient-to-r from-[#0f172a] to-[#1a1f2e] border border-cyan-500/20 hover:border-cyan-500/40 p-6 transition group">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-lg text-white group-hover:text-cyan-400 transition">{resume.title}</p>
                    <p className="text-sm text-gray-400 mt-1">📅 Updated: {new Date(resume.updatedAt).toLocaleString()}</p>
                  </div>
                  <label className="cursor-pointer bg-blue-500/20 border border-blue-500/40 hover:border-blue-500/60 text-blue-400 px-6 py-2 rounded-lg text-sm font-bold transition hover:bg-blue-500/30">
                    📤 Upload Resume
                    <input
                      type="file"
                      accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadForResume(resume._id, file);
                        }
                      }}
                    />
                  </label>
                  <Link
                    to={`/resume-analyzer?resumeId=${resume._id}`}
                    className="bg-cyan-500/20 border border-cyan-500/40 hover:border-cyan-500/60 text-cyan-300 px-6 py-2 rounded-lg text-sm font-bold transition hover:bg-cyan-500/30"
                  >
                    📊 Analyze
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteResume(resume._id)}
                    disabled={deletingResumeId === resume._id}
                    className="bg-red-500/20 border border-red-500/40 hover:border-red-500/60 text-red-300 px-6 py-2 rounded-lg text-sm font-bold transition hover:bg-red-500/30 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingResumeId === resume._id ? "Deleting..." : "🗑️ Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!resumes.length && <div className="text-center py-16 border border-dashed border-gray-600 rounded-xl">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-400">No resumes yet</p>
            <p className="text-gray-500 text-sm mt-2">Create your first resume above and it will appear here</p>
          </div>}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </main>
  );
};

export default ResumeBuilderPage;

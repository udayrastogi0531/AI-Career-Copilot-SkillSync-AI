import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import EmptyState from "../components/EmptyState";
import SectionHeader from "../components/SectionHeader";

export default function ResumeUploadPage() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get("/resumes")
      .then(({ data }) => {
        const items = data.resumes || [];
        setResumes(items);
        if (items[0]?._id) {
          setResumeId(items[0]._id);
        }
      })
      .catch(() => {
        toast.error("Unable to load resumes");
      });
  }, []);

  const uploadFile = async (file) => {
    if (!file) {
      return;
    }

    const payload = new FormData();
    payload.append("resume", file);
    if (resumeId) {
      payload.append("resumeId", resumeId);
    }

    setUploading(true);
    try {
      const { data } = await api.post("/resumes/upload", payload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Resume uploaded and parsed successfully");
      if (data?.resume?._id) {
        navigate(`/builder?resumeId=${data.resume._id}`);
      }
    } catch (error) {
      const message = error?.response?.data?.message || "Resume upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    await uploadFile(file);
  };

  return (
    <section className="min-h-[calc(100vh-130px)] text-white">
      <SectionHeader
        eyebrow="Upload Module"
        title="Upload Resume"
        subtitle="Drag and drop PDF or DOCX to parse text and update your resume profile."
        className="mb-8"
      />

      <article className="premium-card space-y-4">
        {!resumes.length && (
          <EmptyState
            icon={FileUp}
            title="No resumes yet"
            description="Upload a resume to create your first profile. We will parse it and populate your builder instantly."
            ctaLabel="Open Resume Builder"
            href="/builder"
          />
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">Target Resume</label>
          <select value={resumeId} onChange={(e) => setResumeId(e.target.value)} disabled={!resumes.length}>
            {resumes.map((resume) => (
              <option key={resume._id} value={resume._id}>
                {resume.title || "Untitled Resume"}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            isDragging ? "border-cyan-300 bg-cyan-500/10" : "border-cyan-500/35 bg-slate-900/30"
          }`}
        >
          <p className="text-lg font-semibold text-cyan-100">Drop PDF or DOCX here</p>
          <p className="mt-2 text-sm text-slate-400">Max file size 8MB</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-glow mt-4 disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Choose File"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => uploadFile(event.target.files?.[0])}
          />
        </div>
      </article>
    </section>
  );
}

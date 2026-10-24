export const LATEX_TEMPLATES = [
  {
    id: "ats-classic",
    name: "ATS Classic",
    description: "Single column, serif, black-and-white. Optimised for parsers and conservative industries.",
    accent: "#111827",
    font: "serif"
  },
  {
    id: "modern-teal",
    name: "Modern Teal",
    description: "Clean sans-serif layout with a restrained accent colour for product and engineering roles.",
    accent: "#0f766e",
    font: "sans"
  },
  {
    id: "compact-one-page",
    name: "Compact One Page",
    description: "Tighter spacing and smaller type for candidates who need to fit substantial experience on one page.",
    accent: "#1e3a8a",
    font: "sans"
  }
];

export const DEFAULT_TEMPLATE_ID = "ats-classic";

const TEMPLATE_FAMILY = {
  "ats-classic": { size: "11pt", margin: "0.7in", spacing: "3pt", itemSep: "2pt", sans: false },
  "modern-teal": { size: "11pt", margin: "0.75in", spacing: "4pt", itemSep: "3pt", sans: true },
  "compact-one-page": { size: "10pt", margin: "0.5in", spacing: "2pt", itemSep: "1pt", sans: true }
};

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

/**
 * Escape arbitrary resume text for LaTeX. Deliberately conservative: control
 * characters and glyphs outside Latin-1 are transliterated or removed rather
 * than passed through to the TeX engine.
 */
export const escapeLatex = (value) => {
  const replacements = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "$": "\\$",
    "&": "\\&",
    "#": "\\#",
    "%": "\\%",
    "_": "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
    "\u2013": "--",
    "\u2014": "---",
    "\u2018": "'",
    "\u2019": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u2026": "\\ldots{}",
    "\u2022": "-",
    "\u25cf": "-",
    "\u25aa": "-",
    "\u2192": "->",
    "\u2264": "<=",
    "\u2265": ">=",
    "\u00a0": " "
  };

  const normalized = String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2022\u25cf\u25aa]/g, "-")
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(
      /[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2022\u2192\u2264\u2265]/g,
      ""
    )
    .replace(/[\r\n\t]+/g, " ");

  // Single replacement pass: generated escapes must never be escaped again.
  return normalized.replace(/[\\{}$&#%_~^\u00a0\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2022\u2192\u2264\u2265]/g, (char) => replacements[char] ?? char);
};

const safeUrl = (value) => {
  const raw = String(value || "").trim();
  if (!/^https?:\/\/|^mailto:/i.test(raw)) return "";
  return raw.replace(/[{}%#]/g, (char) => `%${char.charCodeAt(0).toString(16)}`);
};

const sectionHeader = (title) =>
  `\\vspace{${"{{spacing}}"}}\n{\\large\\bfseries{{accent}}\\MakeUppercase{${escapeLatex(title)}}}\\par\\vspace{2pt}\\hrule\\vspace{4pt}\n`;

const bulletList = (lines = []) => {
  const items = lines
    .flatMap((line) => String(line || "").split(/\r?\n/))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 1)
    .map((line) => `\\item ${escapeLatex(line)}`);

  if (!items.length) return "";
  return `\\begin{itemize}[leftmargin=1.2em,itemsep={{itemSep}},topsep=2pt,parsep=0pt]\n${items.join("\n")}\n\\end{itemize}\n`;
};

const contactLine = (resume) => {
  const items = [];
  if (resume.email) items.push(`\\href{mailto:${String(resume.email).replace(/[{}%#]/g, "")}}{${escapeLatex(resume.email)}}`);
  if (resume.phone) items.push(escapeLatex(resume.phone));
  for (const link of resume.links || []) {
    const url = safeUrl(link?.url);
    if (url) items.push(`\\href{${url}}{${escapeLatex(link?.label || link?.url)}}`);
  }
  return items.join(" \\textbar{} ");
};

const experienceBlock = (resume) =>
  (resume.experience || [])
    .filter((entry) => entry && (entry.role || entry.company || entry.description))
    .map((entry) => {
      const dates = [clean(entry.startDate), clean(entry.endDate)].filter(Boolean).join(" -- ");
      const title = escapeLatex(entry.role || "Role");
      const company = escapeLatex(entry.company || "");
      const heading = `\\begin{tabularx}{\\textwidth}{@{}X r@{}}\n\\textbf{${title}}${company ? ` \\textbar{} \\textit{${company}}` : ""} & ${escapeLatex(dates)} \\\\\n\\end{tabularx}\n`;
      return heading + bulletList([entry.description || ""]);
    })
    .join("\n");

const projectBlock = (resume) =>
  (resume.projects || [])
    .filter((entry) => entry && (entry.name || entry.description))
    .map((entry) => {
      const tech = (entry.technologies || []).map(clean).filter(Boolean).join(", ");
      const heading = `\\textbf{${escapeLatex(entry.name || "Project")}}${
        tech ? ` \\textit{(${escapeLatex(tech)})}` : ""
      }\\par\n`;
      return heading + bulletList([entry.description || ""]);
    })
    .join("\n");

const educationBlock = (resume) =>
  (resume.education || [])
    .filter((entry) => entry && (entry.institution || entry.degree))
    .map((entry) => {
      const degree = [clean(entry.degree), clean(entry.fieldOfStudy)].filter(Boolean).join(" in ");
      const left = [degree ? `\\textbf{${escapeLatex(degree)}}` : "", escapeLatex(entry.institution || "")]
        .filter(Boolean)
        .join(", ");
      return `\\begin{tabularx}{\\textwidth}{@{}X r@{}}\n${left} & ${escapeLatex(entry.graduationYear || "")} \\\\\n\\end{tabularx}\n`;
    })
    .join("\n");

const certificationBlock = (resume) =>
  (resume.certifications || [])
    .filter((entry) => entry && (entry.credential || entry.issuer))
    .map((entry) => {
      const parts = [clean(entry.credential), clean(entry.issuer)]
        .filter(Boolean)
        .map((part) => escapeLatex(part))
        .join(" -- ");
      const date = clean(entry.issueDate) ? ` (${escapeLatex(entry.issueDate)})` : "";
      return `\\item ${parts}${date}`;
    })
    .join("\n");

const achievementsBlock = (resume) =>
  (resume.achievements || [])
    .filter((entry) => entry && (entry.title || entry.description))
    .map((entry) => {
      const parts = [clean(entry.title), clean(entry.description)]
        .filter(Boolean)
        .map((part) => escapeLatex(part))
        .join(" -- ");
      return `\\item ${parts}`;
    })
    .join("\n");

/**
 * Build a complete, engine-agnostic LaTeX document from canonical resume data.
 */
export const buildLatexFromResume = (resume = {}, templateId = DEFAULT_TEMPLATE_ID) => {
  const family = TEMPLATE_FAMILY[templateId] || TEMPLATE_FAMILY[DEFAULT_TEMPLATE_ID];
  const template = LATEX_TEMPLATES.find((item) => item.id === templateId) || LATEX_TEMPLATES[0];
  const accent = template.accent.replace("#", "");

  const parts = [];
  parts.push(`\\documentclass[${family.size}]{article}`);
  parts.push(`\\usepackage[margin=${family.margin}]{geometry}`);
  parts.push("\\usepackage{enumitem}");
  parts.push("\\usepackage{titlesec}");
  parts.push("\\usepackage{xcolor}");
  parts.push("\\usepackage{tabularx}");
  parts.push("\\usepackage{array}");
  parts.push("\\usepackage{parskip}");
  parts.push("\\usepackage[hidelinks]{hyperref}");
  if (family.sans) parts.push("\\renewcommand{\\familydefault}{\\sfdefault}");
  parts.push(`\\definecolor{accent}{HTML}{${accent}}`);
  parts.push("\\setlength{\\parindent}{0pt}");
  parts.push("\\pagestyle{empty}");
  parts.push("\\begin{document}");
  parts.push("\\raggedright");

  parts.push(`{\\Huge\\bfseries ${escapeLatex(resume.fullName || resume.title || "Your Name")}}\\par`);
  const contact = contactLine(resume);
  if (contact) parts.push(`\\vspace{4pt}${contact}\\par`);

  const pushSection = (title, body) => {
    if (!body || !String(body).trim()) return;
    const header = sectionHeader(title)
      .replace(/\{\{spacing\}\}/g, family.spacing)
      .replace("{{accent}}", "\\color{accent}");
    parts.push(header + body.replace(/\{\{itemSep\}\}/g, family.itemSep));
  };

  if (clean(resume.summary)) {
    pushSection("Professional Summary", `${escapeLatex(resume.summary)}\\par`);
  }

  const skills = (resume.skills || []).map(clean).filter(Boolean);
  if (skills.length) {
    pushSection("Skills", `${skills.map((skill) => escapeLatex(skill)).join(" \\textbullet{} ")}\\par`);
  }

  pushSection("Experience", experienceBlock(resume));
  pushSection("Projects", projectBlock(resume));
  pushSection("Education", educationBlock(resume));

  const certifications = certificationBlock(resume);
  if (certifications) pushSection("Certifications", `\\begin{itemize}[leftmargin=1.2em,itemsep=${family.itemSep}]\n${certifications}\n\\end{itemize}`);

  const achievements = achievementsBlock(resume);
  if (achievements) pushSection("Achievements", `\\begin{itemize}[leftmargin=1.2em,itemsep=${family.itemSep}]\n${achievements}\n\\end{itemize}`);

  parts.push("\\end{document}\n");
  return parts.join("\n");
};

export const renderTemplateSample = (templateId) =>
  buildLatexFromResume(
    {
      fullName: "Alex Morgan",
      email: "alex.morgan@example.com",
      phone: "+1 555 010 2200",
      links: [{ label: "github.com/alexmorgan", url: "https://github.com/alexmorgan" }],
      summary: "Backend engineer with 6 years building reliable APIs and data pipelines.",
      skills: ["TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker", "System Design"],
      experience: [
        {
          role: "Senior Software Engineer",
          company: "Northwind",
          startDate: "2022",
          endDate: "Present",
          description:
            "Led migration of billing services to event-driven workers.\nReduced p95 latency by 38% through query and cache optimisation."
        }
      ],
      projects: [
        {
          name: "Open source job parser",
          technologies: ["Python", "FastAPI"],
          description: "Extracts structured requirements from public job postings."
        }
      ],
      education: [
        { institution: "State University", degree: "B.S.", fieldOfStudy: "Computer Science", graduationYear: "2018" }
      ]
    },
    templateId
  );

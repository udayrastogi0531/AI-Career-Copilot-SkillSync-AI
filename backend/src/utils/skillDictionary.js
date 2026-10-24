/**
 * Canonical skill catalogue.
 *
 * Every entry has a display name plus aliases that are common in resumes and
 * job descriptions. Matching is deterministic: text is tokenised on word
 * boundaries, aliases are normalised, and the longest alias wins so that
 * "react native" is not reported as plain "react".
 */

export const SKILL_CATALOG = [
  // Languages
  { name: "JavaScript", aliases: ["javascript", "js", "ecmascript"], category: "language" },
  { name: "TypeScript", aliases: ["typescript", "ts"], category: "language" },
  { name: "Python", aliases: ["python", "python3"], category: "language" },
  { name: "Java", aliases: ["java"], category: "language" },
  { name: "C++", aliases: ["c++", "cpp"], category: "language" },
  { name: "C#", aliases: ["c#", "csharp", "c sharp"], category: "language" },
  { name: "C", aliases: ["c"], category: "language" },
  { name: "Go", aliases: ["golang", "go lang", "go"], category: "language" },
  { name: "Rust", aliases: ["rust"], category: "language" },
  { name: "Ruby", aliases: ["ruby"], category: "language" },
  { name: "PHP", aliases: ["php"], category: "language" },
  { name: "Swift", aliases: ["swift", "swiftui"], category: "language" },
  { name: "Kotlin", aliases: ["kotlin"], category: "language" },
  { name: "Scala", aliases: ["scala"], category: "language" },
  { name: "R", aliases: ["r language", "r programming", "r"], category: "language" },
  { name: "MATLAB", aliases: ["matlab"], category: "language" },
  { name: "SQL", aliases: ["sql", "t-sql", "pl/sql"], category: "language" },
  { name: "Bash", aliases: ["bash", "shell scripting", "shell script"], category: "language" },
  { name: "HTML", aliases: ["html", "html5"], category: "language" },
  { name: "CSS", aliases: ["css", "css3"], category: "language" },

  // Frontend
  { name: "React", aliases: ["react", "react.js", "reactjs"], category: "frontend" },
  { name: "React Native", aliases: ["react native"], category: "mobile" },
  { name: "Next.js", aliases: ["next.js", "nextjs", "next js"], category: "frontend" },
  { name: "Vue.js", aliases: ["vue", "vue.js", "vuejs"], category: "frontend" },
  { name: "Angular", aliases: ["angular", "angularjs"], category: "frontend" },
  { name: "Svelte", aliases: ["svelte", "sveltekit"], category: "frontend" },
  { name: "Redux", aliases: ["redux", "redux toolkit"], category: "frontend" },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss", "tailwind css"], category: "frontend" },
  { name: "Sass", aliases: ["sass", "scss"], category: "frontend" },
  { name: "Webpack", aliases: ["webpack"], category: "frontend" },
  { name: "Vite", aliases: ["vite"], category: "frontend" },
  { name: "Accessibility", aliases: ["accessibility", "a11y", "wcag"], category: "frontend" },

  // Backend / APIs
  { name: "Node.js", aliases: ["node", "node.js", "nodejs"], category: "backend" },
  { name: "Express", aliases: ["express", "express.js", "expressjs"], category: "backend" },
  { name: "NestJS", aliases: ["nestjs", "nest.js"], category: "backend" },
  { name: "Django", aliases: ["django"], category: "backend" },
  { name: "Flask", aliases: ["flask"], category: "backend" },
  { name: "FastAPI", aliases: ["fastapi"], category: "backend" },
  { name: "Spring Boot", aliases: ["spring boot", "springboot", "spring"], category: "backend" },
  { name: "REST APIs", aliases: ["rest", "rest api", "restful", "rest apis"], category: "backend" },
  { name: "GraphQL", aliases: ["graphql", "apollo"], category: "backend" },
  { name: "gRPC", aliases: ["grpc", "protobuf", "protocol buffers"], category: "backend" },
  { name: ".NET", aliases: [".net", "dotnet", "asp.net"], category: "backend" },
  { name: "Microservices", aliases: ["microservice", "microservices", "service-oriented"], category: "backend" },
  { name: "WebSockets", aliases: ["websocket", "websockets", "socket.io"], category: "backend" },
  { name: "Message Queues", aliases: ["kafka", "rabbitmq", "message queue", "pub/sub", "sqs"], category: "backend" },
  { name: "Authentication", aliases: ["oauth", "oauth2", "jwt", "authentication", "sso", "saml"], category: "backend" },

  // Data
  { name: "MongoDB", aliases: ["mongodb", "mongo", "mongoose"], category: "database" },
  { name: "PostgreSQL", aliases: ["postgres", "postgresql"], category: "database" },
  { name: "MySQL", aliases: ["mysql", "mariadb"], category: "database" },
  { name: "SQLite", aliases: ["sqlite"], category: "database" },
  { name: "Redis", aliases: ["redis"], category: "database" },
  { name: "Elasticsearch", aliases: ["elasticsearch", "opensearch", "elastic search"], category: "database" },
  { name: "DynamoDB", aliases: ["dynamodb"], category: "database" },
  { name: "Cassandra", aliases: ["cassandra"], category: "database" },
  { name: "Oracle", aliases: ["oracle db", "oracle database", "plsql"], category: "database" },
  { name: "Database Design", aliases: ["database design", "data modeling", "schema design", "normalization"], category: "database" },
  { name: "SQL Optimization", aliases: ["query optimization", "indexing", "sql tuning"], category: "database" },

  // Cloud / DevOps
  { name: "AWS", aliases: ["aws", "amazon web services", "ec2", "s3", "lambda", "eks"], category: "cloud" },
  { name: "Azure", aliases: ["azure", "microsoft azure"], category: "cloud" },
  { name: "Google Cloud", aliases: ["gcp", "google cloud", "google cloud platform", "bigquery"], category: "cloud" },
  { name: "Docker", aliases: ["docker", "containers", "containerization"], category: "devops" },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s", "helm"], category: "devops" },
  { name: "Terraform", aliases: ["terraform", "infrastructure as code", "iac"], category: "devops" },
  { name: "CI/CD", aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery", "github actions", "jenkins", "gitlab ci"], category: "devops" },
  { name: "Linux", aliases: ["linux", "unix", "ubuntu", "centos"], category: "devops" },
  { name: "Nginx", aliases: ["nginx", "reverse proxy"], category: "devops" },
  { name: "Monitoring", aliases: ["monitoring", "observability", "prometheus", "grafana", "datadog", "cloudwatch"], category: "devops" },
  { name: "Serverless", aliases: ["serverless", "faas", "cloud functions"], category: "cloud" },
  { name: "Site Reliability", aliases: ["sre", "site reliability", "incident response", "on-call"], category: "devops" },

  // AI / ML
  { name: "Machine Learning", aliases: ["machine learning", "ml", "supervised learning", "unsupervised learning"], category: "ai" },
  { name: "Deep Learning", aliases: ["deep learning", "neural network", "neural networks"], category: "ai" },
  { name: "TensorFlow", aliases: ["tensorflow", "keras"], category: "ai" },
  { name: "PyTorch", aliases: ["pytorch", "torch"], category: "ai" },
  { name: "scikit-learn", aliases: ["scikit-learn", "sklearn", "scikit learn"], category: "ai" },
  { name: "NLP", aliases: ["nlp", "natural language processing", "text mining"], category: "ai" },
  { name: "Computer Vision", aliases: ["computer vision", "opencv"], category: "ai" },
  { name: "LLMs", aliases: ["llm", "llms", "large language model", "generative ai", "genai", "prompt engineering"], category: "ai" },
  { name: "RAG", aliases: ["rag", "retrieval augmented generation", "vector database", "embeddings"], category: "ai" },
  { name: "Pandas", aliases: ["pandas"], category: "data" },
  { name: "NumPy", aliases: ["numpy"], category: "data" },
  { name: "Data Visualization", aliases: ["data visualization", "matplotlib", "seaborn", "tableau", "power bi", "looker"], category: "data" },
  { name: "Data Pipelines", aliases: ["etl", "elt", "data pipeline", "airflow", "dbt", "spark", "pyspark"], category: "data" },
  { name: "Statistics", aliases: ["statistics", "statistical analysis", "a/b testing", "hypothesis testing"], category: "data" },

  // Mobile / desktop
  { name: "iOS", aliases: ["ios", "xcode", "uikit"], category: "mobile" },
  { name: "Android", aliases: ["android", "jetpack compose"], category: "mobile" },
  { name: "Flutter", aliases: ["flutter", "dart"], category: "mobile" },
  { name: "Electron", aliases: ["electron"], category: "desktop" },

  // Testing / quality
  { name: "Unit Testing", aliases: ["unit testing", "unit tests", "jest", "pytest", "junit", "vitest", "mocha"], category: "testing" },
  { name: "Integration Testing", aliases: ["integration testing", "integration tests", "end-to-end testing", "e2e testing", "playwright", "cypress", "selenium"], category: "testing" },
  { name: "Test Automation", aliases: ["test automation", "automated testing", "qa automation"], category: "testing" },
  { name: "Code Review", aliases: ["code review", "peer review"], category: "engineering" },

  // Engineering practice
  { name: "Git", aliases: ["git", "github", "gitlab", "bitbucket", "version control"], category: "engineering" },
  { name: "System Design", aliases: ["system design", "distributed systems", "high availability", "scalability", "architecture design"], category: "engineering" },
  { name: "Performance Optimization", aliases: ["performance optimization", "latency optimization", "caching", "load balancing"], category: "engineering" },
  { name: "Security", aliases: ["security", "appsec", "owasp", "penetration testing", "encryption", "secure coding"], category: "security" },
  { name: "Agile", aliases: ["agile", "scrum", "kanban", "sprint planning"], category: "process" },
  { name: "Documentation", aliases: ["documentation", "technical writing", "runbooks"], category: "process" },
  { name: "Debugging", aliases: ["debugging", "root cause analysis", "troubleshooting"], category: "engineering" },
  { name: "Accessibility Testing", aliases: ["screen reader testing", "axe"], category: "testing" },

  // Product / design
  { name: "Product Management", aliases: ["product management", "product manager", "roadmap", "product strategy"], category: "product" },
  { name: "User Research", aliases: ["user research", "user interviews", "usability testing"], category: "product" },
  { name: "Figma", aliases: ["figma", "sketch", "adobe xd"], category: "design" },
  { name: "UX Design", aliases: ["ux", "user experience", "ux design"], category: "design" },
  { name: "UI Design", aliases: ["ui design", "ui/ux", "visual design"], category: "design" },
  { name: "Design Systems", aliases: ["design system", "design systems", "component library"], category: "design" },

  // Business / analytics
  { name: "Project Management", aliases: ["project management", "program management", "pmp"], category: "process" },
  { name: "Stakeholder Management", aliases: ["stakeholder management", "stakeholders", "cross-functional"], category: "business" },
  { name: "Data Analysis", aliases: ["data analysis", "analytics", "business intelligence"], category: "business" },
  { name: "Excel", aliases: ["excel", "spreadsheets", "google sheets"], category: "business" },
  { name: "Salesforce", aliases: ["salesforce", "crm"], category: "business" },
  { name: "Marketing", aliases: ["marketing", "seo", "content marketing", "campaign management"], category: "business" },
  { name: "Customer Support", aliases: ["customer support", "customer success", "technical support"], category: "business" },

  // Communication / leadership
  { name: "Communication", aliases: ["communication", "written communication", "verbal communication", "presentation skills"], category: "soft" },
  { name: "Leadership", aliases: ["leadership", "team lead", "people management", "mentoring", "mentorship"], category: "soft" },
  { name: "Collaboration", aliases: ["collaboration", "teamwork", "cross functional collaboration"], category: "soft" },
  { name: "Problem Solving", aliases: ["problem solving", "critical thinking", "analytical skills"], category: "soft" },
  { name: "Time Management", aliases: ["time management", "prioritization"], category: "soft" },
  { name: "Negotiation", aliases: ["negotiation", "influence"], category: "soft" },
  { name: "Ownership", aliases: ["ownership", "self-starter", "autonomy"], category: "soft" }
];

const normalizeAlias = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+#./ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build a longest-first alias index. Long aliases are tested first so that
// "react native" consumes its span before "react" is considered.
const aliasIndex = [];
for (const skill of SKILL_CATALOG) {
  const aliases = new Set([skill.name, ...(skill.aliases || [])].map(normalizeAlias).filter(Boolean));
  for (const alias of aliases) {
    aliasIndex.push({
      alias,
      skill: skill.name,
      category: skill.category,
      // A short alias such as "go" or "r" is only accepted as a standalone word.
      pattern: new RegExp(`(^|[^a-z0-9+#])${escapeRegex(alias).replace(/\\ /g, "[\\s-]+")}($|[^a-z0-9+#])`, "gi")
    });
  }
}

aliasIndex.sort((a, b) => b.alias.length - a.alias.length);

// Every alias (not just the display name) resolves to its canonical entry.
const canonicalByAlias = new Map();
for (const entry of SKILL_CATALOG) {
  for (const alias of new Set([entry.name, ...(entry.aliases || [])])) {
    const normalized = normalizeAlias(alias);
    if (normalized && !canonicalByAlias.has(normalized)) {
      canonicalByAlias.set(normalized, entry.name);
    }
  }
}

export const normalizeSkill = (value) => {
  const normalized = normalizeAlias(value);
  if (!normalized) return "";
  return canonicalByAlias.get(normalized) || canonicalByAlias.get(normalized.replace(/\./g, "")) || "";
};

/**
 * Find canonical skills in free text. Returns unique names in catalogue order.
 */
export const extractSkills = (text) => {
  const haystack = String(text || "");
  if (!haystack.trim()) return [];

  const found = new Set();
  const consumed = [];

  for (const entry of aliasIndex) {
    entry.pattern.lastIndex = 0;
    let match;
    while ((match = entry.pattern.exec(haystack)) !== null) {
      const start = match.index + match[1].length;
      const end = start + match[0].length - match[1].length - match[2].length;
      if (consumed.some((span) => start < span.end && end > span.start)) {
        continue;
      }
      found.add(entry.skill);
      consumed.push({ start, end });
    }
  }

  return SKILL_CATALOG.filter((entry) => found.has(entry.name)).map((entry) => entry.name);
};

/**
 * Match job-required skills against resume skills with alias awareness.
 */
export const matchSkills = (required = [], resumeSkills = []) => {
  const resumeSet = new Set(
    resumeSkills
      .map((skill) => normalizeSkill(skill) || String(skill || "").trim())
      .filter(Boolean)
      .map((skill) => skill.toLowerCase())
  );

  const matched = [];
  const missing = [];

  for (const raw of required) {
    const canonical = normalizeSkill(raw) || String(raw || "").trim();
    if (!canonical) continue;
    if (resumeSet.has(canonical.toLowerCase())) {
      matched.push(canonical);
    } else {
      missing.push(canonical);
    }
  }

  return { matched, missing };
};

export const getSkillCategory = (skillName) => {
  const normalized = normalizeSkill(skillName) || String(skillName || "").trim();
  return SKILL_CATALOG.find((entry) => entry.name === normalized)?.category || "other";
};

export const canonicalSkillList = () => SKILL_CATALOG.map((entry) => entry.name);

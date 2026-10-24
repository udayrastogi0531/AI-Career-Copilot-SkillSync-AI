import test from "node:test";
import assert from "node:assert/strict";
import { computeAtsScore, DEFAULT_ATS_WEIGHTS, estimateResumeExperienceYears } from "../src/services/atsEngine.js";
import { parseJobDescription } from "../src/services/jdParser.js";

const RESUME = {
  title: "Backend Resume",
  fullName: "Jane Doe",
  email: "jane@example.com",
  phone: "+1 555 0100",
  summary: "Backend engineer with 6 years building Node.js and TypeScript services.",
  skills: ["Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS"],
  experience: [
    {
      role: "Senior Backend Engineer",
      company: "Northwind",
      startDate: "2021",
      endDate: "Present",
      description:
        "- Migrated the billing service to event workers, cutting p95 latency by 38%\n- Led schema redesign that reduced storage cost by 22%"
    },
    {
      role: "Backend Engineer",
      company: "Acme",
      startDate: "2019",
      endDate: "2021",
      description: "- Built REST APIs in Node.js and PostgreSQL used by 3 internal teams"
    }
  ],
  education: [{ institution: "State University", degree: "B.S.", fieldOfStudy: "Computer Science", graduationYear: "2019" }],
  projects: [{ name: "Job parser", description: "Extracts structured requirements from postings.", technologies: ["Python"] }],
  certifications: [],
  achievements: [],
  publications: [],
  volunteer: [],
  hackathons: [],
  languages: [],
  awards: [],
  links: [{ label: "github", url: "https://github.com/janedoe" }],
  parsedText: ""
};

const JD = `Senior Backend Engineer at Northwind
Requirements
- 5+ years of backend experience
- Strong TypeScript and Node.js
- PostgreSQL and Redis
- Docker and CI/CD
- Bachelor's degree in Computer Science
Responsibilities
- Build reliable APIs
Nice to have
- Kubernetes
- GraphQL
`;

test("identical input and configuration produce identical scores and hashes", () => {
  const first = computeAtsScore({ resume: RESUME, jobDescription: JD });
  const second = computeAtsScore({ resume: RESUME, jobDescription: JD });

  assert.equal(first.score, second.score);
  assert.equal(first.inputHash, second.inputHash);
  assert.equal(first.mode, "job-targeted");
  assert.deepEqual(first.missingSkills, second.missingSkills);
});

test("changing the job description changes the hash and gap list", () => {
  const base = computeAtsScore({ resume: RESUME, jobDescription: JD });
  const other = computeAtsScore({
    resume: RESUME,
    jobDescription: JD.replace("PostgreSQL and Redis", "Elixir and RabbitMQ")
  });

  assert.notEqual(base.inputHash, other.inputHash);
  assert.ok(other.missingSkills.some((skill) => /Elixir|Message Queues/i.test(skill)) || other.missingSkills.length > 0);
});

test("report exposes matched and missing evidence plus a weighted breakdown", () => {
  const report = computeAtsScore({ resume: RESUME, jobDescription: JD });

  assert.ok(report.matchedSkills.includes("Node.js"));
  assert.ok(report.matchedSkills.includes("PostgreSQL"));
  assert.ok(report.missingSkills.includes("Redis"));
  assert.ok(report.score > 40 && report.score <= 100);
  assert.ok(report.scoreBreakdown.required_skills.applicable);
  assert.ok(report.recommendations.length > 0);

  const applicableWeights = Object.values(report.scoreBreakdown)
    .filter((dimension) => dimension.applicable)
    .reduce((sum, dimension) => sum + dimension.weight, 0);
  assert.ok(Math.abs(applicableWeights - 1) < 0.01);
});

test("weights are configurable and affect the score deterministically", () => {
  const skillHeavy = computeAtsScore({
    resume: RESUME,
    jobDescription: JD,
    weights: { required_skills: 1, keyword_coverage: 0, preferred_skills: 0, experience_alignment: 0, role_alignment: 0, education_alignment: 0, section_completeness: 0, formatting: 0, achievement_evidence: 0 }
  });
  const formattingHeavy = computeAtsScore({
    resume: RESUME,
    jobDescription: JD,
    weights: { required_skills: 0, keyword_coverage: 0, preferred_skills: 0, experience_alignment: 0, role_alignment: 0, education_alignment: 0, section_completeness: 0, formatting: 1, achievement_evidence: 0 }
  });

  assert.equal(skillHeavy.score, skillHeavy.scoreBreakdown.required_skills.score);
  assert.equal(formattingHeavy.score, formattingHeavy.scoreBreakdown.formatting.score);
});

test("resume-only mode skips job-dependent dimensions instead of scoring zero", () => {
  const report = computeAtsScore({ resume: RESUME });
  assert.equal(report.mode, "resume-only");
  assert.equal(report.scoreBreakdown.required_skills.applicable, false);
  assert.equal(report.scoreBreakdown.keyword_coverage.applicable, false);
  assert.ok(report.scoreBreakdown.section_completeness.applicable);
  assert.ok(report.score > 0);
});

test("formatting warnings are surfaced with severity", () => {
  const report = computeAtsScore({
    resume: { ...RESUME, email: "", phone: "", experience: [{ role: "Engineer", company: "X", description: "Did things." }] },
    jobDescription: JD
  });
  const codes = report.warnings.map((warning) => warning.code);
  assert.ok(codes.includes("NO_CONTACT"));
  assert.ok(report.issues.length === report.warnings.length);
});

test("experience years are estimated from overlapping date ranges", () => {
  const estimate = estimateResumeExperienceYears(RESUME.experience, new Date("2026-01-01T00:00:00Z"));
  assert.ok(estimate.years >= 6 && estimate.years <= 7.1, `expected about 7 years, received ${estimate.years}`);
  assert.equal(estimate.hasDates, true);

  const undated = estimateResumeExperienceYears([{ role: "X", company: "Y" }]);
  assert.equal(undated.hasDates, false);
});

test("default weights sum to one", () => {
  const total = Object.values(DEFAULT_ATS_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test("parsed job can be supplied directly and is used as-is", () => {
  const parsed = parseJobDescription(JD);
  const report = computeAtsScore({ resume: RESUME, parsedJob: parsed });
  assert.equal(report.job.title, parsed.title);
  assert.equal(report.mode, "job-targeted");
});

import test from "node:test";
import assert from "node:assert/strict";
import { computeJobMatch } from "../src/services/jobMatchEngine.js";

const RESUME = {
  title: "Backend Resume",
  summary: "Backend engineer with Node.js and PostgreSQL experience.",
  skills: ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
  experience: [
    {
      role: "Senior Backend Engineer",
      company: "Northwind",
      startDate: "2021",
      endDate: "Present",
      description: "- Built Node.js services backed by PostgreSQL, cutting p95 latency by 38%"
    }
  ],
  projects: [{ name: "Job parser", description: "Parses postings with Python and FastAPI.", technologies: ["Python", "FastAPI"] }],
  education: [{ institution: "State University", degree: "B.S.", fieldOfStudy: "Computer Science", graduationYear: "2019" }]
};

const JD = `Senior Backend Engineer
Requirements
- 5+ years of backend experience
- Strong TypeScript and Node.js
- PostgreSQL and Redis
- Kubernetes
Nice to have
- GraphQL
- AWS Lambda
`;

test("job match is deterministic for identical input", () => {
  const first = computeJobMatch({ resume: RESUME, jobDescription: JD });
  const second = computeJobMatch({ resume: RESUME, jobDescription: JD });
  assert.equal(first.match_percentage, second.match_percentage);
  assert.deepEqual(first.missing_skills, second.missing_skills);
});

test("job match reports matched skills, critical gaps, and evidence", () => {
  const result = computeJobMatch({ resume: RESUME, jobDescription: JD });
  assert.ok(result.matched_skills.includes("Node.js"));
  assert.ok(result.missing_skills.includes("Redis"));
  assert.ok(result.critical_gaps.length > 0);
  assert.ok(result.critical_gaps.every((gap) => typeof gap.jdMentions === "number"));
  assert.ok(result.evidence["Node.js"].length > 0);
  assert.ok(result.roadmap.length > 0);
  assert.ok(result.roadmap.every((item) => item.timeline));
  assert.ok(result.project_suggestions.length === result.roadmap.length);
});

test("preferred skills are separated from required gaps", () => {
  const result = computeJobMatch({ resume: RESUME, jobDescription: JD });
  assert.ok(result.preferred_gaps.includes("GraphQL") || result.missing_skills.includes("GraphQL"));
  assert.ok(!result.preferred_gaps.includes("Redis"));
});

test("requirement matrix flags met and unmet lines", () => {
  const result = computeJobMatch({ resume: RESUME, jobDescription: JD });
  assert.ok(result.requirements.length > 0);
  assert.ok(result.requirements.every((row) => ["met", "gap"].includes(row.status)));
  assert.ok(result.requirement_summary.total === result.requirements.length);
});

test("missing skills drive a prioritized roadmap without unrelated technologies", () => {
  const result = computeJobMatch({
    resume: { ...RESUME, skills: ["Node.js"] },
    jobDescription: "Requirements\n- Kubernetes\n- Terraform\n- Go"
  });
  const roadmapSkills = result.roadmap.map((item) => item.skill);
  assert.ok(roadmapSkills.length > 0);
  assert.ok(roadmapSkills.every((skill) => ["Kubernetes", "Terraform", "Go"].includes(skill)));
});

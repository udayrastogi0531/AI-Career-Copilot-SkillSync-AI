import test from "node:test";
import assert from "node:assert/strict";
import {
  extractEducationRequirement,
  extractExperienceRequirement,
  extractKeywords,
  parseJobDescription,
  requirementCoverage,
  splitSections
} from "../src/services/jdParser.js";

const SAMPLE_JD = `Senior Backend Engineer
Northwind Analytics — Remote (EU)

About the role
We build data platforms for logistics customers.

Responsibilities
- Design and ship Node.js services that process millions of events per day
- Own PostgreSQL schema design and query performance
- Partner with product on API contracts

Requirements
- 5+ years of professional backend experience
- Strong TypeScript and Node.js
- Hands-on experience with PostgreSQL and Redis
- Experience with Docker and CI/CD pipelines
- Bachelor's degree in Computer Science or equivalent

Nice to have
- Kubernetes
- GraphQL
- Experience with AWS Lambda

Benefits
- Remote-first team
`;

test("splitSections recognises standard job posting headings", () => {
  const sections = splitSections(SAMPLE_JD);
  assert.ok(sections.responsibilities.length > 0);
  assert.ok(sections.required.length > 0);
  assert.ok(sections.preferred.length > 0);
});

test("parseJobDescription extracts title, skills, and requirement sections", () => {
  const parsed = parseJobDescription(SAMPLE_JD);
  assert.equal(parsed.title, "Senior Backend Engineer");
  assert.ok(parsed.requiredSkills.includes("Node.js"));
  assert.ok(parsed.requiredSkills.includes("TypeScript"));
  assert.ok(parsed.requiredSkills.includes("PostgreSQL"));
  assert.ok(parsed.preferredSkills.includes("Kubernetes"));
  assert.ok(!parsed.requiredSkills.includes("Kubernetes"));
  assert.ok(parsed.responsibilities.length >= 3);
  assert.ok(parsed.keywords.length > 5);
  assert.equal(parsed.source.type, "pasted");
});

test("company and title words are not misread as required skills", () => {
  const parsed = parseJobDescription(
    "Senior Backend Engineer at Northwind Analytics, Remote EU.\n" +
      "Requirements: Strong TypeScript and Node.js. Hands-on PostgreSQL and Redis."
  );
  assert.ok(parsed.requiredSkills.includes("Node.js"));
  assert.ok(parsed.requiredSkills.includes("PostgreSQL"));
  assert.ok(!parsed.requiredSkills.includes("Data Analysis"));
});

test("nice-to-have skills stay preferred when the posting has no requirements heading", () => {
  const parsed = parseJobDescription(
    "Senior Backend Engineer at Northwind Analytics, Remote EU.\n" +
      "Requirements: Strong TypeScript and Node.js. Hands-on PostgreSQL and Redis.\n" +
      "Nice to have\n- Kubernetes\n- GraphQL"
  );
  assert.ok(parsed.requiredSkills.includes("Node.js"));
  assert.ok(parsed.requiredSkills.includes("PostgreSQL"));
  assert.ok(!parsed.requiredSkills.includes("Kubernetes"));
  assert.ok(parsed.preferredSkills.includes("Kubernetes"));
  assert.ok(parsed.preferredSkills.includes("GraphQL"));
});

test("parseJobDescription never invents unknown fields", () => {
  const parsed = parseJobDescription("Short posting. Apply now.");
  assert.equal(parsed.company, "");
  assert.deepEqual(parsed.requiredSkills, []);
  assert.ok(parsed.warnings.length > 0);
});

test("extractExperienceRequirement reads ranges and minimums", () => {
  assert.deepEqual(extractExperienceRequirement("3-5 years of experience required").minYears, 3);
  assert.deepEqual(extractExperienceRequirement("Minimum of 7 years experience").minYears, 7);
  assert.equal(extractExperienceRequirement("No experience required").minYears, 0);
});

test("extractEducationRequirement ranks degrees", () => {
  assert.equal(extractEducationRequirement("Master's degree required").rank, 4);
  assert.equal(extractEducationRequirement("PhD preferred").level, "Doctorate");
  assert.equal(extractEducationRequirement("No degree required").rank, 0);
});

test("extractKeywords excludes stopwords and keeps repeated terms", () => {
  const keywords = extractKeywords("kafka kafka pipeline pipeline pipeline event streaming", []);
  assert.ok(keywords.includes("kafka"));
  assert.ok(keywords.includes("pipeline"));
  assert.ok(!keywords.includes("the"));
});

test("requirementCoverage reports evidence per requirement line", () => {
  const resumeText = "Built Node.js services with PostgreSQL and Redis. Containerised with Docker.";
  const coverage = requirementCoverage(
    ["Strong TypeScript and Node.js", "Hands-on experience with PostgreSQL and Redis", "Kubernetes experience"],
    resumeText
  );
  assert.equal(coverage.total, 3);
  assert.equal(coverage.passed, 2);
  assert.equal(coverage.rows[2].passed, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSkillList, extractSkills, matchSkills, normalizeSkill } from "../src/utils/skillDictionary.js";

test("normalizeSkill maps aliases to canonical names", () => {
  assert.equal(normalizeSkill("nodejs"), "Node.js");
  assert.equal(normalizeSkill("React.js"), "React");
  assert.equal(normalizeSkill("TS"), "TypeScript");
  assert.equal(normalizeSkill("k8s"), "Kubernetes");
  assert.equal(normalizeSkill("unknown-thing"), "");
});

test("extractSkills finds distinct canonical skills in free text", () => {
  const text =
    "Built REST services in Node.js and TypeScript, containerised with Docker, deployed to AWS EKS, and queried PostgreSQL.";
  const skills = extractSkills(text);
  assert.ok(skills.includes("Node.js"));
  assert.ok(skills.includes("TypeScript"));
  assert.ok(skills.includes("Docker"));
  assert.ok(skills.includes("AWS"));
  assert.ok(skills.includes("PostgreSQL"));
  assert.ok(skills.includes("REST APIs"));
  assert.equal(new Set(skills).size, skills.length);
});

test("extractSkills prefers longer aliases over substrings", () => {
  const skills = extractSkills("Shipped a React Native app and a React web dashboard.");
  assert.ok(skills.includes("React Native"));
  assert.ok(skills.includes("React"));
});

test("extractSkills does not match inside unrelated words", () => {
  const skills = extractSkills("I enjoy rendering graphics and going for runs.");
  assert.ok(!skills.includes("Go"));
  assert.ok(!skills.includes("R"));
});

test("matchSkills compares canonical forms case-insensitively", () => {
  const result = matchSkills(["Node.js", "GraphQL", "Terraform"], ["nodejs", "graphql"]);
  assert.deepEqual(result.matched.sort(), ["GraphQL", "Node.js"]);
  assert.deepEqual(result.missing, ["Terraform"]);
});

test("catalogue has no duplicate canonical names", () => {
  const names = canonicalSkillList();
  assert.equal(new Set(names).size, names.length);
});

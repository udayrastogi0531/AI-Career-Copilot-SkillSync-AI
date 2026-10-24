/**
 * Curated knowledge base for the grounded career coach.
 *
 * Every entry is general, non-personal career guidance. Content is short by
 * design: the coach retrieves chunks and cites them, and it must be able to
 * quote only what is actually written here.
 */
export const KNOWLEDGE_VERSION = "2026-10-01";

export const CAREER_KNOWLEDGE = [
  {
    id: "star-method",
    title: "Structuring behavioural answers with STAR",
    url: "https://www.themuse.com/advice/star-interview-method",
    content: `The STAR method structures a behavioural answer in four parts: Situation, Task, Action, Result.
Situation: one or two sentences of context, including the team, product, or constraint.
Task: the specific responsibility or problem you personally owned.
Action: the steps you took, with decisions and trade-offs. Use "I" for your own actions.
Result: the outcome, ideally measurable, plus what you learned or changed afterwards.
Keep the whole answer to 60-120 seconds. Prepare three to five stories that can be adapted to many questions: a conflict, a failure, a leadership moment, a technical trade-off, and a high-impact delivery.
Do not invent metrics. If a number is unknown, describe the qualitative outcome ("the release stopped blocking the migration") instead.`
  },
  {
    id: "ats-basics",
    title: "How applicant tracking systems parse resumes",
    url: "https://www.jobscan.co/blog/ats-resume/",
    content: `Most applicant tracking systems convert your file to plain text before a human reads it. Practical consequences:
Use a single-column layout. Multi-column tables, text boxes, headers, and footers often reorder or drop content.
Use standard section headings such as Summary, Experience, Education, Skills, and Projects so parsers can classify content.
Put dates next to roles in a consistent format (for example "Mar 2022 -- Present").
Prefer common fonts and standard bullet characters. Emoji, icons, and unusual glyphs can be stripped.
Spell out an acronym once and include the acronym: "Search Engine Optimisation (SEO)".
Save as PDF unless the posting explicitly requests DOCX.
ATS scoring is not standardised across vendors. Treat any "ATS score" from a third party as an estimate, not a guarantee.`
  },
  {
    id: "resume-bullets",
    title: "Writing strong resume bullets",
    url: "https://www.indeed.com/career-advice/resumes-cover-letters/resume-bullet-points",
    content: `A strong resume bullet follows: Action verb + what you did + how + outcome.
Lead with a specific verb (Built, Migrated, Reduced, Negotiated) rather than "Responsible for".
Name the technology, system, or audience so the bullet is concrete.
End with the result: latency, cost, revenue, adoption, defect rate, or time saved.
Keep bullets to one or two lines. Cut adjectives that carry no evidence.
Quantify only what you can defend in an interview. If you do not know the exact number, use a bounded and truthful statement such as "cutting manual review steps from hours to minutes".
Mirror the employer's terminology for real skills, not to claim skills you do not have.`
  },
  {
    id: "interview-technical",
    title: "Preparing for technical interviews",
    url: "https://github.com/donnemartin/system-design-primer",
    content: `Technical interviews usually sample four areas: coding, design, debugging, and communication.
For coding, practise stating assumptions, then a brute-force approach, then optimisations. Test with edge cases out loud before declaring completion.
For design, start with requirements and scale, sketch the data model, then trace the main request path. Discuss failure modes, caching, and consistency trade-offs. Finish with what you would monitor.
For debugging, narrate a hypothesis-driven process: reproduce, isolate, instrument, fix, verify, and add a regression test.
For communication, think aloud, ask clarifying questions, and summarise the decision you made. Interviewers score the process as much as the final answer.`
  },
  {
    id: "behavioural-questions",
    title: "Common behavioural questions and how to prepare",
    url: "https://www.themuse.com/advice/behavioral-interview-questions-answers-examples",
    content: `Frequent behavioural prompts: tell me about a conflict with a colleague, a project that failed, a time you influenced without authority, your biggest technical trade-off, and a time you had to learn quickly.
Preparation approach: list eight meaningful projects or incidents, then note the STAR structure for each. Tag each story with the themes it can cover (conflict, leadership, ambiguity, failure, impact).
Answer with specifics: names of systems, your role, the constraint, and the result. Avoid sweeping statements about being a "team player" without evidence.
For failure questions, choose a real failure, own your part, and end with the concrete change you made afterwards.`
  },
  {
    id: "skill-gap-planning",
    title: "Closing a skill gap efficiently",
    url: "https://roadmap.sh/",
    content: `Close a skill gap with a project, not only a course. A workable loop:
1. Define the smallest useful capability ("serve a paginated REST endpoint with validation and tests").
2. Read the official documentation for that capability, not a full curriculum.
3. Build the smallest project that requires the capability.
4. Measure one outcome (latency, test coverage, query cost) so you can describe it later.
5. Write a two-paragraph note explaining the design decisions.
Two to four weeks is a realistic window for a framework or database skill at working level. Expect longer for languages, distributed systems, and machine learning.
Add the skill to your resume only after you can demonstrate it.`
  },
  {
    id: "salary-negotiation",
    title: "Negotiating an offer",
    url: "https://www.levels.fyi/blog/how-to-negotiate.html",
    content: `Negotiation basics:
Research a range from at least two sources (market data, peers in similar roles, postings). Anchor on the upper half of a defensible range.
Never negotiate before you have a written offer, and never invent a competing offer.
Ask for the full picture: base, bonus, equity, sign-on, level, and start date. Level often matters more than base for long-term compensation.
Make one clear counter with a reason ("based on the scope you described, which includes on-call ownership, I am targeting X").
Keep it short, appreciative, and factual. Ask for the decision timeline if it is unclear.
Get the final agreement in writing before resigning.`
  },
  {
    id: "career-change",
    title: "Switching roles or domains",
    url: "https://www.themuse.com/advice/how-to-change-careers",
    content: `A career change is easiest when you reuse transferable evidence.
Identify the overlap between your current work and the target role: domain knowledge, systems you have used, and adjacent responsibilities.
Rewrite your resume around the target role's vocabulary while keeping the evidence truthful. Reframe existing work rather than inventing new work.
Build one or two portfolio artifacts that match the target role's daily tasks.
Use referrals and communities in the target field; most transitions happen through people who can vouch for your working behaviour.
Expect a level shift. Decide in advance which concessions (title, salary, location) you will accept to gain the domain.`
  },
  {
    id: "cover-letter-guide",
    title: "Writing a cover letter that adds information",
    url: "https://www.indeed.com/career-advice/cover-letter/how-to-write-a-cover-letter",
    content: `A useful cover letter adds information the resume cannot carry: motivation, a specific overlap with the team's problems, and why you are applying now.
Structure: greeting, one paragraph on the role and why it fits, one or two paragraphs of concrete evidence tied to the JD's most important requirements, a short close with availability.
Keep it to one page. Avoid repeating the resume in prose.
Address a person if the posting names one; otherwise use "Dear Hiring Team".
Mention only company facts you have verified. Do not fabricate mission statements, funding, or product claims.`
  },
  {
    id: "portfolio-projects",
    title: "Choosing resume projects",
    url: "https://github.com/donnemartin/system-design-primer",
    content: `Choose projects that demonstrate the target role's core work rather than the most impressive technology.
Each project entry should state the problem, your specific role, the stack, and one measurable or verifiable outcome.
Include a link to source code or a deployed demo when possible, plus a short README describing setup, design decisions, and what you would change.
Avoid tutorial clones with renamed variables. A small, well-documented tool with tests and a deployment pipeline signals more than a large unfinished application.
Two focused projects are usually enough; depth beats quantity.`
  }
];

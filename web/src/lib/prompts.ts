import { withPromptSecurityHeader } from "./untrusted-content.ts";

// Prompt for every AI task. Each one ends by asking for a single ```json block;
// the server parses and validates it, then saves the result itself.

const TRUTH = `Truth rule: every claim about the candidate must come from the CANDIDATE SOURCES. Reformulate keywords, never fabricate skills, metrics, employers or authorship. If something is unknown, say so.`;

export type EvaluationJson = {
  company: string;
  role: string;
  location?: string;
  via?: string | null;
  archetype?: string;
  score: number;
  scores?: { match?: number; north_star?: number; comp?: number; culture?: number; red_flags?: number; global?: number };
  legitimacy_tier?: string;
  final_decision?: string;
  hard_stops?: string[];
  soft_gaps?: string[];
  top_strengths?: string[];
  risk_level?: string;
  confidence?: string;
  next_action?: string;
  discard_reasons?: string[];
  advertised_comp?: string | null;
  tldr?: string;
  sections?: Partial<Record<"role_summary" | "cv_match" | "level_strategy" | "comp_demand" | "customization" | "interview_plan" | "legitimacy" | "risks", string>>;
  keywords?: string[];
};

export function evaluatePrompt(p: { url: string; posting: string; candidate: string; today: string }): string {
  return withPromptSecurityHeader(`You evaluate one job posting for the candidate. Today is ${p.today}. Work only from the posting and candidate sources below: no tools, no browsing.

Score each dimension 1-5 (one decimal):
- match: JD requirements vs the candidate's real experience and proof points.
- north_star: fit with the target roles/archetypes in config/profile.yml and modes/_profile.md.
- comp: advertised or likely pay vs the candidate's targets (3 when unknown).
- culture: remote policy, stability, team, and profile.yml culture_screen (cap at 2 when evidence contradicts it).
- red_flags: 5 = none, lower for blockers (location/visa/seniority mismatch, deal-breakers in the profile).
- global: weighted overall (respect scoring.weights in profile.yml if set). 4.5+ apply now, 4.0-4.4 worth applying, 3.5-3.9 only with a reason, below 3.5 skip.

Posting legitimacy (separate from the score): "High Confidence", "Proceed with Caution" or "Suspicious", from JD specificity, realistic requirements, salary transparency and posting age. Never accuse; state signals.

Write each section as concise markdown for the candidate:
- role_summary: table (archetype, domain, function, seniority, remote, team size, culture screen) + one-line TL;DR. Flag a remote/onsite contradiction verbatim.
- cv_match: table mapping each key requirement to CV evidence, then gaps with a mitigation for each.
- level_strategy: level in JD vs candidate, how to position honestly.
- comp_demand: advertised comp verbatim if stated, fit vs targets, what is unknown.
- customization: the top 5 CV/summary changes for this role.
- interview_plan: 4-6 likely topics with the candidate's best matching story.
- legitimacy: signals and the tier.
- risks: bullet list of risks (location, seniority, stack, comp, legitimacy).

${TRUTH}

Answer with exactly one fenced json block and nothing after it:
\`\`\`json
{"company":"","role":"","location":"","via":null,"archetype":"","score":0,"scores":{"match":0,"north_star":0,"comp":0,"culture":0,"red_flags":0,"global":0},"legitimacy_tier":"High Confidence","final_decision":"Apply | Consider | Research first | Skip","hard_stops":[],"soft_gaps":[],"top_strengths":[],"risk_level":"Low | Medium | High","confidence":"Low | Medium | High","next_action":"","discard_reasons":[],"advertised_comp":null,"tldr":"","sections":{"role_summary":"","cv_match":"","level_strategy":"","comp_demand":"","customization":"","interview_plan":"","legitimacy":"","risks":""},"keywords":[]}
\`\`\`

Posting URL: ${p.url}
${p.posting}

${p.candidate}`);
}

export function tailorCvPrompt(p: { report: string; candidate: string; today: string }): string {
  return withPromptSecurityHeader(`You tailor the candidate's CV for one job, for an ATS-friendly PDF. Today is ${p.today}. No tools.

Use the evaluation report (JD analysis + keywords) and the candidate sources. Reorder experience bullets by relevance, put the JD's vocabulary into the summary and first bullets, choose the most relevant projects, include every relevant skill category. Up to 9 bullets for the current role, 5-7 for earlier roles, 6-11 projects with tech and 1-2 bullets each. You may wrap 1-3 key terms per bullet in **bold**. Obey any house rules in modes/_custom.md. Leave optional fields out rather than empty when unknown.

${TRUTH} Never add a skill the candidate does not have; only reword real experience in the JD's words.

Answer with exactly one fenced json block (tailored-cv contract 1.0, no other top-level keys) and nothing after it:
\`\`\`json
{"contract_version":"1.0","lang":"en","candidate":{"name":"","headline":"","phone":"","email":"","linkedin":{"url":"","display":""},"portfolio":{"url":"","display":""},"github":{"url":"","display":""},"location":""},"summary":"","competencies":[],"experience":[{"company":"","company_url":"","role":"","promotion":"","location":"","dates":"","bullets":[]}],"projects":[{"name":"","badge":"","tech":"","description":"","link":{"url":"","display":""},"dates":"","bullets":[]}],"open_source":[],"awards":[],"education":[{"title":"","org":"","year":"","description":""}],"certifications":[],"skills":[{"category":"","items":""}]}
\`\`\`

${p.report}

${p.candidate}`);
}

export function coverLetterPrompt(p: { report: string; candidate: string; today: string }): string {
  return withPromptSecurityHeader(`You write the candidate's cover letter for one job. Today is ${p.today}. No tools.

250-350 words, plain markdown, addressed to the hiring team (or the named manager if the report has one). Structure: a specific opening tied to this company/role; two short paragraphs mapping the role's top needs to the candidate's strongest real proof points with numbers; a brief close with availability. Match the candidate's own voice and any rules in modes/_profile.md and modes/_custom.md. No clichés ("I am writing to", "passionate", "synergy", "leverage"), no em dashes. Sign with the candidate's name from config/profile.yml.

${TRUTH}

Answer with exactly one fenced json block and nothing after it:
\`\`\`json
{"coverLetter":""}
\`\`\`

${p.report}

${p.candidate}`);
}

export function outreachPrompt(p: { target: string; report: string; posting: string; candidate: string; today: string; tone: string; avoid: string[] }): string {
  const avoid = p.avoid.length
    ? `\nAlready emailed at this company (pick someone else unless they are clearly THE hiring manager): ${p.avoid.slice(0, 10).map((n) => JSON.stringify(n.slice(0, 80))).join(", ")}.`
    : "";
  return withPromptSecurityHeader(`Find the ONE real person most likely to read and act on a short cold email about this role, and write that email as the candidate, in the candidate's own voice. Today is ${p.today}. You may use web search and fetch; you have no other tools.

STEP 1 — The role, from the evaluation report or posting below: company, exact title, team, company domain, and the 2-3 things the role needs most.

STEP 2 — The person, via web search. Priority: (a) the hiring manager named in the posting or whoever publicly posted this opening on LinkedIn/X; (b) the engineering leader who owns this team; (c) at companies under ~60 people, CTO then founder/CEO; (d) the technical recruiter. Never a generic inbox. Confirm they work there now (source from the last ~12 months). Every person needs a real source URL; never invent one.${avoid}

STEP 3 — Their email, best evidence first: "found" (the exact address is published; give the URL in emailEvidence), "pattern" (another real address at the domain proves the format; give that URL), or "none" (leave email empty). Never output an address you cannot back.

STEP 4 — The email. Subject 3-7 plain words specific to the role. Body 70-120 words, three short paragraphs, to their first name: (1) one concrete true detail about the team/posting; (2) one or two real proof points with numbers mapped to the role, plus ONE proof link (outreach.lead_proof, else the best outreach.proofs entry, else portfolio/GitHub from the sources); (3) a low-friction ask for 15 minutes this week, offering outreach.calendar_link if set. Sign with the first name and one footer line of links from profile.yml. Follow outreach.notes (they win over cv.md). Tone: ${p.tone || "outreach.tone from profile.yml, default confident"} (polite = warm; confident = direct, peer to peer; spicy = bold opener, light humour, still professional). Copy HOW the candidate writes from writing samples / voice-dna.md, never WHAT they wrote. Never use outreach.never_say, "I hope this finds you well", "I am writing to", "I came across", "passionate", "synergy", "leverage", "cutting-edge", em dashes, or exclamation marks (unless the samples use them). Also write linkedinNote: the same pitch in at most 280 characters.

STEP 5 — Three follow-ups for day 3, 5 and 7, each at most 60 words and adding something new. STEP 6 — Up to 2 alternates with the same fields as contact.

${TRUTH} Never send anything or contact anyone. If no real person can be found, return the JSON with an empty contact name.

Answer with exactly one fenced json block and nothing after it:
\`\`\`json
{"company":"","role":"","jobUrl":"","companyDomain":"","contact":{"name":"","title":"","email":"","emailConfidence":"found|pattern|none","emailEvidence":"","linkedin":"","x":"","sourceUrl":"","why":""},"alternates":[],"subject":"","body":"","linkedinNote":"","followups":[{"day":3,"body":""},{"day":5,"body":""},{"day":7,"body":""}]}
\`\`\`

Target: ${p.target}
${p.report}${p.posting}

${p.candidate}`);
}

export function searchPrompt(p: { query: string; known: string; portals: string; candidate: string; today: string }): string {
  return withPromptSecurityHeader(`You find open jobs on the public web for the candidate. Today is ${p.today}. You may use web search and fetch; you have no other tools. You are a finder, not a judge: never score fit (a later evaluation does that).

Strategy:
1. Read the request, the candidate sources and portals.yml (search_queries, tracked_companies, location_filter).
2. Run 3-6 focused searches: adapt enabled portals.yml search_queries to the request, then tracked companies not in ALREADY KNOWN, then direct ATS boards (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:apply.workable.com).
3. Also look for public hiring posts on LinkedIn (public posts only), Reddit (e.g. r/forhire, r/remotejs, r/cscareerquestions hiring threads) and X. Never log in or scrape behind a login. A post without a direct job page is kind "hiring-signal"; a direct job detail page is kind "vacancy".
4. Treat portals.yml location_filter as a hard filter: drop roles whose known location matches neither always_allow nor allow unless a relocation keyword is present. Keep unknown-location roles and say so in "why".
5. Skip anything in ALREADY KNOWN, closed/404 postings, and unrelated titles. Prefer direct ATS URLs over aggregator mirrors. Never invent a URL, company or role.
6. Stop at 5-12 strong results.

Output: between results, narrate briefly in plain text what you are searching. Emit each result the moment you are confident as ONE line, never in a code fence:
<<offer:{"url":"https://…","title":"…","company":"…","location":"…","source":"ai-search","discoveredFrom":"public source name","kind":"vacancy|hiring-signal","why":"one line: why it matches; note uncertainty","postedAt":"YYYY-MM-DD only if shown","postedHint":"~3d ago | unknown","ats":"greenhouse|lever|ashby|workday|other","verification":"unconfirmed","confidence":"low|medium|high"}>>

Request: ${p.query}

--- ALREADY KNOWN (do not propose these) ---
${p.known}

${p.portals}

${p.candidate}`);
}

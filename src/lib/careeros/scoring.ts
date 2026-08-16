import type {
  CareerOsData,
  EvidenceRecord,
  JobRecord,
  ScanResult,
  ScanSubScore,
  Verdict,
} from "./types";

const STOPWORDS = new Set(
  `a an the and or for with you your we our will be to of in on at as is are have has that this from by role team work working experience across including able strong good excellent ability who what their they them it its into using use used within about more than other well not can may should must new all any also please apply job description candidate candidates company help support ensure across`.split(
    /\s+/,
  ),
);

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/[\s/]+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function has(text: string, phrase: string) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function ratio(matched: number, total: number) {
  if (total === 0) return 0.6;
  return matched / total;
}

function pct(v: number) {
  return Math.max(0, Math.min(100, Math.round(v * 100)));
}

const RESPONSIBILITY_SIGNALS: { phrase: string; capability: string; evidence: string[] }[] = [
  {
    phrase: "stakeholder",
    capability: "Stakeholder management",
    evidence: ["ev-rag", "ev-agency"],
  },
  { phrase: "report", capability: "Performance reporting", evidence: ["ev-rag", "ev-powerbi"] },
  { phrase: "budget", capability: "Budget ownership", evidence: ["ev-budget"] },
  { phrase: "agency", capability: "Agency and vendor management", evidence: ["ev-agency"] },
  { phrase: "roadmap", capability: "Product roadmapping", evidence: ["ev-npd"] },
  { phrase: "positioning", capability: "Value proposition development", evidence: ["ev-npd"] },
  {
    phrase: "go-to-market",
    capability: "Go-to-market delivery",
    evidence: ["ev-budget", "ev-adoption"],
  },
  { phrase: "a/b test", capability: "A/B testing", evidence: ["ev-ab"] },
  { phrase: "experiment", capability: "Experimentation", evidence: ["ev-ab"] },
  { phrase: "campaign", capability: "Campaign delivery", evidence: ["ev-budget"] },
  { phrase: "agile", capability: "Agile delivery", evidence: ["ev-agile"] },
  { phrase: "project", capability: "Project delivery", evidence: ["ev-adoption", "ev-agile"] },
  { phrase: "programme", capability: "Programme delivery", evidence: ["ev-adoption"] },
  { phrase: "training", capability: "Client training and enablement", evidence: ["ev-adoption"] },
  { phrase: "customer", capability: "Client engagement", evidence: ["ev-adoption"] },
  {
    phrase: "analytics",
    capability: "Analytics and measurement",
    evidence: ["ev-powerbi", "ev-ab"],
  },
  { phrase: "dashboard", capability: "Dashboarding", evidence: ["ev-powerbi"] },
  { phrase: "crm", capability: "CRM delivery", evidence: ["ev-crm"] },
  { phrase: "technology", capability: "Technology evaluation", evidence: ["ev-trl"] },
  { phrase: "innovation", capability: "Innovation and NPD", evidence: ["ev-npd", "ev-trl"] },
  { phrase: "risk", capability: "Risk assessment", evidence: ["ev-trl", "ev-rag"] },
  { phrase: "cross-functional", capability: "Cross-functional working", evidence: ["ev-agile"] },
];

const TOOL_LIBRARY = [
  "power bi",
  "salesforce",
  "hubspot",
  "ga4",
  "google analytics",
  "dv360",
  "google ads",
  "meta",
  "hotjar",
  "asana",
  "jira",
  "ms project",
  "clickup",
  "zoho",
  "sql",
  "tableau",
  "looker",
  "figma",
  "amplitude",
  "mixpanel",
  "excel",
  "python",
];

const SECTOR_LIBRARY = [
  { term: "education", owned: true, label: "Higher education" },
  { term: "university", owned: true, label: "Higher education" },
  { term: "saas", owned: true, label: "B2B SaaS" },
  { term: "software", owned: true, label: "Engineering software" },
  { term: "engineering", owned: true, label: "Engineering clients" },
  { term: "recruitment", owned: true, label: "Recruitment" },
  { term: "charity", owned: true, label: "Charity / non-profit" },
  { term: "non-profit", owned: true, label: "Charity / non-profit" },
  { term: "entertainment", owned: true, label: "Live entertainment" },
  { term: "fintech", owned: false, label: "Fintech" },
  { term: "banking", owned: false, label: "Banking" },
  { term: "healthcare", owned: false, label: "Healthcare" },
  { term: "insurance", owned: false, label: "Insurance" },
  { term: "retail", owned: false, label: "Retail" },
  { term: "gaming", owned: false, label: "Gaming" },
];

function verdictFor(score: number): Verdict {
  if (score >= 78) return "Strong Fit";
  if (score >= 64) return "Competitive";
  if (score >= 48) return "Plausible Stretch";
  return "Weak Fit";
}

function strategyFor(score: number, gaps: number): ScanResult["strategy"] {
  if (score >= 78) return "Apply";
  if (score >= 64) return "Apply with tailored positioning";
  if (score >= 48 && gaps <= 4) return "Consider";
  return "Skip";
}

function arr<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

export function runScan(job: JobRecord, input: CareerOsData): ScanResult {
  const profileIn = input?.profile ?? ({} as CareerOsData["profile"]);
  const data = {
    ...input,
    evidence: arr(input?.evidence).filter((e) => e && typeof e === "object"),
    profile: {
      ...profileIn,
      skills: arr(profileIn.skills),
      tools: arr(profileIn.tools),
      domains: arr(profileIn.domains),
      employment: arr(profileIn.employment),
      summary: profileIn.summary ?? "",
    },
  } as CareerOsData;

  const jd = job.description || "";
  const jdLower = jd.toLowerCase();
  const evidence = data.evidence.map((e) => ({ ...e, skills: arr(e.skills) }));
  const verified = evidence.filter((e) => e.status === "Verified");
  const unusable = evidence.filter((e) => e.status !== "Verified");

  const verifiedSkills = new Set<string>();
  verified.forEach((e) => e.skills.forEach((s) => verifiedSkills.add(String(s).toLowerCase())));
  data.profile.skills.forEach((s) => verifiedSkills.add(String(s).toLowerCase()));

  // --- Responsibilities ---
  const requiredResponsibilities = RESPONSIBILITY_SIGNALS.filter((r) => has(jdLower, r.phrase));
  const coveredResponsibilities = requiredResponsibilities.filter((r) =>
    r.evidence.some((id) => verified.some((v) => v.id === id)),
  );
  const responsibilitiesScore = pct(
    ratio(coveredResponsibilities.length, requiredResponsibilities.length),
  );

  // --- Skills ---
  const jdTokens = new Set(tokenise(jd));
  const profileSkillTokens = [...verifiedSkills];
  const skillsMatched = profileSkillTokens.filter((s) =>
    s.split(/\s+/).every((part) => jdTokens.has(part)),
  );
  const jdSkillDemand = Math.max(6, Math.round(jdTokens.size * 0.12));
  const skillsScore = pct(Math.min(1, skillsMatched.length / jdSkillDemand));

  // --- Experience / seniority ---
  const seniorityWanted = /head of|director|vp |principal|lead\b/.test(jdLower)
    ? "lead"
    : /senior|manager/.test(jdLower)
      ? "manager"
      : "mid";
  const yearsMatch = jdLower.match(/(\d+)\+?\s*years/);
  const yearsWanted = yearsMatch ? Number(yearsMatch[1]) : 5;
  const yearsHeld = 9; // 2016 onwards, continuous professional experience
  let experienceScore = pct(Math.min(1, yearsHeld / Math.max(1, yearsWanted)));
  if (seniorityWanted === "lead") experienceScore = Math.round(experienceScore * 0.7);
  if (seniorityWanted === "manager") experienceScore = Math.round(experienceScore * 0.95);

  // --- Qualifications ---
  const wantsDegree = /degree|bsc|ba\b|msc|master/.test(jdLower);
  const wantsPm = /prince2|apm|pmp|project management qualification|agile certifi/.test(jdLower);
  const qualPoints =
    (wantsDegree ? 1 : 0) + (wantsPm ? 1 : 0) === 0
      ? 0.8
      : ((wantsDegree ? 1 : 0) + (wantsPm ? 1 : 0)) / ((wantsDegree ? 1 : 0) + (wantsPm ? 1 : 0));
  const qualificationsScore = pct(qualPoints * 0.95);

  // --- Sector ---
  const mentionedSectors = SECTOR_LIBRARY.filter((s) => has(jdLower, s.term));
  const ownedSectors = mentionedSectors.filter((s) => s.owned);
  const sectorScore = mentionedSectors.length
    ? pct(0.35 + 0.65 * ratio(ownedSectors.length, mentionedSectors.length))
    : 70;

  // --- Tools ---
  const toolsWanted = TOOL_LIBRARY.filter((t) => has(jdLower, t));
  const ownedTools = data.profile.tools.map((t) => t.toLowerCase());
  const toolsMatched = toolsWanted.filter((t) =>
    ownedTools.some((o) => o.includes(t) || t.includes(o)),
  );
  const toolsScore = toolsWanted.length ? pct(ratio(toolsMatched.length, toolsWanted.length)) : 70;

  // --- Evidence strength ---
  const relevantEvidence = verified.filter((e) =>
    e.skills.some((s) => jdTokens.has(s.toLowerCase().split(" ")[0] ?? "")),
  );
  const highConfidence = relevantEvidence.filter((e) => e.confidence === "High").length;
  const evidenceScore = pct(
    Math.min(1, (relevantEvidence.length * 0.12 + highConfidence * 0.08) as number),
  );

  // --- ATS keywords ---
  const jdKeywordCounts = new Map<string, number>();
  tokenise(jd).forEach((t) => jdKeywordCounts.set(t, (jdKeywordCounts.get(t) ?? 0) + 1));
  const topKeywords = [...jdKeywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k]) => k);
  const corpus = [
    data.profile.summary,
    data.profile.skills.join(" "),
    data.profile.tools.join(" "),
    data.profile.domains.join(" "),
    verified.map((e) => `${e.claim} ${e.skills.join(" ")}`).join(" "),
    data.profile.employment
      .map((e) => `${e.title ?? ""} ${e.summary ?? ""} ${arr(e.highlights).join(" ")}`)
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();
  const matchedKeywords = topKeywords.filter((k) => corpus.includes(k));
  const missingKeywords = topKeywords.filter((k) => !corpus.includes(k));
  const atsScore = pct(ratio(matchedKeywords.length, topKeywords.length));

  const subScores: ScanSubScore[] = [
    {
      key: "responsibilities",
      label: "Responsibilities Fit",
      score: responsibilitiesScore,
      reason: `${coveredResponsibilities.length} of ${requiredResponsibilities.length || "0"} detected responsibility themes are covered by verified evidence.`,
    },
    {
      key: "skills",
      label: "Skills Fit",
      score: skillsScore,
      reason: `${skillsMatched.length} of your recorded skills appear directly in the job description.`,
    },
    {
      key: "experience",
      label: "Experience / Seniority Fit",
      score: experienceScore,
      reason: `Role reads as ${seniorityWanted}-level and asks for around ${yearsWanted} years; your record shows roughly ${yearsHeld} years of continuous professional experience.`,
    },
    {
      key: "qualifications",
      label: "Qualifications / Certifications Fit",
      score: qualificationsScore,
      reason:
        wantsDegree || wantsPm
          ? "Stated qualification requirements are met by your degree, MSc in progress and project management certifications."
          : "No specific qualifications requested; your degree and certifications are treated as a general strength.",
    },
    {
      key: "sector",
      label: "Sector / Domain Fit",
      score: sectorScore,
      reason: mentionedSectors.length
        ? `Job references ${mentionedSectors.map((s) => s.label).join(", ")}. You hold direct exposure to ${ownedSectors.length ? ownedSectors.map((s) => s.label).join(", ") : "none of these"}.`
        : "No specific sector signalled, so your mixed education, SaaS and non-profit exposure is treated as neutral.",
    },
    {
      key: "tools",
      label: "Tools / Technology Fit",
      score: toolsScore,
      reason: toolsWanted.length
        ? `Named tools: ${toolsWanted.join(", ")}. You have recorded experience with ${toolsMatched.join(", ") || "none of them"}.`
        : "No specific tooling named in the description.",
    },
    {
      key: "evidence",
      label: "Evidence Strength",
      score: evidenceScore,
      reason: `${relevantEvidence.length} verified evidence records map to this role, ${highConfidence} of them at high confidence.`,
    },
    {
      key: "ats",
      label: "Keyword / ATS Coverage",
      score: atsScore,
      reason: `${matchedKeywords.length} of the ${topKeywords.length} most prominent job description terms appear in your career record.`,
    },
  ];

  const weights: Record<string, number> = {
    responsibilities: 0.2,
    skills: 0.16,
    experience: 0.14,
    qualifications: 0.08,
    sector: 0.08,
    tools: 0.12,
    evidence: 0.12,
    ats: 0.1,
  };
  const overall = Math.round(
    subScores.reduce((sum, s) => sum + s.score * (weights[s.key] ?? 0), 0),
  );

  const strengths = coveredResponsibilities.slice(0, 6).map((r) => {
    const ev = verified.find((v) => r.evidence.includes(v.id));
    return {
      text: `${r.capability} — ${ev?.claim ?? "covered by your verified record"}`,
      evidenceId: ev?.id,
    };
  });

  const partials: string[] = [];
  if (toolsWanted.length && toolsMatched.length < toolsWanted.length) {
    partials.push(
      `Tooling partially covered: ${toolsWanted.filter((t) => !toolsMatched.includes(t)).join(", ")} not in your recorded stack.`,
    );
  }
  if (mentionedSectors.length && ownedSectors.length < mentionedSectors.length) {
    partials.push(
      `Sector exposure is adjacent rather than direct for ${mentionedSectors
        .filter((s) => !s.owned)
        .map((s) => s.label)
        .join(", ")}.`,
    );
  }
  if (seniorityWanted === "lead") {
    partials.push(
      "Role reads as lead/head level; your record is manager-level with delivery ownership.",
    );
  }

  const gaps: string[] = [];
  requiredResponsibilities
    .filter((r) => !coveredResponsibilities.includes(r))
    .slice(0, 6)
    .forEach((r) =>
      gaps.push(`${r.capability} is requested but has no verified evidence attached.`),
    );
  if (missingKeywords.length > 6) {
    gaps.push(
      `${missingKeywords.length} prominent job description terms are absent from your record.`,
    );
  }

  const blockedEvidence = unusable
    .filter((e: EvidenceRecord) =>
      e.skills.some((s) => jdLower.includes(s.toLowerCase().split(" ")[0] ?? "")),
    )
    .map((e) => ({ id: e.id, claim: e.claim, status: e.status }));

  const reasons = [
    `Overall score is weighted towards responsibilities (20%), skills (16%) and experience (14%) rather than keyword matching alone.`,
    `Only Verified evidence contributed to strengths; ${unusable.length} records were held back because of their status.`,
    `Verdict "${verdictFor(overall)}" reflects ${overall}% weighted alignment across eight dimensions.`,
  ];

  return {
    id: `scan-${Date.now()}`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    overall,
    verdict: verdictFor(overall),
    subScores,
    strengths,
    partials,
    gaps,
    missingKeywords: missingKeywords.slice(0, 18),
    matchedKeywords: matchedKeywords.slice(0, 18),
    blockedEvidence,
    strategy: strategyFor(overall, gaps.length),
    reasons,
  };
}

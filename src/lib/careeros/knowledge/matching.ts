import type { EmploymentRole, KnowledgeItem, KnowledgeStatus } from "./types";
import type { EvidenceStatus, JobRecord, ScanResult, Verdict } from "../types";

const STOPWORDS = new Set(
  `a an the and or for with you your we our will be to of in on at as is are have has that this from by role team work working experience across including able strong good excellent ability who what their they them it its into using use used within about more than other well not can may should must new all any also please apply job description candidate candidates company help support ensure`.split(/\s+/),
);

const ELIGIBLE = new Set<KnowledgeStatus>(["verified", "user_confirmed"]);
const CAUTION = new Set<KnowledgeStatus>(["imported_cv", "imported_linkedin", "needs_verification"]);
const BLOCKED = new Set<KnowledgeStatus>(["archived", "excluded"]);

function tokenise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/[\s/]+/)
    .map((word) => word.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function pct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

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

export function classifyKnowledgeForMatching(items: KnowledgeItem[]) {
  return {
    eligible: items.filter((item) => ELIGIBLE.has(item.status as KnowledgeStatus)),
    caution: items.filter((item) => CAUTION.has(item.status as KnowledgeStatus)),
    blocked: items.filter((item) => BLOCKED.has(item.status as KnowledgeStatus)),
  };
}

function itemText(item: KnowledgeItem) {
  return [item.title, item.content, item.star_context, item.star_action, item.star_result]
    .filter(Boolean)
    .join(" ");
}

function roleYears(roles: EmploymentRole[]) {
  const intervals = roles
    .map((role) => {
      if (!role.start_date) return null;
      const start = new Date(`${role.start_date.slice(0, 10)}T00:00:00Z`).getTime();
      const endValue = role.is_current ? new Date().toISOString().slice(0, 10) : role.end_date;
      if (!endValue) return null;
      const end = new Date(`${endValue.slice(0, 10)}T00:00:00Z`).getTime();
      return end > start ? [start, end] as const : null;
    })
    .filter((value): value is readonly [number, number] => Boolean(value))
    .sort((a, b) => a[0] - b[0]);

  if (!intervals.length) return 0;
  const merged: Array<[number, number]> = [];
  for (const [start, end] of intervals) {
    const previous = merged.at(-1);
    if (!previous || start > previous[1]) merged.push([start, end]);
    else previous[1] = Math.max(previous[1], end);
  }
  const milliseconds = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
  return milliseconds / (365.25 * 24 * 60 * 60 * 1000);
}

function requestedExperienceDomains(description: string) {
  const match = description
    .toLowerCase()
    .match(/\d+\+?\s*years(?:\s+of)?\s+experience\s+in\s+([^.;\n]+)/);
  if (!match) return [];
  const generic = new Set(["management", "professional", "relevant", "similar", "related"]);
  return [...new Set(tokenise(match[1]).filter((token) => !generic.has(token)))];
}

function domainRelevantRoles(
  roles: EmploymentRole[],
  eligible: KnowledgeItem[],
  domains: string[],
) {
  if (!domains.length) return roles;
  return roles.filter((role) => {
    const roleText = `${role.title} ${role.employer}`.toLowerCase();
    if (domains.some((domain) => roleText.includes(domain))) return true;
    return eligible.some(
      (item) =>
        item.employment_role_id === role.id &&
        domains.some((domain) => itemText(item).toLowerCase().includes(domain)),
    );
  });
}

function toBlockedStatus(status: KnowledgeStatus): EvidenceStatus {
  if (status === "excluded") return "Excluded";
  if (status === "archived") return "Archived";
  return "Needs Evidence";
}

export function runCanonicalKnowledgeScan(
  job: JobRecord,
  knowledge: KnowledgeItem[],
  roles: EmploymentRole[],
): ScanResult {
  const { eligible, caution, blocked } = classifyKnowledgeForMatching(knowledge);
  const jdTokens = tokenise(job.description);
  const jdTokenSet = new Set(jdTokens);
  const frequency = new Map<string, number>();
  for (const token of jdTokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const topKeywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([token]) => token);

  const rankedEligible = eligible
    .map((item) => {
      const tokens = new Set(tokenise(itemText(item)));
      const matched = [...tokens].filter((token) => jdTokenSet.has(token));
      return { item, matched, score: matched.length };
    })
    .sort((a, b) => b.score - a.score);

  const relevantEligible = rankedEligible.filter((row) => row.score > 0);
  const eligibleCorpus = eligible.map(itemText).join(" ").toLowerCase();
  const matchedKeywords = topKeywords.filter((keyword) => eligibleCorpus.includes(keyword));
  const missingKeywords = topKeywords.filter((keyword) => !eligibleCorpus.includes(keyword));

  const evidenceCoverage = topKeywords.length
    ? matchedKeywords.length / topKeywords.length
    : 0;
  const evidenceDepth = Math.min(1, relevantEligible.length / 8);
  const evidenceScore = pct(evidenceCoverage * 0.65 + evidenceDepth * 0.35);
  const atsScore = pct(evidenceCoverage);

  const yearsWantedMatch = job.description.toLowerCase().match(/(\d+)\+?\s*years/);
  const yearsWanted = yearsWantedMatch ? Number(yearsWantedMatch[1]) : null;
  const domains = requestedExperienceDomains(job.description);
  const relevantRoles = domainRelevantRoles(roles, eligible, domains);
  const totalYearsHeld = roleYears(roles);
  const yearsHeld = domains.length ? roleYears(relevantRoles) : totalYearsHeld;
  const experienceScore = yearsWanted
    ? pct(Math.min(1, yearsHeld / Math.max(1, yearsWanted)))
    : totalYearsHeld > 0
      ? 75
      : 50;

  const qualificationDemand = /degree|bsc|ba\b|msc|master|prince2|apm|pmp|qualification|certification/i.test(job.description);
  const qualificationEvidence = eligible.filter((item) =>
    ["education", "qualification"].includes(item.category.toLowerCase()),
  );
  const qualificationsScore = qualificationDemand
    ? qualificationEvidence.length
      ? 90
      : 25
    : 75;

  const subScores = [
    {
      key: "evidence",
      label: "Evidence Relevance",
      score: evidenceScore,
      reason: `${relevantEligible.length} eligible Knowledge Bank records overlap with this job description. Only verified and user-confirmed records contribute to this score.`,
    },
    {
      key: "ats",
      label: "Keyword / ATS Coverage",
      score: atsScore,
      reason: `${matchedKeywords.length} of the ${topKeywords.length} most prominent job-description terms appear in eligible canonical evidence.`,
    },
    {
      key: "experience",
      label: "Experience Fit",
      score: experienceScore,
      reason: yearsWanted && domains.length
        ? `The job asks for about ${yearsWanted} years in ${domains.join(" / ")}. Canonical evidence contains about ${yearsHeld.toFixed(1)} years of domain-relevant employment after overlapping roles are merged; total career tenure is ${totalYearsHeld.toFixed(1)} years.`
        : yearsWanted
          ? `The job asks for about ${yearsWanted} years. Canonical employment chronology contains about ${yearsHeld.toFixed(1)} years after overlapping roles are merged.`
          : `No explicit years requirement was detected. Canonical employment chronology contains about ${totalYearsHeld.toFixed(1)} years after overlapping roles are merged.`,
    },
    {
      key: "qualifications",
      label: "Qualifications Fit",
      score: qualificationsScore,
      reason: qualificationDemand
        ? `${qualificationEvidence.length} eligible education or qualification records are available in the Knowledge Bank.`
        : "No explicit qualification requirement was detected, so this is treated as neutral-positive.",
    },
  ];

  const overall = Math.round(
    evidenceScore * 0.45 + atsScore * 0.25 + experienceScore * 0.2 + qualificationsScore * 0.1,
  );

  const strengths = relevantEligible.slice(0, 6).map(({ item }) => ({
    text: `${item.title} — ${item.content}`,
    evidenceId: item.id,
  }));

  const cautionRelevant = caution.filter((item) => {
    const tokens = tokenise(itemText(item));
    return tokens.some((token) => jdTokenSet.has(token));
  });
  const partials = cautionRelevant
    .slice(0, 6)
    .map((item) => `${item.title} — ${item.status.replaceAll("_", " ")}; do not present as verified.`);

  const gaps = missingKeywords.slice(0, 8).map((keyword) => `No eligible canonical evidence found for “${keyword}”.`);
  const blockedEvidence = blocked.map((item) => ({
    id: item.id,
    claim: item.title,
    status: toBlockedStatus(item.status as KnowledgeStatus),
  }));

  const verdict = verdictFor(overall);
  const strategy = strategyFor(overall, gaps.length);

  return {
    id: `scan-${Date.now()}`,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    overall,
    verdict,
    subScores,
    strengths,
    partials,
    gaps,
    missingKeywords,
    matchedKeywords,
    blockedEvidence,
    strategy,
    reasons: [
      `${eligible.length} canonical records were eligible for matching.`,
      `${caution.length} records were kept as cautionary evidence and did not increase the score.`,
      `${blocked.length} archived or excluded records were prevented from reuse.`,
    ],
  };
}

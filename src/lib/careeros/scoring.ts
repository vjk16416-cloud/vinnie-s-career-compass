import { buildEvidenceMap, evidenceMapScore } from "./evidence-map";
import type {
  CareerOsData,
  EvidenceMapItem,
  EvidenceRecord,
  JobRecord,
  RequirementCategory,
  ScanResult,
  ScanSubScore,
  Verdict,
} from "./types";

const STOPWORDS = new Set(
  `a an the and or for with you your we our will be to of in on at as is are have has that this from by role team work working experience across including able strong good excellent ability who what their they them it its into using use used within about more than other well not can may should must new all any also please apply job description candidate candidates company help support ensure`.split(
    /\s+/,
  ),
);

export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/[\s/]+/)
    .map((word) => word.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function verdictFor(score: number): Verdict {
  if (score >= 78) return "Strong Fit";
  if (score >= 64) return "Competitive";
  if (score >= 48) return "Plausible Stretch";
  return "Weak Fit";
}

function strategyFor(score: number, materialGaps: number): ScanResult["strategy"] {
  if (score >= 78 && materialGaps <= 2) return "Apply";
  if (score >= 64) return "Apply with tailored positioning";
  if (score >= 48 && materialGaps <= 4) return "Consider";
  return "Skip";
}

function arr<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function average(items: EvidenceMapItem[]) {
  if (!items.length) return 70;
  return Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
}

function categorySubScore(
  evidenceMap: EvidenceMapItem[],
  category: RequirementCategory,
  key: string,
  label: string,
): ScanSubScore {
  const items = evidenceMap.filter((item) => item.category === category);
  const covered = items.filter((item) => item.status === "Covered").length;
  const blocked = items.filter((item) => item.status === "Blocked").length;
  const gaps = items.filter((item) => item.status === "Gap").length;
  const partials = items.filter((item) => item.status === "Partial").length;

  return {
    key,
    label,
    score: average(items),
    reason: items.length
      ? `${covered} covered, ${partials} partial, ${gaps} gap and ${blocked} blocked across ${items.length} detected ${label.toLowerCase()} requirements.`
      : `No explicit ${label.toLowerCase()} requirement was detected, so this dimension is neutral and does not drive the overall score.`,
  };
}

function keywordCoverage(job: JobRecord, data: CareerOsData) {
  const counts = new Map<string, number>();
  tokenise(job.description).forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  const topKeywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([token]) => token);

  const verified = arr(data.evidence).filter((record) => record.status === "Verified");
  const approvedItems = arr(data.profileItems).filter((item) => item.status === "Approved");
  const corpus = [
    verified.map((record) => `${record.claim} ${arr(record.skills).join(" ")}`).join(" "),
    approvedItems.map((item) => `${item.label} ${item.safeWording ?? item.value}`).join(" "),
    arr(data.profile.employment)
      .map(
        (role) =>
          `${role.title} ${role.company} ${role.summary} ${arr(role.highlights).join(" ")} ${arr(role.skills).join(" ")}`,
      )
      .join(" "),
  ]
    .join(" ")
    .toLowerCase();

  const matchedKeywords = topKeywords.filter((keyword) => corpus.includes(keyword));
  const missingKeywords = topKeywords.filter((keyword) => !corpus.includes(keyword));
  const score = topKeywords.length
    ? Math.round((matchedKeywords.length / topKeywords.length) * 100)
    : 0;

  return { matchedKeywords, missingKeywords, score };
}

function evidenceStrengthSubScore(evidenceMap: EvidenceMapItem[]): ScanSubScore {
  if (!evidenceMap.length) {
    return {
      key: "evidence",
      label: "Evidence Strength",
      score: 0,
      reason: "No requirement-level evidence map could be built from this job description.",
    };
  }
  const covered = evidenceMap.filter((item) => item.status === "Covered").length;
  const partial = evidenceMap.filter((item) => item.status === "Partial").length;
  const score = Math.round(((covered + partial * 0.5) / evidenceMap.length) * 100);
  return {
    key: "evidence",
    label: "Evidence Strength",
    score,
    reason: `${covered} of ${evidenceMap.length} mapped requirements are fully covered by approved evidence; ${partial} are only partial.`,
  };
}

function strengthFor(item: EvidenceMapItem, data: CareerOsData) {
  const evidence = item.evidenceIds
    .map((id) => data.evidence.find((record) => record.id === id))
    .find((record) => record?.status === "Verified");
  const profileItem = item.profileItemIds
    .map((id) => data.profileItems?.find((record) => record.id === id))
    .find((record) => record?.status === "Approved");
  const support =
    evidence?.claim ?? profileItem?.safeWording ?? profileItem?.value ?? item.explanation;
  return {
    text: `${item.requirement}: ${support}`,
    evidenceId: evidence?.id,
  };
}

function blockedEvidenceFor(evidenceMap: EvidenceMapItem[], data: CareerOsData) {
  const ids = new Set(
    evidenceMap.filter((item) => item.status === "Blocked").flatMap((item) => item.evidenceIds),
  );
  return [...ids]
    .map((id) => data.evidence.find((record) => record.id === id))
    .filter((record): record is EvidenceRecord => Boolean(record))
    .map((record) => ({ id: record.id, claim: record.claim, status: record.status }));
}

export function runScan(job: JobRecord, input: CareerOsData): ScanResult {
  const profile = input.profile ?? ({} as CareerOsData["profile"]);
  const data = {
    ...input,
    evidence: arr(input.evidence).filter((record) => record && typeof record === "object"),
    profile: {
      ...profile,
      skills: arr(profile.skills),
      tools: arr(profile.tools),
      domains: arr(profile.domains),
      employment: arr(profile.employment),
      summary: profile.summary ?? "",
    },
  } as CareerOsData;

  const evidenceMap = buildEvidenceMap(job, data);
  const overall = evidenceMapScore(evidenceMap);
  const keyword = keywordCoverage(job, data);

  const subScores: ScanSubScore[] = [
    categorySubScore(evidenceMap, "Responsibility", "responsibilities", "Responsibilities Fit"),
    categorySubScore(evidenceMap, "Skill", "skills", "Skills Fit"),
    categorySubScore(evidenceMap, "Experience", "experience", "Experience Fit"),
    categorySubScore(evidenceMap, "Qualification", "qualifications", "Qualifications Fit"),
    categorySubScore(evidenceMap, "Sector", "sector", "Sector Fit"),
    categorySubScore(evidenceMap, "Tool", "tools", "Tools Fit"),
    evidenceStrengthSubScore(evidenceMap),
    {
      key: "ats",
      label: "Keyword / ATS Coverage",
      score: keyword.score,
      reason: `${keyword.matchedKeywords.length} of the ${keyword.matchedKeywords.length + keyword.missingKeywords.length} most prominent job-description terms appear in approved or verified career material. Keyword coverage is supporting context and does not set the overall compatibility score.`,
    },
  ];

  const strengths = evidenceMap
    .filter((item) => item.status === "Covered")
    .slice(0, 8)
    .map((item) => strengthFor(item, data));
  const partials = evidenceMap
    .filter((item) => item.status === "Partial")
    .map((item) => `${item.requirement}: ${item.explanation}`);
  const gaps = evidenceMap
    .filter((item) => item.status === "Gap")
    .map((item) => `${item.requirement}: ${item.explanation}`);
  const blockedEvidence = blockedEvidenceFor(evidenceMap, data);
  const materialGaps = evidenceMap.filter(
    (item) => item.priority === "Required" && (item.status === "Gap" || item.status === "Blocked"),
  ).length;

  const reasons = [
    `Overall compatibility is calculated from ${evidenceMap.length} requirement-level Evidence Map items, not from a fixed career assumption.`,
    "Covered evidence earns full credit. Partial evidence earns limited credit. Gap and Blocked items earn zero.",
    `${blockedEvidence.length} evidence records are visible but held out of scoring because their status is not Verified.`,
    `Keyword coverage is ${keyword.score}% and is shown as supporting context only.`,
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
    missingKeywords: keyword.missingKeywords.slice(0, 18),
    matchedKeywords: keyword.matchedKeywords.slice(0, 18),
    blockedEvidence,
    evidenceMap,
    strategy: strategyFor(overall, materialGaps),
    reasons,
  };
}

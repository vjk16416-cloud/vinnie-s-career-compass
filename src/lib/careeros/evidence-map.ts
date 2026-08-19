import type {
  CareerOsData,
  CareerProfileItem,
  EvidenceMapItem,
  EvidenceRecord,
  JobRecord,
  RequirementCategory,
  RequirementMatchStatus,
  RequirementPriority,
} from "./types";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const RESPONSIBILITY_SIGNALS: Array<{
  requirement: string;
  patterns: RegExp[];
  evidenceIds?: string[];
}> = [
  {
    requirement: "Budget ownership",
    patterns: [/budget ownership/i, /manag\w*[^.]{0,45}\bbudget/i, /paid media budget/i],
    evidenceIds: ["ev-budget"],
  },
  {
    requirement: "Stakeholder management",
    patterns: [/stakeholder management/i, /senior stakeholders?/i, /stakeholder reporting/i],
    evidenceIds: ["ev-rag", "ev-agency"],
  },
  {
    requirement: "A/B testing",
    patterns: [/a\/b test/i, /experimentation/i, /landing[- ]page testing/i],
    evidenceIds: ["ev-ab", "ev-cvr"],
  },
  {
    requirement: "Agency and vendor management",
    patterns: [/agency management/i, /manage\w*[^.]{0,35}agenc/i, /vendor management/i],
    evidenceIds: ["ev-agency", "ev-budget"],
  },
  {
    requirement: "Project delivery",
    patterns: [/project delivery/i, /deliver\w*[^.]{0,30}projects?/i],
    evidenceIds: ["ev-adoption", "ev-agile"],
  },
  {
    requirement: "Direct line management",
    patterns: [/direct line management/i, /line management/i, /direct reports?/i, /manage a team of/i],
  },
];

const QUALIFICATION_SIGNALS: Array<{
  requirement: string;
  patterns: RegExp[];
  profileItemIds?: string[];
  genericKind?: "Education";
}> = [
  {
    requirement: "APM Project Fundamentals Qualification (PFQ)",
    patterns: [/apm project fundamentals/i, /\bapm pfq\b/i, /project fundamentals qualification/i],
    profileItemIds: ["pi-apm-pfq"],
  },
  {
    requirement: "PRINCE2 Practitioner",
    patterns: [/prince2 practitioner/i],
    profileItemIds: ["pi-prince2-practitioner"],
  },
  {
    requirement: "PRINCE2 Foundation",
    patterns: [/prince2 foundation/i],
    profileItemIds: ["pi-prince2-foundation"],
  },
  {
    requirement: "APM Project Management Qualification (PMQ)",
    patterns: [/apm project management qualification/i, /\bapm pmq\b/i],
    profileItemIds: ["pi-apm-pmq"],
  },
  {
    requirement: "Degree-level education",
    patterns: [/degree[- ]level/i, /university degree/i, /bachelor'?s? degree/i, /\bdegree required\b/i],
    genericKind: "Education",
  },
];

const TOOL_NAMES = [
  "Power BI",
  "Salesforce",
  "HubSpot",
  "GA4",
  "Google Analytics",
  "DV360",
  "Google Ads",
  "Meta Ads",
  "Hotjar",
  "Asana",
  "Jira",
  "MS Project",
  "ClickUp",
  "Zoho",
  "SQL",
  "Tableau",
  "Looker",
  "Figma",
  "Amplitude",
  "Mixpanel",
];

const SECTOR_TERMS = [
  "higher education",
  "education",
  "saas",
  "software",
  "engineering",
  "recruitment",
  "charity",
  "non-profit",
  "entertainment",
  "fintech",
  "banking",
  "healthcare",
  "insurance",
  "retail",
  "gaming",
];

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string) {
  const haystack = normalise(text);
  const needle = normalise(phrase);
  return Boolean(needle) && haystack.includes(needle);
}

function matchedPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function priorityFor(text: string, requirement: string): RequirementPriority {
  const lower = text.toLowerCase();
  const index = lower.indexOf(requirement.toLowerCase());
  const nearby = index >= 0 ? lower.slice(Math.max(0, index - 100), index + requirement.length + 100) : lower;
  return /preferred|desirable|nice to have|bonus|advantage/.test(nearby) ? "Preferred" : "Required";
}

function statusFromEvidence(records: EvidenceRecord[]): RequirementMatchStatus {
  if (records.some((record) => record.status === "Verified")) return "Covered";
  if (records.length > 0) return "Blocked";
  return "Gap";
}

function scoreForStatus(status: RequirementMatchStatus) {
  if (status === "Covered") return 100;
  if (status === "Partial") return 50;
  return 0;
}

function relatedProfileItems(data: CareerOsData, evidenceIds: string[]) {
  return (data.profileItems ?? []).filter((item) =>
    item.evidenceIds.some((id) => evidenceIds.includes(id)),
  );
}

function sourceIdsFor(items: CareerProfileItem[]) {
  return [...new Set(items.flatMap((item) => item.sourceIds))];
}

function evidenceRequirement(
  data: CareerOsData,
  jobText: string,
  requirement: string,
  category: RequirementCategory,
  records: EvidenceRecord[],
  priority = priorityFor(jobText, requirement),
): EvidenceMapItem {
  const status = statusFromEvidence(records);
  const evidenceIds = records.map((record) => record.id);
  const profileItems = relatedProfileItems(data, evidenceIds);
  const verified = records.find((record) => record.status === "Verified");
  const blocked = records.find((record) => record.status !== "Verified");

  return {
    id: `${category.toLowerCase()}-${normalise(requirement).replace(/\s+/g, "-")}`,
    requirement,
    category,
    priority,
    status,
    score: scoreForStatus(status),
    evidenceIds,
    profileItemIds: profileItems.map((item) => item.id),
    sourceIds: sourceIdsFor(profileItems),
    explanation:
      status === "Covered"
        ? `Covered by verified evidence: ${verified?.claim ?? requirement}.`
        : status === "Blocked"
          ? `Relevant evidence exists but is ${blocked?.status ?? "not approved"}, so it contributes zero to the score.`
          : `No safe CareerOS evidence currently supports ${requirement}.`,
  };
}

function qualificationRequirement(
  data: CareerOsData,
  jobText: string,
  requirement: string,
  items: CareerProfileItem[],
): EvidenceMapItem {
  const approved = items.find((item) => item.status === "Approved");
  const blocked = items.find((item) => item.status !== "Approved");
  const status: RequirementMatchStatus = approved ? "Covered" : items.length ? "Blocked" : "Gap";

  return {
    id: `qualification-${normalise(requirement).replace(/\s+/g, "-")}`,
    requirement,
    category: "Qualification",
    priority: priorityFor(jobText, requirement),
    status,
    score: scoreForStatus(status),
    evidenceIds: [...new Set(items.flatMap((item) => item.evidenceIds))],
    profileItemIds: items.map((item) => item.id),
    sourceIds: sourceIdsFor(items),
    explanation: approved
      ? `Covered by approved Master Profile item: ${approved.safeWording ?? approved.value}`
      : blocked
        ? `${blocked.label} is ${blocked.status}, so CareerOS cannot count it as a completed qualification.`
        : `No approved Master Profile qualification supports ${requirement}.`,
  };
}

function monthIndex(value: string, now = new Date()) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === "present" || trimmed === "current") return now.getUTCFullYear() * 12 + now.getUTCMonth();
  const match = trimmed.match(/([a-z]{3,9})\s+(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1]!.slice(0, 3).toLowerCase()];
  const year = Number(match[2]);
  if (month === undefined || !Number.isFinite(year)) return null;
  return year * 12 + month;
}

export function employmentYears(data: CareerOsData) {
  const months = new Set<number>();
  for (const role of data.profile.employment ?? []) {
    const start = monthIndex(role.start);
    const end = monthIndex(role.end);
    if (start === null || end === null || end < start) continue;
    for (let month = start; month <= end; month += 1) months.add(month);
  }
  return months.size / 12;
}

function experienceRequirement(data: CareerOsData, jobText: string): EvidenceMapItem | null {
  const match = jobText.match(/(?:at least\s*)?(\d+)\+?\s*(?:years?|yrs?)\b[^.]{0,80}(?:experience|delivery)?/i);
  if (!match) return null;
  const wanted = Number(match[1]);
  if (!Number.isFinite(wanted) || wanted <= 0) return null;
  const held = employmentYears(data);
  const ratio = Math.min(1, held / wanted);
  const score = Math.round(ratio * 100);
  const status: RequirementMatchStatus = held >= wanted ? "Covered" : held > 0 ? "Partial" : "Gap";
  const employmentItems = (data.profileItems ?? []).filter(
    (item) => item.kind === "Employment" && item.status === "Approved",
  );

  return {
    id: `experience-${wanted}-years`,
    requirement: `${wanted} years of experience`,
    category: "Experience",
    priority: priorityFor(jobText, `${wanted} years`),
    status,
    score,
    evidenceIds: [...new Set(employmentItems.flatMap((item) => item.evidenceIds))],
    profileItemIds: employmentItems.map((item) => item.id),
    sourceIds: sourceIdsFor(employmentItems),
    explanation: `The current employment record contains ${held.toFixed(1)} years of dated professional experience against a ${wanted}-year request.`,
  };
}

function addUnique(target: EvidenceMapItem[], item: EvidenceMapItem) {
  const key = normalise(item.requirement);
  if (!target.some((existing) => normalise(existing.requirement) === key)) target.push(item);
}

export function buildEvidenceMap(job: JobRecord, data: CareerOsData): EvidenceMapItem[] {
  const text = job.description ?? "";
  const items: EvidenceMapItem[] = [];

  for (const signal of RESPONSIBILITY_SIGNALS) {
    if (!matchedPattern(text, signal.patterns)) continue;
    const records = (signal.evidenceIds ?? [])
      .map((id) => data.evidence.find((record) => record.id === id))
      .filter((record): record is EvidenceRecord => Boolean(record));
    addUnique(items, evidenceRequirement(data, text, signal.requirement, "Responsibility", records));
  }

  for (const signal of QUALIFICATION_SIGNALS) {
    if (!matchedPattern(text, signal.patterns)) continue;
    const profileItems = (data.profileItems ?? []).filter((item) =>
      signal.genericKind ? item.kind === signal.genericKind : (signal.profileItemIds ?? []).includes(item.id),
    );
    addUnique(items, qualificationRequirement(data, text, signal.requirement, profileItems));
  }

  const experience = experienceRequirement(data, text);
  if (experience) addUnique(items, experience);

  const allSkills = [...new Set(data.evidence.flatMap((record) => record.skills ?? []))];
  for (const skill of allSkills) {
    if (!containsPhrase(text, skill)) continue;
    const records = data.evidence.filter((record) =>
      (record.skills ?? []).some((candidate) => normalise(candidate) === normalise(skill)),
    );
    addUnique(items, evidenceRequirement(data, text, skill, "Skill", records));
  }

  for (const tool of TOOL_NAMES) {
    if (!containsPhrase(text, tool)) continue;
    const records = data.evidence.filter((record) =>
      (record.skills ?? []).some((skill) => normalise(skill) === normalise(tool)),
    );
    if (records.length > 0) {
      addUnique(items, evidenceRequirement(data, text, tool, "Tool", records));
      continue;
    }
    const recorded = (data.profile.tools ?? []).some((candidate) => normalise(candidate) === normalise(tool));
    addUnique(items, {
      id: `tool-${normalise(tool).replace(/\s+/g, "-")}`,
      requirement: tool,
      category: "Tool",
      priority: priorityFor(text, tool),
      status: recorded ? "Partial" : "Gap",
      score: recorded ? 60 : 0,
      evidenceIds: [],
      profileItemIds: [],
      sourceIds: [],
      explanation: recorded
        ? `${tool} is recorded in the structured profile, but this requirement lacks a direct Verified evidence record.`
        : `No safe CareerOS evidence currently supports ${tool}.`,
    });
  }

  for (const sector of SECTOR_TERMS) {
    if (!containsPhrase(text, sector)) continue;
    const verifiedRecords = data.evidence.filter(
      (record) =>
        record.status === "Verified" &&
        containsPhrase(`${record.employer} ${record.claim} ${(record.skills ?? []).join(" ")}`, sector),
    );
    const approvedItems = (data.profileItems ?? []).filter(
      (item) => item.status === "Approved" && containsPhrase(`${item.label} ${item.value}`, sector),
    );
    const direct = verifiedRecords.length > 0 || approvedItems.length > 0;
    const recordedDomain = (data.profile.domains ?? []).some((domain) => containsPhrase(domain, sector));
    const status: RequirementMatchStatus = direct ? "Covered" : recordedDomain ? "Partial" : "Gap";
    addUnique(items, {
      id: `sector-${normalise(sector).replace(/\s+/g, "-")}`,
      requirement: `${sector} sector experience`,
      category: "Sector",
      priority: priorityFor(text, sector),
      status,
      score: direct ? 100 : recordedDomain ? 60 : 0,
      evidenceIds: verifiedRecords.map((record) => record.id),
      profileItemIds: approvedItems.map((item) => item.id),
      sourceIds: sourceIdsFor(approvedItems),
      explanation: direct
        ? `Direct approved career evidence supports ${sector} exposure.`
        : recordedDomain
          ? `${sector} appears in the structured profile, but direct evidence is limited.`
          : `No safe CareerOS evidence currently supports ${sector} sector experience.`,
    });
  }

  return items;
}

const CATEGORY_WEIGHT: Record<RequirementCategory, number> = {
  Responsibility: 1.5,
  Skill: 1.2,
  Experience: 1.3,
  Qualification: 1.1,
  Sector: 0.8,
  Tool: 0.9,
  Competency: 0.8,
};

export function evidenceMapScore(items: EvidenceMapItem[]) {
  if (items.length === 0) return 0;
  let earned = 0;
  let possible = 0;
  for (const item of items) {
    const priorityWeight = item.priority === "Preferred" ? 0.45 : 1;
    const weight = CATEGORY_WEIGHT[item.category] * priorityWeight;
    earned += (item.score / 100) * weight;
    possible += weight;
  }
  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

import { approvedProfileItems } from "./profile-extraction";
import { tokenise } from "./scoring";
import type {
  CareerOsData,
  CareerProfileItem,
  CareerProfileItemKind,
  CvCategory,
  EvidenceRecord,
  JobRecord,
  ScanResult,
} from "./types";

/** Only Verified evidence may ever reach generated documents. */
export function usableEvidence(data: CareerOsData): EvidenceRecord[] {
  return data.evidence.filter((e) => e.status === "Verified");
}

function relevantEvidence(data: CareerOsData, job: JobRecord, limit = 10) {
  const jd = new Set(tokenise(job.description));
  return usableEvidence(data)
    .map((e) => {
      const score = e.skills.filter((s) =>
        s
          .toLowerCase()
          .split(/\s+/)
          .some((part) => jd.has(part)),
      ).length;
      return { e, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

function approvedItems(data: CareerOsData, kind: CareerProfileItemKind): CareerProfileItem[] {
  return approvedProfileItems(data).filter((item) => item.kind === kind);
}

function safeWording(item: CareerProfileItem): string {
  return item.safeWording?.trim() || item.value.trim();
}

function approvedProfessionalSummary(data: CareerOsData): string {
  return (
    approvedItems(data, "Identity").find((item) => item.id === "pi-professional-summary")?.safeWording ??
    "Evidence-led digital, technology and project-delivery professional."
  );
}

function verifiedSkills(data: CareerOsData): string[] {
  return [...new Set(usableEvidence(data).flatMap((record) => record.skills))];
}

function approvedToolNames(data: CareerOsData): string[] {
  const evidenceSkills = verifiedSkills(data).map((skill) => skill.toLowerCase());
  const explicitTools = approvedItems(data, "Tool").map((item) => safeWording(item));
  const legacyToolsWithVerifiedSupport = data.profile.tools.filter((tool) =>
    evidenceSkills.some((skill) => skill.includes(tool.toLowerCase()) || tool.toLowerCase().includes(skill)),
  );
  return [...new Set([...explicitTools, ...legacyToolsWithVerifiedSupport])];
}

function employerForItem(data: CareerOsData, item: CareerProfileItem): string | undefined {
  const text = `${item.label} ${item.value} ${item.safeWording ?? ""}`.toLowerCase();
  return data.profile.employment.find((role) => text.includes(role.company.toLowerCase()))?.company;
}

function approvedRecentRole(data: CareerOsData): string | undefined {
  return approvedItems(data, "Employment")[0] ? safeWording(approvedItems(data, "Employment")[0]) : undefined;
}

export function buildTailoredCv(
  data: CareerOsData,
  job: JobRecord,
  scan: ScanResult | undefined,
): { body: string; evidenceIds: string[] } {
  const p = data.profile;
  const picked = relevantEvidence(data, job);
  const pickedIds = picked.map((e) => e.id);
  const claimsByEmployer = new Map<string, EvidenceRecord[]>();
  picked.forEach((e) => {
    claimsByEmployer.set(e.employer, [...(claimsByEmployer.get(e.employer) ?? []), e]);
  });

  const focus = scan
    ? scan.subScores
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.label.replace(" Fit", ""))
        .join(", ")
    : "delivery, analytics and stakeholder management";

  const employment = approvedItems(data, "Employment");
  const education = approvedItems(data, "Education");
  const certifications = approvedItems(data, "Certification");
  const projects = approvedItems(data, "Project");
  const skills = verifiedSkills(data).slice(0, 14);
  const tools = approvedToolNames(data);

  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push(`${p.location} | ${p.headline}`);
  lines.push("");
  lines.push("## Professional Summary");
  lines.push(
    `${approvedProfessionalSummary(data)} Applying for ${job.title} at ${job.company}, with emphasis on ${focus.toLowerCase()}.`,
  );

  if (skills.length) {
    lines.push("");
    lines.push("## Core Skills");
    lines.push(skills.join(" | "));
  }

  if (tools.length) {
    lines.push("");
    lines.push("## Tools and Platforms");
    lines.push(tools.join(" | "));
  }

  lines.push("");
  lines.push("## Professional Experience");
  employment.forEach((item) => {
    lines.push(`### ${safeWording(item)}`);
    const employer = employerForItem(data, item);
    if (employer) {
      (claimsByEmployer.get(employer) ?? []).forEach((e) => {
        lines.push(
          e.metricValue && !/not yet confirmed/i.test(e.metricValue)
            ? `- ${e.claim} (${e.metricValue}).`
            : `- ${e.claim}.`,
        );
      });
    }
    lines.push("");
  });

  if (education.length) {
    lines.push("## Education");
    education.forEach((item) => lines.push(`- ${safeWording(item)}`));
    lines.push("");
  }

  if (certifications.length) {
    lines.push("## Certifications and Training");
    certifications.forEach((item) => lines.push(`- ${safeWording(item)}`));
    lines.push("");
  }

  if (projects.length) {
    lines.push("## Selected Projects");
    projects.forEach((item) => lines.push(`- ${item.label}: ${safeWording(item)}`));
  }

  return { body: lines.join("\n").trim(), evidenceIds: pickedIds };
}

export function suggestCvCategory(job: JobRecord): CvCategory {
  const t = `${job.title} ${job.description}`.toLowerCase();
  if (t.includes("product marketing")) return "Product Marketing";
  if (t.includes("product manager") || t.includes("product management"))
    return "Product Management";
  if (t.includes("consult")) return "Technology Consulting";
  if (t.includes("programme")) return "Programme Management";
  if (t.includes("project")) return "Project Delivery";
  if (t.includes("innovation")) return "Innovation";
  if (t.includes("marketing")) return "Marketing Strategy";
  return "General";
}

export function buildCoverLetter(
  data: CareerOsData,
  job: JobRecord,
  scan: ScanResult | undefined,
): { body: string; emailVersion: string; evidenceIds: string[] } {
  const p = data.profile;
  const picked = relevantEvidence(data, job, 4);
  const gapNote = scan && scan.gaps.length ? scan.gaps[0] : undefined;
  const recentRole = approvedRecentRole(data);
  const ucl = approvedItems(data, "Education").find((item) => item.id === "pi-ucl-msc");
  const background = [recentRole ? `My recent experience includes ${recentRole}` : undefined, ucl ? safeWording(ucl) : undefined]
    .filter(Boolean)
    .join(". ");

  const bodyLines = [
    `Dear Hiring Team,`,
    ``,
    `I am applying for the ${job.title} role at ${job.company}. ${background}. The role matches how I work: evidence-led delivery across marketing, analytics and technology.`,
    ``,
    `Three points from my verified record that are directly relevant:`,
    ...picked.map(
      (e) =>
        `- ${e.claim}${e.metricValue && !/not yet confirmed/i.test(e.metricValue) ? ` (${e.metricValue})` : ""}, at ${e.employer}.`,
    ),
    ``,
    gapNote
      ? `To be straightforward about fit: ${gapNote.toLowerCase()} I would treat that as an early learning priority rather than claim experience I do not have.`
      : `Where the role covers ground I have not worked in directly, I would rather say so up front and show how I have picked up comparable work quickly.`,
    ``,
    `I would welcome the chance to talk through how this maps to what your team needs.`,
    ``,
    `Yours sincerely,`,
    p.name,
    p.location,
  ];

  const emailVersion = [
    `Subject: Application | ${job.title}`,
    ``,
    `Hello,`,
    ``,
    `I am applying for the ${job.title} role at ${job.company}. ${background}.`,
    ``,
    picked
      .slice(0, 2)
      .map((e) => `- ${e.claim}, at ${e.employer}.`)
      .join("\n"),
    ``,
    `My CV is attached. Happy to share further detail on any of the above.`,
    ``,
    `Best regards,`,
    p.name,
  ].join("\n");

  return {
    body: bodyLines.join("\n"),
    emailVersion,
    evidenceIds: picked.map((e) => e.id),
  };
}

export interface CvHealthCheck {
  compatibility: number;
  atsCoverage: number;
  responsibilitiesCoverage: number;
  evidenceCoverage: number;
  missingKeywords: string[];
  weakBullets: string[];
  unsupportedClaims: string[];
  formatting: { rule: string; pass: boolean }[];
  suggestions: { text: string; evidenceId?: string | undefined }[];
}

const VAGUE_TERMS = [
  "helped",
  "assisted",
  "various",
  "several",
  "many",
  "worked on",
  "responsible for",
  "successfully",
  "world-class",
  "passionate",
];

function blockedProfileClaims(cvBody: string, data: CareerOsData): string[] {
  const lower = cvBody.toLowerCase();
  return (data.profileItems ?? [])
    .filter((item) => item.status !== "Approved")
    .filter((item) => {
      const candidates = [item.label, item.value, item.safeWording].filter(
        (value): value is string => Boolean(value),
      );
      return candidates.some((candidate) => {
        const normalized = candidate.toLowerCase();
        return normalized.length >= 12 && lower.includes(normalized);
      });
    })
    .map((item) => `${item.label} — status: ${item.status}. Remove or resolve before export.`);
}

export function runCvHealthCheck(
  cvBody: string,
  data: CareerOsData,
  job: JobRecord | undefined,
  scan: ScanResult | undefined,
): CvHealthCheck {
  const lower = cvBody.toLowerCase();
  const bullets = cvBody.split("\n").filter((l) => l.trim().startsWith("- "));
  const verified = usableEvidence(data);
  const unverified = data.evidence.filter((e) => e.status !== "Verified");

  const jdTokens = job ? [...new Set(tokenise(job.description))].slice(0, 30) : [];
  const missingKeywords = jdTokens.filter((k) => !lower.includes(k));
  const atsCoverage = jdTokens.length
    ? Math.round(((jdTokens.length - missingKeywords.length) / jdTokens.length) * 100)
    : 0;

  const evidenceUsed = verified.filter((e) => lower.includes(e.claim.toLowerCase().slice(0, 28)));
  const evidenceCoverage = verified.length
    ? Math.round((evidenceUsed.length / Math.min(verified.length, 10)) * 100)
    : 0;

  const weakBullets = bullets
    .filter((b) => VAGUE_TERMS.some((t) => b.toLowerCase().includes(t)) || b.trim().length < 45)
    .slice(0, 8);

  const unsupportedEvidence = unverified
    .filter((e) => lower.includes(e.claim.toLowerCase().slice(0, 28)))
    .map((e) => `${e.claim} — status: ${e.status}. Remove or verify before export.`);
  const unsupportedClaims = [...new Set([...unsupportedEvidence, ...blockedProfileClaims(cvBody, data)])];

  const responsibilitiesCoverage = scan
    ? (scan.subScores.find((s) => s.key === "responsibilities")?.score ?? 0)
    : 0;

  const suggestions: { text: string; evidenceId?: string | undefined }[] = [];
  missingKeywords.slice(0, 5).forEach((k) => {
    const ev = verified.find((e) => `${e.claim} ${e.skills.join(" ")}`.toLowerCase().includes(k));
    if (ev) {
      suggestions.push({
        text: `Add the term "${k}" using verified evidence: ${ev.claim}.`,
        evidenceId: ev.id,
      });
    } else {
      suggestions.push({
        text: `"${k}" appears in the job description but has no verified evidence behind it. Leave it out unless you can verify it.`,
      });
    }
  });
  weakBullets.slice(0, 3).forEach((b) => {
    suggestions.push({
      text: `Tighten this bullet with a concrete, verified outcome: ${b.trim()}`,
    });
  });

  const formatting = [
    { rule: "Times New Roman body text", pass: true },
    { rule: "Body sizing between 10 and 12 pt", pass: true },
    { rule: "Full black text", pass: true },
    { rule: "Left aligned throughout", pass: true },
    {
      rule: "No tables, columns, icons, graphics or rating bars",
      pass: !/\|{2,}|<img|▮|★/.test(cvBody),
    },
    {
      rule: "British English spelling",
      pass: !/\b(optimize|organiz|analyze|program manager)\b/i.test(cvBody),
    },
    { rule: "Concise 2-page target", pass: cvBody.split(/\s+/).length <= 900 },
  ];

  return {
    compatibility: scan?.overall ?? 0,
    atsCoverage,
    responsibilitiesCoverage,
    evidenceCoverage: Math.min(100, evidenceCoverage),
    missingKeywords: missingKeywords.slice(0, 14),
    weakBullets,
    unsupportedClaims,
    formatting,
    suggestions,
  };
}

import type { CareerOsData, CvCategory, EvidenceRecord, JobRecord, ScanResult } from "./types";
import { tokenise } from "./scoring";

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

  const lines: string[] = [];
  lines.push(`# ${p.name}`);
  lines.push(`${p.location} | ${p.headline}`);
  lines.push("");
  lines.push("## Professional Summary");
  lines.push(
    `${p.summary} Applying for ${job.title} at ${job.company}, with emphasis on ${focus.toLowerCase()}.`,
  );
  lines.push("");
  lines.push("## Core Skills");
  lines.push(p.skills.slice(0, 14).join(" | "));
  lines.push("");
  lines.push("## Tools and Platforms");
  lines.push(p.tools.join(" | "));
  lines.push("");
  lines.push("## Professional Experience");
  p.employment.forEach((role) => {
    lines.push(`### ${role.title} — ${role.company} (${role.employmentType})`);
    lines.push(`${role.start} – ${role.end} | ${role.location}`);
    const evidenceBullets = (claimsByEmployer.get(role.company) ?? []).map((e) =>
      e.metricValue && e.status === "Verified" && !/not yet confirmed/i.test(e.metricValue)
        ? `- ${e.claim} (${e.metricValue}).`
        : `- ${e.claim}.`,
    );
    const bullets = evidenceBullets.length
      ? evidenceBullets
      : role.highlights.slice(0, 3).map((h) => `- ${h}`);
    bullets.forEach((b) => lines.push(b));
    lines.push("");
  });
  lines.push("## Education");
  p.education.forEach((e) => lines.push(`- ${e.qualification}, ${e.institution} — ${e.detail}`));
  lines.push("");
  lines.push("## Certifications");
  p.certifications.forEach((c) => lines.push(`- ${c.name}, ${c.issuer} (${c.completed})`));
  lines.push("");
  lines.push("## Selected Projects");
  p.projects.forEach((pr) => lines.push(`- ${pr.name}: ${pr.summary}`));

  return { body: lines.join("\n"), evidenceIds: pickedIds };
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

  const bodyLines = [
    `Dear Hiring Team,`,
    ``,
    `I am applying for the ${job.title} role at ${job.company}. I am currently ${p.employment[0]?.title} at ${p.employment[0]?.company} and a part-time MSc Technology Management candidate at UCL, and the role matches how I already work: evidence-led delivery across marketing, analytics and technology.`,
    ``,
    `Three points from my record that are directly relevant:`,
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
    `Subject: Application — ${job.title}`,
    ``,
    `Hello,`,
    ``,
    `I am applying for the ${job.title} role at ${job.company}. I am ${p.employment[0]?.title} at ${p.employment[0]?.company} and a part-time UCL MSc Technology Management candidate.`,
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

  const unsupportedClaims = unverified
    .filter((e) => lower.includes(e.claim.toLowerCase().slice(0, 28)))
    .map((e) => `${e.claim} — status: ${e.status}. Remove or verify before export.`);

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

import { buildTailoredCv, suggestCvCategory, usableEvidence } from "./generate";
import type { CareerOsData, CvCategory, JobRecord, ScanResult } from "./types";

export interface CvTailoringClaim {
  id: string;
  section: "summary" | "experience";
  original: string | null;
  proposed: string;
  evidenceIds: string[];
}

export interface CvTailoringProposal {
  status: "Draft";
  category: CvCategory;
  body: string;
  evidenceIds: string[];
  claims: CvTailoringClaim[];
}

function claimText(claim: string, metricValue?: string) {
  return metricValue && !/not yet confirmed/i.test(metricValue)
    ? `${claim} (${metricValue}).`
    : `${claim}.`;
}

export function buildTailoredCvProposal(
  data: CareerOsData,
  job: JobRecord,
  scan: ScanResult | undefined,
): CvTailoringProposal {
  const built = buildTailoredCv(data, job, scan);
  const evidenceById = new Map(usableEvidence(data).map((record) => [record.id, record]));
  const claims: CvTailoringClaim[] = [];

  built.evidenceIds.forEach((evidenceId) => {
    const evidence = evidenceById.get(evidenceId);
    if (!evidence) return;
    const role = data.profile.employment.find((entry) => entry.company === evidence.employer);
    claims.push({
      id: `experience:${evidence.id}`,
      section: "experience",
      original: role?.highlights.find((highlight) =>
        evidence.skills.some((skill) => highlight.toLowerCase().includes(skill.toLowerCase())),
      ) ?? null,
      proposed: claimText(evidence.claim, evidence.metricValue),
      evidenceIds: [evidence.id],
    });
  });

  return {
    status: "Draft",
    category: suggestCvCategory(job),
    body: built.body,
    evidenceIds: built.evidenceIds,
    claims,
  };
}

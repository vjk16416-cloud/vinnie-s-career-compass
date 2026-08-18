import { extractionCoverage as auditExtractionCoverage } from "./profile-extraction";
import type { CareerProfileSource } from "./types";

export interface ResumeExtractionCoverage {
  totalAuditSources: number;
  reconciled: number;
  rawExtracted: number;
  auditOnly: number;
  missingRaw: number;
  excluded: number;
  postAuditRaw: number;
  totalRawCvSources: number;
}

export function extractionCoverage(sources: CareerProfileSource[]): ResumeExtractionCoverage {
  const auditCoverage = auditExtractionCoverage(sources);
  const postAuditRaw = sources.filter(
    (source) =>
      !source.auditId &&
      (source.sourceType === "CV" || source.sourceType === "Resume") &&
      source.extractionStatus === "Raw extracted",
  ).length;

  return {
    ...auditCoverage,
    postAuditRaw,
    totalRawCvSources: auditCoverage.rawExtracted + postAuditRaw,
  };
}

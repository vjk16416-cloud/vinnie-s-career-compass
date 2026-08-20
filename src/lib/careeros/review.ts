import { reviewInputSignature, textSignature } from "./review-signature";
import type {
  Application,
  ApplicationReviewRun,
  CareerOsData,
  CoverLetter,
  CvDocument,
  CvVersion,
  JobRecord,
  ReviewCheckKey,
  ReviewCheckResult,
  ReviewFinding,
  ReviewFindingResolution,
  ReviewFindingSeverity,
  ReviewOutcome,
  ScanResult,
} from "./types";

export type ReviewPack = {
  data: CareerOsData;
  application: Application;
  job: JobRecord;
  scan: ScanResult;
  cv: CvDocument;
  cvVersion: CvVersion;
  coverLetter: CoverLetter;
};

function finding(
  check: ReviewCheckKey,
  severity: ReviewFindingSeverity,
  resolution: ReviewFindingResolution,
  message: string,
): ReviewFinding {
  return {
    id: `${check}-${textSignature(message)}`,
    check,
    severity,
    resolution,
    message,
  };
}

function checkResult(
  key: ReviewCheckKey,
  label: string,
  findings: ReviewFinding[] = [],
): ReviewCheckResult {
  return {
    key,
    label,
    status: findings.some((item) => item.severity === "Blocking")
      ? "Fail"
      : findings.length
        ? "Warning"
        : "Pass",
    findings,
  };
}

function outcomeFor(findings: ReviewFinding[]): ReviewOutcome {
  if (findings.some((item) => item.severity === "Blocking" && item.resolution === "Input")) {
    return "NEEDS INPUT";
  }
  if (findings.some((item) => item.severity === "Blocking")) {
    return "NEEDS REVISION";
  }
  return "READY FOR VINNIE APPROVAL";
}

function evidenceFindings(pack: ReviewPack): ReviewFinding[] {
  const ids = new Set([...pack.cvVersion.evidenceIds, ...pack.coverLetter.evidenceIds]);
  return [...ids].flatMap((id) => {
    const record = pack.data.evidence.find((item) => item.id === id);
    if (record?.status === "Verified") return [];
    return [
      finding(
        "evidence",
        "Blocking",
        "Input",
        record
          ? `${record.claim} is ${record.status}, not Verified.`
          : `Evidence ${id} is missing from CareerOS.`,
      ),
    ];
  });
}

export function reviewApplicationPack(pack: ReviewPack): ApplicationReviewRun {
  const evidence = evidenceFindings(pack);
  const checks: ReviewCheckResult[] = [
    checkResult("jd-alignment", "JD and requirement alignment"),
    checkResult("evidence", "Evidence and unsupported claims", evidence),
    checkResult("metrics", "Metrics credibility"),
    checkResult("chronology", "Chronology and factual consistency"),
    checkResult("ats", "ATS and terminology"),
    checkResult("star", "STAR and bullet strength"),
    checkResult("british-english", "British English and house style"),
    checkResult("ai-language-risk", "AI-like language risk"),
    checkResult("cover-letter", "Cover-letter quality"),
  ];
  const findings = checks.flatMap((check) => check.findings);
  const scanSignature = pack.scan.jobDescriptionSignature ?? "";

  return {
    id: `review-${Date.now()}`,
    applicationId: pack.application.id,
    jobId: pack.job.id,
    scanId: pack.scan.id,
    cvId: pack.cv.id,
    cvVersionId: pack.cvVersion.id,
    coverLetterId: pack.coverLetter.id,
    inputSignature: reviewInputSignature({
      applicationId: pack.application.id,
      jobId: pack.job.id,
      jobDescriptionSignature: textSignature(pack.job.description),
      scanId: pack.scan.id,
      scanJobDescriptionSignature: scanSignature,
      cvId: pack.cv.id,
      cvVersionId: pack.cvVersion.id,
      coverLetterId: pack.coverLetter.id,
    }),
    createdAt: new Date().toISOString(),
    outcome: outcomeFor(findings),
    checks,
    strengths: pack.scan.strengths.slice(0, 5).map((item) => item.text),
    highPriorityFixes: findings
      .filter((item) => item.severity === "Blocking")
      .slice(0, 8)
      .map((item) => item.message),
  };
}

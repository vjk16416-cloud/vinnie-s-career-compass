import { runCvHealthCheck } from "./generate";
import { reviewInputSignature, textSignature } from "./review-signature";
import type {
  Application,
  ApplicationGateState,
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

export type ApplicationReviewContext = {
  data: CareerOsData;
  application: Application;
  job: JobRecord;
  scan?: ScanResult | undefined;
  cv?: CvDocument | undefined;
};

export type ApprovalEligibility = { allowed: true } | { allowed: false; reason: string };

const METRIC_PATTERN =
  /[£$€]\s?\d[\d,.]*\s?[kKmMbB]?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s?(?:x|times)\b/gi;
const US_SPELLING_PATTERN =
  /\b(optimize|optimized|optimization|organize|organized|analyze|analyzed|behavior|color)\b/i;
const AI_RISK_PHRASES = [
  "results-driven",
  "dynamic professional",
  "passionate about",
  "proven track record",
  "world-class",
  "leveraging synergies",
  "uniquely positioned",
];

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

function jdAlignmentFindings(pack: ReviewPack): ReviewFinding[] {
  return (pack.scan.evidenceMap ?? [])
    .filter(
      (item) =>
        item.priority === "Required" && (item.status === "Gap" || item.status === "Blocked"),
    )
    .map((item) =>
      finding("jd-alignment", "Advisory", "Advisory", `${item.requirement}: ${item.explanation}`),
    );
}

function evidenceFindings(pack: ReviewPack): ReviewFinding[] {
  const ids = new Set([...pack.cvVersion.evidenceIds, ...pack.coverLetter.evidenceIds]);
  const explicit = [...ids].flatMap((id) => {
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

  const health = runCvHealthCheck(pack.cvVersion.body, pack.data, pack.job, pack.scan);
  const unsupported = health.unsupportedClaims.map((message) =>
    finding("evidence", "Blocking", "Input", message),
  );
  return [...explicit, ...unsupported];
}

function metricsIn(text: string): string[] {
  return text.match(METRIC_PATTERN) ?? [];
}

function normaliseMetric(value: string): string {
  return value.toLowerCase().replace(/[\s,]/g, "");
}

function metricFindings(pack: ReviewPack): ReviewFinding[] {
  const artifactMetrics = metricsIn(`${pack.cvVersion.body}\n${pack.coverLetter.body}`);
  if (!artifactMetrics.length) return [];

  const supportedText = [
    ...pack.data.evidence
      .filter((item) => item.status === "Verified")
      .map((item) => item.metricValue ?? ""),
    ...(pack.data.profileItems ?? [])
      .filter((item) => item.status === "Approved")
      .map((item) => `${item.value} ${item.safeWording ?? ""}`),
  ].join("\n");
  const supported = new Set(metricsIn(supportedText).map(normaliseMetric));

  return [...new Set(artifactMetrics.map(normaliseMetric))]
    .filter((metric) => !supported.has(metric))
    .map((metric) =>
      finding(
        "metrics",
        "Blocking",
        "Input",
        `Metric ${metric} is not backed by Verified evidence or approved profile wording.`,
      ),
    );
}

function yearsIn(text: string): number[] {
  return [...text.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => Number(match[0]));
}

function chronologyFindings(pack: ReviewPack): ReviewFinding[] {
  const lines = `${pack.cvVersion.body}\n${pack.coverLetter.body}`.split("\n");
  return pack.data.profile.employment.flatMap((role) => {
    const approvedYears = yearsIn(`${role.start} ${role.end}`);
    if (!approvedYears.length) return [];
    const earliest = Math.min(...approvedYears);
    const latest = Math.max(...approvedYears);
    return lines
      .filter((line) => line.toLowerCase().includes(role.company.toLowerCase()))
      .flatMap((line) =>
        yearsIn(line)
          .filter((year) => year < earliest || year > latest)
          .map((year) =>
            finding(
              "chronology",
              "Blocking",
              "Input",
              `${role.company} is shown with ${year}, outside the approved ${role.start} to ${role.end} chronology.`,
            ),
          ),
      );
  });
}

function atsFindings(pack: ReviewPack): ReviewFinding[] {
  const health = runCvHealthCheck(pack.cvVersion.body, pack.data, pack.job, pack.scan);
  return health.missingKeywords
    .slice(0, 8)
    .map((keyword) =>
      finding(
        "ats",
        "Advisory",
        "Advisory",
        `The JD term "${keyword}" is not present in the CV. Add it only when Verified evidence supports it.`,
      ),
    );
}

function starFindings(pack: ReviewPack): ReviewFinding[] {
  const health = runCvHealthCheck(pack.cvVersion.body, pack.data, pack.job, pack.scan);
  return health.weakBullets.map((bullet) =>
    finding(
      "star",
      "Advisory",
      "Advisory",
      `Strengthen this bullet with a specific action and verified outcome: ${bullet.trim()}`,
    ),
  );
}

function britishEnglishFindings(pack: ReviewPack): ReviewFinding[] {
  const text = `${pack.cvVersion.body}\n${pack.coverLetter.body}`;
  const findings: ReviewFinding[] = [];
  if (text.includes("—")) {
    findings.push(
      finding(
        "british-english",
        "Blocking",
        "Revision",
        "Replace em dashes with a comma or full stop.",
      ),
    );
  }
  const usSpelling = text.match(US_SPELLING_PATTERN)?.[0];
  if (usSpelling) {
    findings.push(
      finding(
        "british-english",
        "Blocking",
        "Revision",
        `Replace the US spelling "${usSpelling}" with British English.`,
      ),
    );
  }
  return findings;
}

function aiLanguageFindings(pack: ReviewPack): ReviewFinding[] {
  const text = `${pack.cvVersion.body}\n${pack.coverLetter.body}`.toLowerCase();
  return AI_RISK_PHRASES.filter((phrase) => text.includes(phrase)).map((phrase) =>
    finding(
      "ai-language-risk",
      "Advisory",
      "Advisory",
      `Review the phrase "${phrase}" for generic or inflated wording.`,
    ),
  );
}

function coverLetterFindings(pack: ReviewPack): ReviewFinding[] {
  const lower = pack.coverLetter.body.toLowerCase();
  const findings: ReviewFinding[] = [];
  if (!lower.includes(pack.job.title.toLowerCase())) {
    findings.push(
      finding(
        "cover-letter",
        "Blocking",
        "Revision",
        `The cover letter must name the exact role: ${pack.job.title}.`,
      ),
    );
  }
  if (!lower.includes(pack.job.company.toLowerCase())) {
    findings.push(
      finding(
        "cover-letter",
        "Blocking",
        "Revision",
        `The cover letter must name the target company: ${pack.job.company}.`,
      ),
    );
  }
  if (pack.coverLetter.body.trim().split(/\s+/).length > 650) {
    findings.push(
      finding(
        "cover-letter",
        "Blocking",
        "Revision",
        "The cover letter exceeds the 650-word review ceiling and should be made more concise.",
      ),
    );
  }

  pack.coverLetter.evidenceIds.forEach((id) => {
    const evidence = pack.data.evidence.find((item) => item.id === id);
    if (evidence?.status !== "Verified") {
      findings.push(
        finding(
          "cover-letter",
          "Blocking",
          "Input",
          evidence
            ? `Cover-letter evidence ${evidence.claim} is ${evidence.status}, not Verified.`
            : `Cover-letter evidence ${id} is missing from CareerOS.`,
        ),
      );
    }
  });

  return findings;
}

export function reviewApplicationPack(pack: ReviewPack): ApplicationReviewRun {
  const checks: ReviewCheckResult[] = [
    checkResult("jd-alignment", "JD and requirement alignment", jdAlignmentFindings(pack)),
    checkResult("evidence", "Evidence and unsupported claims", evidenceFindings(pack)),
    checkResult("metrics", "Metrics credibility", metricFindings(pack)),
    checkResult("chronology", "Chronology and factual consistency", chronologyFindings(pack)),
    checkResult("ats", "ATS and terminology", atsFindings(pack)),
    checkResult("star", "STAR and bullet strength", starFindings(pack)),
    checkResult("british-english", "British English and house style", britishEnglishFindings(pack)),
    checkResult("ai-language-risk", "AI-like language risk", aiLanguageFindings(pack)),
    checkResult("cover-letter", "Cover-letter quality", coverLetterFindings(pack)),
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

export function scanMatchesSavedJob(job: JobRecord, scan: ScanResult | undefined): boolean {
  return Boolean(
    scan?.jobDescriptionSignature &&
    scan.jobDescriptionSignature === textSignature(job.description),
  );
}

export function latestApplicationCoverLetter(
  context: ApplicationReviewContext,
): CoverLetter | undefined {
  return context.data.coverLetters
    .filter((letter) => letter.applicationId === context.application.id)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
}

export function currentReviewInputSignature(context: ApplicationReviewContext): string | null {
  if (!context.scan || !scanMatchesSavedJob(context.job, context.scan) || !context.cv) return null;
  const cvVersion = context.cv.versions.at(-1);
  const coverLetter = latestApplicationCoverLetter(context);
  if (!cvVersion || !coverLetter || !context.scan.jobDescriptionSignature) return null;

  return reviewInputSignature({
    applicationId: context.application.id,
    jobId: context.job.id,
    jobDescriptionSignature: textSignature(context.job.description),
    scanId: context.scan.id,
    scanJobDescriptionSignature: context.scan.jobDescriptionSignature,
    cvId: context.cv.id,
    cvVersionId: cvVersion.id,
    coverLetterId: coverLetter.id,
  });
}

export function latestApplicationReview(
  context: ApplicationReviewContext,
): ApplicationReviewRun | undefined {
  return (context.data.reviewRuns ?? [])
    .filter((review) => review.applicationId === context.application.id)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
}

export function applicationGateState(context: ApplicationReviewContext): ApplicationGateState {
  const review = latestApplicationReview(context);
  if (!review) return "NOT REVIEWED";

  const currentSignature = currentReviewInputSignature(context);
  if (!currentSignature || review.inputSignature !== currentSignature) return "REVIEW OUTDATED";

  if (review.outcome === "NEEDS INPUT") return "NEEDS INPUT";
  if (review.outcome === "NEEDS REVISION") return "NEEDS REVISION";

  const cvVersion = context.cv?.versions.at(-1);
  const coverLetter = latestApplicationCoverLetter(context);
  if (
    cvVersion &&
    context.cv?.approvedVersionId === cvVersion.id &&
    coverLetter?.status === "Approved"
  ) {
    return "READY TO APPLY";
  }

  return "READY FOR VINNIE APPROVAL";
}

export function approvalEligibility(context: ApplicationReviewContext): ApprovalEligibility {
  const gateState = applicationGateState(context);
  if (gateState === "READY FOR VINNIE APPROVAL" || gateState === "READY TO APPLY") {
    return { allowed: true };
  }

  const reasons: Record<
    Exclude<ApplicationGateState, "READY FOR VINNIE APPROVAL" | "READY TO APPLY">,
    string
  > = {
    "NOT REVIEWED": "Run final review before approving this document.",
    "REVIEW OUTDATED": "The final review is outdated. Re-run it for the current application pack.",
    "NEEDS INPUT": "Resolve the evidence or factual blockers before approval.",
    "NEEDS REVISION": "Resolve the reviewer revisions before approval.",
  };

  return { allowed: false, reason: reasons[gateState] };
}

# CareerOS Sprint 6 Automated Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Agent 02 quality gate that reviews the exact current JD, role scan, CV version and cover-letter version before explicit user approval can produce `READY TO APPLY`.

**Architecture:** Keep reviewer history inside the existing Supabase-authoritative `CareerOsData` JSON state. Add deterministic signatures for saved JDs and full application packs, add a focused `review.ts` domain module for checks and gate state, and keep the six-stage workspace unchanged by rendering the reviewer in Apply. Existing document generation remains separate from review, and no external AI provider is required in Sprint 6.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Start, Vitest 4, Testing Library, Supabase-backed CareerOS state, Vite 8, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-08-20-careeros-automated-reviewer-design.md`

## Global Constraints

- Deterministic reviewer first. Do not call Claude, OpenAI or another external model in Sprint 6.
- Reviewer outcomes are exactly `NEEDS INPUT`, `NEEDS REVISION`, and `READY FOR VINNIE APPROVAL`.
- Application gate states are exactly `NOT REVIEWED`, `REVIEW OUTDATED`, `NEEDS INPUT`, `NEEDS REVISION`, `READY FOR VINNIE APPROVAL`, and `READY TO APPLY`.
- Final review requires one complete current pack: saved JD, current scan, latest CV version and latest cover letter.
- New scans must record the signature of the saved JD they analysed.
- Historical scans without a JD signature load safely but require one fresh scan before final review.
- Review runs are immutable history. Re-running creates a new record.
- A review is valid only for the exact saved JD, scan, CV version and cover-letter version it reviewed.
- Agent 02 cannot approve documents. Only explicit user action can set the current CV version and current cover letter to approved.
- `READY TO APPLY` is derived, never manually stored.
- New CV or cover-letter drafts, a saved JD change, or a new scan must invalidate prior readiness.
- Unsupported evidence or disputed metrics must never be strengthened through assumption.
- AI checks are labelled `AI-like language risk`, never as proof that AI wrote the text.
- British English rules apply. Em dashes are prohibited in generated application materials.
- No new Supabase SQL table or relational migration is required solely for reviewer state.
- Existing Job -> Match -> Evidence -> CV -> Cover Letter -> Apply navigation remains unchanged.
- Any future fixer must create a new document version. Sprint 6 does not silently rewrite reviewed or approved artifacts.
- Implementation follows TDD. Every production change is preceded by a failing test that demonstrates the intended behaviour.

---

## File Structure

### Create

- `src/lib/careeros/review-signature.ts`
  - Deterministic non-security signatures for JD and application-pack staleness.
- `src/lib/careeros/review-signature.test.ts`
  - Signature stability and change-detection tests.
- `src/lib/careeros/review.ts`
  - Agent 02 review checks, review-run construction, staleness and application-gate calculation.
- `src/lib/careeros/review.test.ts`
  - Unit tests for reviewer outcomes, evidence safety, metrics, chronology, house style and stale-input rules.
- `src/components/careeros/final-review-panel.tsx`
  - Apply-stage reviewer presentation only. No pass/fail business logic in the component.

### Modify

- `src/lib/careeros/types.ts`
  - Add reviewer types, `ScanResult.jobDescriptionSignature`, `CvDocument.approvedVersionId`, and `CareerOsData.reviewRuns`.
- `src/lib/careeros/seed.ts`
  - Seed `reviewRuns: []`. Do not invent seed review results.
- `src/lib/careeros/normalise.ts`
  - Default historical state to `reviewRuns: []`; retain optional scan signatures and CV approval provenance safely.
- `src/lib/careeros/scoring.ts`
  - Record the current saved-JD signature on every new scan.
- `src/lib/careeros/generate.ts`
  - Reuse existing CV health-check signals from the reviewer without moving document generation into reviewer code.
- `src/routes/applications.$id.tsx`
  - Persist review runs, enforce approval prerequisites, clear CV approval provenance on new drafts, and render the Apply-stage final review.
- `src/routes/-application-workflow.test.tsx`
  - Exercise current scan requirements, final review, explicit approval and `READY TO APPLY` end to end.
- `src/lib/careeros/cloud-bootstrap.test.ts`
  - Prove older persisted CareerOS state without Sprint 6 fields still loads safely.

### Do not modify unless a failing test proves it is necessary

- Supabase SQL migrations.
- `src/lib/careeros/cloud-state.repository.ts` schema version.
- Authentication or OAuth code.
- Job ingestion/extraction code.
- Google Drive sync code.
- CV/cover-letter export renderer.

---

### Task 1: Add reviewer state and backward-compatible normalisation

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Modify: `src/lib/careeros/seed.ts`
- Modify: `src/lib/careeros/normalise.ts`
- Modify/Test: `src/lib/careeros/cloud-bootstrap.test.ts`

**Interfaces:**
- Produces `ReviewOutcome`, `ReviewCheckStatus`, `ReviewFindingSeverity`, `ReviewFindingResolution`, `ReviewCheckKey`, `ReviewFinding`, `ReviewCheckResult`, `ApplicationReviewRun`, `ApplicationGateState`.
- Produces `CareerOsData.reviewRuns: ApplicationReviewRun[]`.
- Produces `ScanResult.jobDescriptionSignature?: string`.
- Produces `CvDocument.approvedVersionId?: string`.
- Later tasks consume these types directly.

- [ ] **Step 1: Write the failing backward-compatibility test**

Add a case to `src/lib/careeros/cloud-bootstrap.test.ts` that loads a stored row created before Sprint 6 and asserts the normalised result contains an empty review history while preserving existing objects:

```ts
it("normalises pre-Sprint-6 cloud state without losing existing data", async () => {
  const old = createCareerOsData();
  const oldShape = structuredClone(old) as Partial<CareerOsData>;
  delete (oldShape as { reviewRuns?: unknown }).reviewRuns;
  delete (oldShape.scans[0] as { jobDescriptionSignature?: string } | undefined)
    ?.jobDescriptionSignature;
  delete (oldShape.cvs[0] as { approvedVersionId?: string } | undefined)?.approvedVersionId;

  const repository = repositoryWithCloudData(oldShape as CareerOsData);
  const result = await bootstrapCareerState({
    userId: "user-123",
    repository,
    storage: window.localStorage,
  });

  expect(result.data.reviewRuns).toEqual([]);
  expect(result.data.jobs).toHaveLength(old.jobs.length);
  expect(result.data.cvs[0]?.versions).toEqual(old.cvs[0]?.versions);
  expect(result.data.coverLetters).toEqual(old.coverLetters);
});
```

If the current test helper has a different repository factory name, use its existing local helper rather than introducing a duplicate repository mock.

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: FAIL because `CareerOsData` and normalisation do not yet expose `reviewRuns`.

- [ ] **Step 3: Add the exact reviewer types**

Add to `src/lib/careeros/types.ts`:

```ts
export type ReviewOutcome =
  | "NEEDS INPUT"
  | "NEEDS REVISION"
  | "READY FOR VINNIE APPROVAL";

export type ReviewCheckStatus = "Pass" | "Warning" | "Fail";
export type ReviewFindingSeverity = "Blocking" | "Advisory";
export type ReviewFindingResolution = "Input" | "Revision" | "Advisory";

export type ReviewCheckKey =
  | "jd-alignment"
  | "evidence"
  | "metrics"
  | "chronology"
  | "ats"
  | "star"
  | "british-english"
  | "ai-language-risk"
  | "cover-letter";

export interface ReviewFinding {
  id: string;
  check: ReviewCheckKey;
  severity: ReviewFindingSeverity;
  resolution: ReviewFindingResolution;
  message: string;
  evidenceId?: string;
  profileItemId?: string;
}

export interface ReviewCheckResult {
  key: ReviewCheckKey;
  label: string;
  status: ReviewCheckStatus;
  findings: ReviewFinding[];
}

export interface ApplicationReviewRun {
  id: string;
  applicationId: string;
  jobId: string;
  scanId: string;
  cvId: string;
  cvVersionId: string;
  coverLetterId: string;
  inputSignature: string;
  createdAt: string;
  outcome: ReviewOutcome;
  checks: ReviewCheckResult[];
  strengths: string[];
  highPriorityFixes: string[];
}

export type ApplicationGateState =
  | "NOT REVIEWED"
  | "REVIEW OUTDATED"
  | "NEEDS INPUT"
  | "NEEDS REVISION"
  | "READY FOR VINNIE APPROVAL"
  | "READY TO APPLY";
```

Extend existing interfaces:

```ts
export interface CvDocument {
  // existing fields
  approvedVersionId?: string;
}

export interface ScanResult {
  // existing fields
  jobDescriptionSignature?: string;
}

export interface CareerOsData {
  // existing fields
  reviewRuns: ApplicationReviewRun[];
}
```

- [ ] **Step 4: Seed and normalise the new fields**

In `src/lib/careeros/seed.ts`, add exactly:

```ts
reviewRuns: [],
```

next to the other application workflow collections.

In `src/lib/careeros/normalise.ts`, add:

```ts
reviewRuns: list(saved.reviewRuns, []),
scans: list(saved.scans, []).map((scan) => ({ ...scan })),
cvs: list(saved.cvs, seed.cvs).map((cv) => ({
  ...cv,
  versions: list(cv?.versions, []),
  approvedVersionId: cv?.approvedVersionId,
})),
```

Keep historical document-level `status: "Approved"` untouched for backward compatibility, but do not infer an `approvedVersionId` from it.

- [ ] **Step 5: Re-run the targeted test and verify GREEN**

Run:

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run TypeScript-facing unit coverage before committing**

Run:

```bash
npm test -- src/lib/careeros/profile-extraction.test.ts src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit only Task 1 files**

```bash
git add src/lib/careeros/types.ts src/lib/careeros/seed.ts src/lib/careeros/normalise.ts src/lib/careeros/cloud-bootstrap.test.ts
git commit -m "feat: add CareerOS reviewer state model"
```

---

### Task 2: Bind every role scan to the saved JD

**Files:**
- Create: `src/lib/careeros/review-signature.ts`
- Create: `src/lib/careeros/review-signature.test.ts`
- Modify: `src/lib/careeros/scoring.ts`
- Test: an existing scoring test file if present; otherwise extend `src/lib/careeros/review-signature.test.ts` with `runScan` coverage.

**Interfaces:**
- Produces `textSignature(text: string): string`.
- Produces `reviewInputSignature(input: ReviewInputIdentity): string`.
- `runScan(job, data)` stores `jobDescriptionSignature: textSignature(job.description)`.
- Later reviewer and route tasks consume both signature functions.

- [ ] **Step 1: Write failing signature tests**

Create `src/lib/careeros/review-signature.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { runScan } from "./scoring";
import { reviewInputSignature, textSignature } from "./review-signature";

const identity = {
  applicationId: "app-1",
  jobId: "job-1",
  jobDescriptionSignature: "jd-a",
  scanId: "scan-1",
  scanJobDescriptionSignature: "jd-a",
  cvId: "cv-1",
  cvVersionId: "cvv-2",
  coverLetterId: "cl-2",
};

describe("review signatures", () => {
  it("is deterministic and changes when meaningful text changes", () => {
    expect(textSignature("same JD")).toBe(textSignature("same JD"));
    expect(textSignature("same JD")).not.toBe(textSignature("changed JD"));
  });

  it("changes when any reviewed artifact identity changes", () => {
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, cvVersionId: "cvv-3" }),
    );
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, coverLetterId: "cl-3" }),
    );
  });

  it("stores the saved JD signature on each new role scan", () => {
    const data = createCareerOsData();
    const job = data.jobs[0]!;
    const scan = runScan(job, data);

    expect(scan.jobDescriptionSignature).toBe(textSignature(job.description));
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
npm test -- src/lib/careeros/review-signature.test.ts
```

Expected: FAIL because the signature module does not exist and scans do not contain the field.

- [ ] **Step 3: Implement deterministic signatures**

Create `src/lib/careeros/review-signature.ts`:

```ts
export type ReviewInputIdentity = {
  applicationId: string;
  jobId: string;
  jobDescriptionSignature: string;
  scanId: string;
  scanJobDescriptionSignature: string;
  cvId: string;
  cvVersionId: string;
  coverLetterId: string;
};

export function textSignature(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function reviewInputSignature(input: ReviewInputIdentity): string {
  return textSignature(
    [
      input.applicationId,
      input.jobId,
      input.jobDescriptionSignature,
      input.scanId,
      input.scanJobDescriptionSignature,
      input.cvId,
      input.cvVersionId,
      input.coverLetterId,
    ].join("\u001f"),
  );
}
```

This signature is only for change detection, not security.

- [ ] **Step 4: Record the signature in `runScan`**

Import `textSignature` in `src/lib/careeros/scoring.ts` and add:

```ts
jobDescriptionSignature: textSignature(job.description),
```

to the returned `ScanResult`.

- [ ] **Step 5: Re-run the signature test and verify GREEN**

```bash
npm test -- src/lib/careeros/review-signature.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run existing scan/evidence tests**

```bash
npm test -- src/lib/careeros/generic-requirements.test.ts src/lib/careeros/review-signature.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/lib/careeros/review-signature.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/scoring.ts
git commit -m "feat: bind role scans to saved job descriptions"
```

---

### Task 3: Build the deterministic Agent 02 reviewer

**Files:**
- Create: `src/lib/careeros/review.ts`
- Create: `src/lib/careeros/review.test.ts`
- Modify: `src/lib/careeros/generate.ts` only if a small pure helper must be exported for reuse.

**Interfaces:**
- Produces `ReviewPack`.
- Produces `reviewApplicationPack(pack: ReviewPack): ApplicationReviewRun`.
- Produces `reviewCheckStatus(findings): ReviewCheckStatus` internally.
- Review code may reuse `runCvHealthCheck` but must not call React, toast, persistence or route code.

- [ ] **Step 1: Write the base reviewer fixture and failing outcome tests**

Create `src/lib/careeros/review.test.ts` with a fixture that uses only Verified evidence and a current signed scan:

```ts
import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { runScan } from "./scoring";
import { reviewApplicationPack } from "./review";

function makePack() {
  const data = createCareerOsData();
  const job = data.jobs[0]!;
  const scan = runScan(job, data);
  const cv = {
    id: "cv-review",
    name: "Review CV",
    category: "Product Marketing" as const,
    status: "Draft" as const,
    applicationId: "app-review",
    jobId: job.id,
    updatedAt: "2026-08-20T00:00:00.000Z",
    versions: [
      {
        id: "cvv-review-1",
        version: 1,
        createdAt: "2026-08-20T00:00:00.000Z",
        note: "Review fixture",
        body: [
          "# Vinnie Jegathees",
          "## Professional Experience",
          "- Managed paid acquisition and reported performance to senior stakeholders.",
          "- Delivered landing-page and A/B testing work with website and stakeholder teams.",
        ].join("\n"),
        evidenceIds: ["ev-ab"],
      },
    ],
  };
  const coverLetter = {
    id: "cl-review-1",
    applicationId: "app-review",
    jobId: job.id,
    status: "Draft" as const,
    body: `Dear Hiring Team,\n\nI am applying for the ${job.title} role at ${job.company}. My verified experience includes A/B testing and stakeholder reporting.\n\nYours sincerely,\nVinnie Jegathees`,
    emailVersion: "Application email",
    evidenceIds: ["ev-ab"],
    createdAt: "2026-08-20T00:00:00.000Z",
  };

  return {
    data,
    application: {
      id: "app-review",
      jobId: job.id,
      company: job.company,
      title: job.title,
    },
    job,
    scan,
    cv,
    cvVersion: cv.versions[0],
    coverLetter,
  };
}

describe("Agent 02 deterministic reviewer", () => {
  it("can reach READY FOR VINNIE APPROVAL when no blocking finding remains", () => {
    const result = reviewApplicationPack(makePack());
    expect(result.outcome).toBe("READY FOR VINNIE APPROVAL");
    expect(result.checks.some((check) => check.status === "Fail")).toBe(false);
  });

  it("returns NEEDS INPUT for unverified evidence", () => {
    const pack = makePack();
    pack.data.evidence.find((record) => record.id === "ev-ab")!.status = "Needs Evidence";
    const result = reviewApplicationPack(pack);
    expect(result.outcome).toBe("NEEDS INPUT");
    expect(result.checks.find((check) => check.key === "evidence")?.status).toBe("Fail");
  });
});
```

Use the full `Application` type in the actual fixture. Fill its required fields from the current interface rather than weakening production types.

- [ ] **Step 2: Run reviewer tests and verify RED**

```bash
npm test -- src/lib/careeros/review.test.ts
```

Expected: FAIL because `review.ts` does not exist.

- [ ] **Step 3: Implement the reviewer input and finding helpers**

Create `src/lib/careeros/review.ts` with these public interfaces:

```ts
import { runCvHealthCheck } from "./generate";
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
```

Add deterministic finding construction:

```ts
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
  findings: ReviewFinding[],
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
```

- [ ] **Step 4: Implement evidence, metrics and house-style checks**

Use these rules:

```ts
const METRIC_PATTERN = /[£$€]\s?\d[\d,.]*\s?[kKmMbB]?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\s?(?:x|times)\b/gi;
const US_SPELLING_PATTERN = /\b(optimize|optimized|optimization|organize|organized|analyze|analyzed|behavior|color)\b/i;
const AI_RISK_PHRASES = [
  "results-driven",
  "dynamic professional",
  "passionate about",
  "proven track record",
  "world-class",
  "leveraging synergies",
  "uniquely positioned",
];
```

Evidence check:

- Every `cvVersion.evidenceIds` and `coverLetter.evidenceIds` must resolve to `EvidenceRecord.status === "Verified"`.
- Missing evidence IDs are blocking with `resolution: "Input"`.
- Known non-Approved profile wording already caught by `runCvHealthCheck(...).unsupportedClaims` is blocking.

Metric check:

- Extract only currency, percentage and multiplier-like values with `METRIC_PATTERN`.
- Build the allowed metric corpus from Verified evidence `metricValue` plus Approved profile item `safeWording ?? value`.
- A metric phrase absent from the allowed corpus is blocking `Input`.
- Plain four-digit years are not metric matches and must not be flagged by this regex.

British English and house style:

- Any em dash `—` is blocking `Revision`.
- A US spelling match is blocking `Revision`.

AI-like language risk:

- Matches from `AI_RISK_PHRASES` are advisory only.
- Label the check exactly `AI-like language risk`.

- [ ] **Step 5: Implement chronology, ATS, STAR and cover-letter checks**

Chronology:

```ts
function chronologyFindings(body: string, data: CareerOsData): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  for (const role of data.profile.employment) {
    if (!body.toLowerCase().includes(role.company.toLowerCase())) continue;
    const allowedYears = [role.start, role.end]
      .flatMap((value) => value.match(/\b20\d{2}\b/g) ?? []);
    const roleLine = body
      .split("\n")
      .find((line) => line.toLowerCase().includes(role.company.toLowerCase()));
    const visibleYears = roleLine?.match(/\b20\d{2}\b/g) ?? [];
    if (visibleYears.some((year) => !allowedYears.includes(year))) {
      findings.push(
        finding(
          "chronology",
          "Blocking",
          "Input",
          `${role.company} contains a date that conflicts with the approved CareerOS chronology.`,
        ),
      );
    }
  }
  return findings;
}
```

ATS and STAR:

- Reuse `runCvHealthCheck(cvVersion.body, data, job, scan)`.
- `missingKeywords` produce advisory findings only.
- `weakBullets` produce advisory findings unless the bullet also contains unsupported evidence or a metric violation already caught elsewhere.
- Existing formatting failures become `Revision` blockers only for the approved house rules.

Cover letter:

- Failing to contain the exact `job.title` or `job.company` is blocking `Revision`.
- Evidence IDs must be Verified.
- More than 650 words is blocking `Revision`.
- Generic/AI-risk phrases are advisory.

JD alignment:

- Required Evidence Map items with `Gap` or `Blocked` become advisory fit findings.
- Do not transform a missing required capability into a claim.

- [ ] **Step 6: Implement outcome precedence and immutable review-run construction**

Add:

```ts
function outcomeFor(findings: ReviewFinding[]): ReviewOutcome {
  if (findings.some((item) => item.severity === "Blocking" && item.resolution === "Input")) {
    return "NEEDS INPUT";
  }
  if (findings.some((item) => item.severity === "Blocking")) {
    return "NEEDS REVISION";
  }
  return "READY FOR VINNIE APPROVAL";
}
```

`reviewApplicationPack(pack)` must:

1. Build all nine checks.
2. Flatten findings.
3. Calculate `inputSignature` from the exact pack IDs and JD/scan signatures.
4. Return a new `ApplicationReviewRun` with a fresh ID and `createdAt`.
5. Build `strengths` from Pass checks plus verified evidence context, capped at five.
6. Build `highPriorityFixes` from Blocking findings, capped at eight.

Use a deterministic ID prefix plus timestamp for the run, for example:

```ts
id: `review-${Date.now()}`,
```

Do not mutate `pack.data` inside the reviewer.

- [ ] **Step 7: Add the rest of the required unit tests**

Add explicit tests for:

```ts
it("returns NEEDS INPUT for an unsupported metric", ...);
it("returns NEEDS INPUT for a clear chronology conflict", ...);
it("returns NEEDS REVISION for an em dash", ...);
it("returns NEEDS REVISION for known US spelling", ...);
it("keeps ATS gaps advisory when no evidence supports the missing term", ...);
it("labels heuristic prose findings as AI-like language risk", ...);
it("blocks cover-letter evidence that is not Verified", ...);
it("allows advisory warnings while remaining READY FOR VINNIE APPROVAL", ...);
it("uses NEEDS INPUT before NEEDS REVISION when both exist", ...);
```

Each test must mutate only one fixture dimension unless it is explicitly testing outcome precedence.

- [ ] **Step 8: Run reviewer tests and verify GREEN**

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run generator regressions**

```bash
npm test -- src/lib/careeros/generate.profile.test.ts src/lib/careeros/review.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add src/lib/careeros/review.ts src/lib/careeros/review.test.ts src/lib/careeros/generate.ts
git commit -m "feat: add deterministic Agent 02 reviewer"
```

If `generate.ts` did not need a production change, do not stage it.

---

### Task 4: Add review staleness and derived application-gate state

**Files:**
- Modify: `src/lib/careeros/review.ts`
- Modify: `src/lib/careeros/review.test.ts`

**Interfaces:**
- Produces `CurrentReviewContext`.
- Produces `currentReviewInputSignature(context): string | null`.
- Produces `isCurrentReview(run, context): boolean`.
- Produces `applicationGateState(context): ApplicationGateState`.
- Produces `approvalEligibility(context): { allowed: boolean; reason: string }`.

- [ ] **Step 1: Write failing staleness tests**

Add fixtures where a passing review is stored in `data.reviewRuns`, then assert each changed input invalidates it:

```ts
it("marks a review outdated when a new CV version exists", () => {
  const context = reviewedContext();
  context.cv.versions.push({
    ...context.cv.versions.at(-1)!,
    id: "cvv-new",
    version: context.cv.versions.length + 1,
  });
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});

it("marks a review outdated when a new cover letter exists", ...);
it("marks a review outdated when the saved JD changes", ...);
it("marks a review outdated when the role scan changes", ...);
it("treats historical scans without a JD signature as requiring refresh", ...);
it("keeps historical review records but never uses them to authorise approval", ...);
```

- [ ] **Step 2: Run tests and verify RED**

```bash
npm test -- src/lib/careeros/review.test.ts
```

Expected: FAIL because gate helpers do not exist.

- [ ] **Step 3: Implement current context and scan-currency checks**

Add:

```ts
export type CurrentReviewContext = {
  data: CareerOsData;
  application: Application;
  job: JobRecord;
  scan?: ScanResult;
  cv?: CvDocument;
  coverLetter?: CoverLetter;
};

export function scanMatchesSavedJob(job: JobRecord, scan: ScanResult | undefined): boolean {
  return Boolean(
    scan?.jobDescriptionSignature &&
      scan.jobDescriptionSignature === textSignature(job.description),
  );
}
```

`currentReviewInputSignature` returns `null` unless all of these exist and are current:

- scan;
- scan JD signature matches saved JD;
- CV and latest CV version;
- latest cover letter for the application.

The latest cover letter is the application record with greatest `createdAt`, not array position.

- [ ] **Step 4: Implement gate-state calculation**

Use this exact precedence:

```ts
export function applicationGateState(context: CurrentReviewContext): ApplicationGateState {
  const signature = currentReviewInputSignature(context);
  const applicationReviews = context.data.reviewRuns
    .filter((run) => run.applicationId === context.application.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!applicationReviews.length) return "NOT REVIEWED";
  if (!signature) return "REVIEW OUTDATED";

  const current = applicationReviews.find((run) => run.inputSignature === signature);
  if (!current) return "REVIEW OUTDATED";
  if (current.outcome === "NEEDS INPUT") return "NEEDS INPUT";
  if (current.outcome === "NEEDS REVISION") return "NEEDS REVISION";

  const latestCvVersion = context.cv?.versions.at(-1);
  const latestLetter = latestApplicationCoverLetter(context);
  const cvApproved = Boolean(
    context.cv && latestCvVersion && context.cv.approvedVersionId === latestCvVersion.id,
  );
  const letterApproved = latestLetter?.status === "Approved";

  return cvApproved && letterApproved ? "READY TO APPLY" : "READY FOR VINNIE APPROVAL";
}
```

Do not infer readiness from old document-level CV `status`.

- [ ] **Step 5: Implement approval eligibility**

```ts
export function approvalEligibility(context: CurrentReviewContext) {
  const state = applicationGateState(context);
  if (state === "READY FOR VINNIE APPROVAL" || state === "READY TO APPLY") {
    return { allowed: true, reason: "Current application pack passed Agent 02 review." };
  }
  return {
    allowed: false,
    reason:
      state === "NOT REVIEWED"
        ? "Run final review before approving this document."
        : state === "REVIEW OUTDATED"
          ? "The final review is outdated. Re-run it for the current application pack."
          : "Resolve the blocking reviewer findings before approval.",
  };
}
```

- [ ] **Step 6: Run reviewer tests and verify GREEN**

```bash
npm test -- src/lib/careeros/review.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/lib/careeros/review.ts src/lib/careeros/review.test.ts
git commit -m "feat: derive CareerOS final application gate"
```

---

### Task 5: Enforce review before CV and cover-letter approval

**Files:**
- Modify: `src/routes/applications.$id.tsx`
- Modify: `src/routes/-application-workflow.test.tsx`

**Interfaces:**
- Route consumes `reviewApplicationPack`, `applicationGateState`, `approvalEligibility`, `scanMatchesSavedJob`, `latestApplicationCoverLetter` from `review.ts`.
- Persisted review run is inserted at the front of `draft.reviewRuns` without deleting history.
- CV approval writes both `status = "Approved"` and `approvedVersionId = latestCvVersion.id`.

- [ ] **Step 1: Add failing workflow tests for the approval gate**

In `src/routes/-application-workflow.test.tsx`, update the fixture scan to include:

```ts
jobDescriptionSignature: textSignature(data.jobs[0]!.description),
```

Then add:

```ts
it("blocks CV and cover-letter approval before a current passing review", async () => {
  renderWorkspace();
  await screen.findByRole("heading", { name: "Growth Marketing Manager" });

  fireEvent.mouseDown(screen.getByRole("tab", { name: "CV" }), { button: 0 });
  expect(screen.getByRole("button", { name: "Approve latest CV" })).toBeDisabled();

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Cover Letter" }), { button: 0 });
  expect(screen.getByRole("button", { name: "Approve latest cover letter" })).toBeDisabled();
});
```

Add a second test that runs final review, then asserts those exact latest-version approval buttons become enabled.

- [ ] **Step 2: Run the workflow test and verify RED**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

Expected: FAIL because current approval buttons are not gated by review state.

- [ ] **Step 3: Clear CV approval provenance on a new CV draft**

Inside `generateCv()` when an existing CV receives a new version, add:

```ts
existing.status = "Draft";
existing.approvedVersionId = undefined;
```

The new CV object does not set `approvedVersionId`.

A new cover letter is already a new record with `status: "Draft"`; do not mutate prior cover-letter records.

- [ ] **Step 4: Add route-level current review context**

Use the persisted `job.description`, not `jdDraft`, for reviewer currency.

Construct:

```ts
const reviewContext = useMemo(
  () =>
    app && job
      ? {
          data,
          application: app,
          job,
          scan,
          cv,
          coverLetter: latestLetter,
        }
      : null,
  [app, job, scan, cv, latestLetter, data],
);

const gateState = reviewContext ? applicationGateState(reviewContext) : "NOT REVIEWED";
const approval = reviewContext
  ? approvalEligibility(reviewContext)
  : { allowed: false, reason: "Complete the application pack first." };
```

- [ ] **Step 5: Add `runFinalReview()` and persist immutable review history**

The handler must refuse to review if:

- `jdDraft !== job.description`;
- scan is missing or scan signature does not match the saved JD;
- CV/latest CV version is missing;
- latest cover letter is missing.

On success:

```ts
const run = reviewApplicationPack({
  data,
  application: app,
  job,
  scan,
  cv,
  cvVersion: latestCvVersion,
  coverLetter: latestLetter,
});

update((draft) => {
  draft.reviewRuns = [run, ...draft.reviewRuns];
  const targetApplication = draft.applications.find((item) => item.id === app.id);
  if (targetApplication) {
    targetApplication.history = [
      { at: run.createdAt, entry: `Final review: ${run.outcome}.` },
      ...targetApplication.history,
    ];
  }
  return draft;
});
```

Do not auto-regenerate or auto-approve either document.

- [ ] **Step 6: Enforce approval inside the handlers, not only the UI**

`approveCv()`:

```ts
if (!cv || !latestCvVersion || !approval.allowed) {
  toast.error(approval.reason);
  return;
}
update((draft) => {
  const target = draft.cvs.find((candidate) => candidate.id === cv.id);
  if (target) {
    target.status = "Approved";
    target.approvedVersionId = latestCvVersion.id;
  }
  return draft;
});
```

`approveLatestLetter()`:

```ts
if (!latestLetter || !approval.allowed) {
  toast.error(approval.reason);
  return;
}
update((draft) => {
  const target = draft.coverLetters.find((candidate) => candidate.id === latestLetter.id);
  if (target) target.status = "Approved";
  return draft;
});
```

The buttons use `disabled={!approval.allowed || comparingOlder...}` as appropriate.

- [ ] **Step 7: Re-run workflow tests and verify GREEN**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run reviewer plus workflow tests together**

```bash
npm test -- src/lib/careeros/review.test.ts src/routes/-application-workflow.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add src/routes/applications.$id.tsx src/routes/-application-workflow.test.tsx
git commit -m "feat: require final review before document approval"
```

---

### Task 6: Add the Apply-stage Final Review panel and reviewer checkpoint

**Files:**
- Create: `src/components/careeros/final-review-panel.tsx`
- Modify: `src/routes/applications.$id.tsx`
- Modify: `src/routes/-application-workflow.test.tsx`

**Interfaces:**
- Component receives display-ready state and callback only.
- Component never calculates reviewer outcomes or approval eligibility.

Define props:

```ts
export type FinalReviewPanelProps = {
  gateState: ApplicationGateState;
  latestReview?: ApplicationReviewRun;
  cvVersionLabel?: string;
  coverLetterVersionLabel?: string;
  scanCurrent: boolean;
  canRunReview: boolean;
  reviewDisabledReason?: string;
  onRunReview: () => void;
};
```

- [ ] **Step 1: Write failing Apply-stage UI tests**

Add to `src/routes/-application-workflow.test.tsx`:

```ts
it("shows the final reviewer inside Apply without adding a seventh tab", async () => {
  renderWorkspace();
  await screen.findByRole("heading", { name: "Growth Marketing Manager" });
  expect(screen.getAllByRole("tab")).toHaveLength(6);

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), { button: 0 });
  expect(screen.getByRole("heading", { name: "Final review" })).toBeInTheDocument();
  expect(screen.getByText("Reviewer: Not reviewed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run final review" })).toBeInTheDocument();
});
```

Add a passing-review UI test asserting the panel renders Pass/Warning/Fail check labels and `READY FOR VINNIE APPROVAL` without auto-approving documents.

- [ ] **Step 2: Run workflow test and verify RED**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement `FinalReviewPanel` as a pure presenter**

The component must render:

- heading `Final review`;
- a `StatusPill` for `gateState`;
- current scan status;
- exact reviewed CV version label;
- exact reviewed cover-letter version label;
- every check with its Pass/Warning/Fail status;
- `strengths`;
- `highPriorityFixes`;
- finding messages grouped by check;
- button text `Run final review` when no current review exists and `Re-run final review` otherwise;
- concise `reviewDisabledReason` when the action is unavailable.

Use existing `Panel`, `StatusPill` and Button patterns. Do not introduce a new design system.

- [ ] **Step 4: Render it in Apply and extend Application Pack**

In the existing Apply tab:

1. Keep Application tracking and Interview prep.
2. Keep Application Pack.
3. Add a reviewer checkpoint line:

```tsx
<StatusPill label={`Reviewer: ${reviewerPackLabel}`} tone={reviewerTone} />
```

Mapping:

- `NOT REVIEWED` -> `Not reviewed`
- `REVIEW OUTDATED` -> `Review outdated`
- `NEEDS INPUT` -> `Needs input`
- `NEEDS REVISION` -> `Needs revision`
- `READY FOR VINNIE APPROVAL` -> `Ready for approval`
- `READY TO APPLY` -> `Ready to apply`

4. Render `<FinalReviewPanel ... />` in Apply.

- [ ] **Step 5: Add explicit stale-JD UI behaviour**

If `jdDraft !== job.description`, pass:

```ts
canRunReview: false,
reviewDisabledReason: "Save the job description and re-run the role scan before final review.",
```

If the saved JD differs from the scan signature:

```ts
reviewDisabledReason: "Re-run the role scan for the current saved job description.",
```

If CV or cover letter is missing, identify the missing artifact directly.

- [ ] **Step 6: Re-run workflow tests and verify GREEN**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/components/careeros/final-review-panel.tsx src/routes/applications.$id.tsx src/routes/-application-workflow.test.tsx
git commit -m "feat: add final reviewer to application workspace"
```

---

### Task 7: Complete end-to-end staleness, approval and readiness regressions

**Files:**
- Modify: `src/routes/-application-workflow.test.tsx`
- Modify: `src/lib/careeros/review.test.ts`
- Modify: `src/lib/careeros/cloud-bootstrap.test.ts` only if a missing backward-compatibility case remains.

**Interfaces:**
- No new production interface unless a failing test exposes a missing domain helper.
- Any required production fix belongs in the smallest existing module, normally `review.ts`, `normalise.ts`, or `applications.$id.tsx`.

- [ ] **Step 1: Add the full current-pack happy-path workflow test**

The test sequence must be:

```ts
1. Open Apply.
2. Run final review.
3. Assert READY FOR VINNIE APPROVAL.
4. Open CV and explicitly approve the latest CV.
5. Open Cover Letter and explicitly approve the latest cover letter.
6. Return to Apply.
7. Assert READY TO APPLY.
```

Also assert the repository `save` mock receives:

- one new review-run record tied to `cvv-2` and `cl-2`;
- `cv.approvedVersionId === "cvv-2"` after CV approval;
- `cl-2.status === "Approved"` after cover-letter approval.

- [ ] **Step 2: Add four invalidation workflow tests**

Add separate tests:

```ts
it("removes READY TO APPLY after a new CV draft", ...);
it("removes READY TO APPLY after a new cover-letter draft", ...);
it("requires save and re-scan after the JD is edited", ...);
it("marks the old review outdated after a new role scan", ...);
```

Each test begins from a fixture with a valid passing review and exact artifact approvals, then performs one invalidating action and asserts `REVIEW OUTDATED` or the corresponding user-facing copy.

- [ ] **Step 3: Add reviewer history regression**

In `review.test.ts`, prove two runs for the same application can coexist:

```ts
expect([newRun, oldRun]).toHaveLength(2);
expect(newRun.id).not.toBe(oldRun.id);
expect(newRun.inputSignature).not.toBe(oldRun.inputSignature);
```

Do not delete or mutate the old run.

- [ ] **Step 4: Add historical approved-CV regression**

Create old state with:

```ts
cv.status = "Approved";
cv.approvedVersionId = undefined;
```

Assert the Sprint 6 gate does not interpret that as current reviewed approval:

```ts
expect(applicationGateState(context)).not.toBe("READY TO APPLY");
```

- [ ] **Step 5: Run targeted regression suite and verify RED/GREEN for any uncovered issue**

Run:

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/cloud-bootstrap.test.ts src/routes/-application-workflow.test.tsx
```

Expected after minimal fixes: PASS.

If a new failing case requires production changes, add only the minimal fix, re-run the exact failing test first, then run the four-file command again.

- [ ] **Step 6: Commit Task 7**

Stage only files actually changed:

```bash
git add src/lib/careeros/review.test.ts src/lib/careeros/cloud-bootstrap.test.ts src/routes/-application-workflow.test.tsx
```

If production files changed to satisfy a newly exposed regression, add those exact files individually too.

Commit:

```bash
git commit -m "test: cover CareerOS final review workflow"
```

---

### Task 8: Full repository verification and branch review

**Files:**
- No planned production changes.
- Formatting-only edits are allowed only if Prettier identifies them.

**Interfaces:**
- Produces verification evidence for the exact implementation head.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all test files and all tests pass with zero failures.

- [ ] **Step 2: Run Prettier in check mode without rewriting first**

```bash
npx prettier --check src/lib/careeros/types.ts src/lib/careeros/seed.ts src/lib/careeros/normalise.ts src/lib/careeros/scoring.ts src/lib/careeros/review-signature.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/review.ts src/lib/careeros/review.test.ts src/components/careeros/final-review-panel.tsx 'src/routes/applications.$id.tsx' src/routes/-application-workflow.test.tsx src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: all matched files use Prettier formatting.

If this fails, run Prettier only on the reported Sprint 6 files:

```bash
npx prettier --write <exact-reported-Sprint-6-files>
```

Then re-run the check command.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: zero lint errors. Existing non-blocking warnings may remain only if they pre-date Sprint 6 and are unchanged.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: Vite client build, SSR build and Nitro/Cloudflare production build complete successfully with exit code 0.

- [ ] **Step 5: Run the Cloudflare dry-run build command**

```bash
npm run deploy:dry-run
```

Expected: application builds and Wrangler dry-run completes without deploying anything.

- [ ] **Step 6: Review the exact branch diff**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
git log --oneline --decorate main..HEAD
```

Expected:

- no uncommitted production changes;
- no whitespace errors;
- only Sprint 6 spec, plan, reviewer/state/scan/UI/test files differ from `main`;
- no Supabase SQL migration;
- no auth, Google Drive or unrelated application changes.

- [ ] **Step 7: Verify the spec line by line against the implementation**

Check these requirements explicitly against code and tests:

```text
[ ] saved JD has a current signed scan
[ ] exact CV version and cover-letter version are reviewed
[ ] immutable review history
[ ] NEEDS INPUT precedence
[ ] NEEDS REVISION behaviour
[ ] READY FOR VINNIE APPROVAL behaviour
[ ] user-only approval boundary
[ ] version-specific CV approval provenance
[ ] stale review after JD/scan/CV/letter change
[ ] READY TO APPLY only after exact reviewed artifacts are explicitly approved
[ ] evidence and metric blocking
[ ] chronology check
[ ] ATS advisory behaviour
[ ] STAR/bullet quality feedback
[ ] British English and em-dash rule
[ ] AI-like language risk wording
[ ] cover-letter quality check
[ ] historical state compatibility
[ ] six-stage workspace unchanged
[ ] no external AI call
[ ] no automatic submission
```

If any box cannot be supported by a test or direct code inspection, do not declare Sprint 6 complete. Add the missing test/fix first.

- [ ] **Step 8: Commit any verification-only formatting fix**

Only if Step 2 required formatting changes:

```bash
git add <exact-formatted-Sprint-6-files>
git commit -m "style: format Sprint 6 reviewer files"
```

If no formatting changes were required, do not create an empty commit.

- [ ] **Step 9: Re-run verification after the final commit**

Fresh evidence is required on the exact head:

```bash
npm test
npm run lint
npm run build
npm run deploy:dry-run
git diff --check main...HEAD
```

All commands must succeed before opening a pull request or claiming implementation completion.

---

## Execution Order and Review Gates

Implement Tasks 1 through 8 in order. Each task is independently reviewable and must finish its RED -> GREEN cycle before the next task starts.

Recommended checkpoints:

1. After Task 2: reviewer state and JD/scan trust foundation is stable.
2. After Task 4: deterministic reviewer and gate state are unit-tested before UI integration.
3. After Task 6: full user-facing workflow exists.
4. After Task 7: invalidation and backward-compatibility behaviour is covered.
5. After Task 8: exact-head verification is complete.

Do not open a PR until Task 8 passes. Do not merge without explicit user authorisation.

## Expected Sprint 6 End State

A successful implementation must demonstrate this exact behaviour:

1. The user saves a JD.
2. CareerOS runs a role scan and records the saved JD signature.
3. The user creates the latest CV and cover letter.
4. Apply shows `NOT REVIEWED` and blocks document approval.
5. The user runs Agent 02 final review.
6. Evidence or factual blockers produce `NEEDS INPUT`.
7. Fixable document-rule blockers produce `NEEDS REVISION`.
8. A clean pack produces `READY FOR VINNIE APPROVAL`.
9. The user explicitly approves the exact reviewed CV version and exact reviewed cover letter.
10. Apply derives `READY TO APPLY`.
11. Changing the saved JD, scan, CV version or cover letter immediately makes the previous review unusable for approval/readiness.
12. Historical reviews remain in state for auditability.
13. No application is submitted automatically.

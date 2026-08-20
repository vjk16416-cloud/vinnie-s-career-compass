# CareerOS Sprint 6 Automated Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Agent 02 quality gate that reviews the exact current saved JD, role scan, CV version and cover-letter version before explicit user approval can produce `READY TO APPLY`.

**Architecture:** Keep reviewer history inside the existing Supabase-authoritative `CareerOsData` JSON state. Add deterministic signatures for saved JDs and full application packs, put review checks and gate calculation in a focused `review.ts` domain module, and keep the six-stage workspace unchanged by rendering the reviewer inside Apply. Document generation stays separate from review, and Sprint 6 does not call an external AI provider.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Start, Vitest 4, Testing Library, Supabase-backed CareerOS state, Vite 8, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-08-20-careeros-automated-reviewer-design.md`

## Global Constraints

- Reviewer outcomes are exactly `NEEDS INPUT`, `NEEDS REVISION`, and `READY FOR VINNIE APPROVAL`.
- Application gate states are exactly `NOT REVIEWED`, `REVIEW OUTDATED`, `NEEDS INPUT`, `NEEDS REVISION`, `READY FOR VINNIE APPROVAL`, and `READY TO APPLY`.
- Final review requires a saved JD, a current scan of that saved JD, the latest CV version and the latest cover letter.
- Historical scans without a JD signature load safely but cannot satisfy Sprint 6 final review.
- Review runs are immutable history.
- Agent 02 never approves documents.
- `READY TO APPLY` is derived, never manually stored.
- New CV/cover-letter drafts, a saved JD change, or a new scan invalidate previous readiness.
- Unsupported evidence and disputed metrics remain blocking.
- AI checks are labelled `AI-like language risk`, never an AI detector result.
- British English rules apply and em dashes are prohibited in application materials.
- No new Supabase SQL table is introduced for reviewer state.
- Job -> Match -> Evidence -> CV -> Cover Letter -> Apply remains the only workspace flow.
- Sprint 6 never auto-submits applications and never silently rewrites reviewed/approved artifacts.
- Every production change follows RED -> GREEN TDD before commit.

---

## File Map

### Create
- `src/lib/careeros/review-signature.ts`
- `src/lib/careeros/review-signature.test.ts`
- `src/lib/careeros/review.ts`
- `src/lib/careeros/review.test.ts`
- `src/components/careeros/final-review-panel.tsx`

### Modify
- `src/lib/careeros/types.ts`
- `src/lib/careeros/seed.ts`
- `src/lib/careeros/normalise.ts`
- `src/lib/careeros/scoring.ts`
- `src/lib/careeros/generate.ts` only when a failing reviewer test proves a pure health-check helper needs to be exported
- `src/routes/applications.$id.tsx`
- `src/routes/-application-workflow.test.tsx`
- `src/lib/careeros/cloud-bootstrap.test.ts`

### Leave untouched unless a failing test proves otherwise
- Supabase SQL migrations
- `src/lib/careeros/cloud-state.repository.ts`
- authentication/OAuth code
- Google Drive sync code
- CV/cover-letter export renderer

---

### Task 1: Reviewer state model and backward-compatible loading

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Modify: `src/lib/careeros/seed.ts`
- Modify: `src/lib/careeros/normalise.ts`
- Test: `src/lib/careeros/cloud-bootstrap.test.ts`

**Produces:** reviewer types, `CareerOsData.reviewRuns`, `ScanResult.jobDescriptionSignature?`, `CvDocument.approvedVersionId?`.

- [ ] **Step 1: Add the failing historical-state test**

Append to `src/lib/careeros/cloud-bootstrap.test.ts` using its existing `memoryStorage`, `cloudRow` and `repositoryWith` helpers:

```ts
it("normalises pre-Sprint-6 cloud state without losing existing data", async () => {
  const old = createCareerOsData();
  const oldShape = structuredClone(old) as CareerOsData & { reviewRuns?: unknown };
  delete oldShape.reviewRuns;
  delete oldShape.scans[0]?.jobDescriptionSignature;
  delete oldShape.cvs[0]?.approvedVersionId;

  const result = await bootstrapCareerState({
    userId: "user-1",
    repository: repositoryWith(cloudRow(oldShape as CareerOsData)),
    storage: memoryStorage(),
  });

  expect(result.data.reviewRuns).toEqual([]);
  expect(result.data.jobs).toEqual(old.jobs);
  expect(result.data.cvs[0]?.versions).toEqual(old.cvs[0]?.versions);
  expect(result.data.coverLetters).toEqual(old.coverLetters);
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts
```

Expected: FAIL because Sprint 6 fields are not yet part of the data model/normaliser.

- [ ] **Step 3: Add reviewer types**

Insert these definitions in `src/lib/careeros/types.ts`:

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

Add these properties inside the existing interfaces:

```ts
// inside CvDocument
approvedVersionId?: string;

// inside ScanResult
jobDescriptionSignature?: string;

// inside CareerOsData
reviewRuns: ApplicationReviewRun[];
```

- [ ] **Step 4: Seed and normalise**

In `seed.ts` add:

```ts
reviewRuns: [],
```

In `normalise.ts`, keep all existing fields and use:

```ts
cvs: list(saved.cvs, seed.cvs).map((cv) => ({
  ...cv,
  versions: list(cv?.versions, []),
  approvedVersionId: cv?.approvedVersionId,
})),
coverLetters: list(saved.coverLetters, seed.coverLetters),
scans: list(saved.scans, []).map((scan) => ({ ...scan })),
reviewRuns: list(saved.reviewRuns, []),
```

Historical `status: "Approved"` remains stored, but does not create `approvedVersionId`.

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- src/lib/careeros/cloud-bootstrap.test.ts src/lib/careeros/profile-extraction.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/lib/careeros/types.ts src/lib/careeros/seed.ts src/lib/careeros/normalise.ts src/lib/careeros/cloud-bootstrap.test.ts
git commit -m "feat: add CareerOS reviewer state model"
```

---

### Task 2: Saved-JD and pack signatures

**Files:**
- Create: `src/lib/careeros/review-signature.ts`
- Create: `src/lib/careeros/review-signature.test.ts`
- Modify: `src/lib/careeros/scoring.ts`

**Produces:** `textSignature()`, `reviewInputSignature()`, signed scans.

- [ ] **Step 1: Write failing signature tests**

Create `review-signature.test.ts`:

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
  it("is deterministic and changes when text changes", () => {
    expect(textSignature("same JD")).toBe(textSignature("same JD"));
    expect(textSignature("same JD")).not.toBe(textSignature("changed JD"));
  });

  it("changes when a reviewed artifact changes", () => {
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, cvVersionId: "cvv-3" }),
    );
    expect(reviewInputSignature(identity)).not.toBe(
      reviewInputSignature({ ...identity, coverLetterId: "cl-3" }),
    );
  });

  it("stores the saved JD signature on each new scan", () => {
    const data = createCareerOsData();
    const job = data.jobs[0]!;
    expect(runScan(job, data).jobDescriptionSignature).toBe(textSignature(job.description));
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/lib/careeros/review-signature.test.ts
```

- [ ] **Step 3: Implement `review-signature.ts`**

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

- [ ] **Step 4: Sign new scans**

In `scoring.ts`, import `textSignature` and add:

```ts
jobDescriptionSignature: textSignature(job.description),
```

inside the returned `ScanResult`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm test -- src/lib/careeros/review-signature.test.ts src/lib/careeros/generic-requirements.test.ts
git add src/lib/careeros/review-signature.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/scoring.ts
git commit -m "feat: bind role scans to saved job descriptions"
```

---

### Task 3: Deterministic Agent 02 reviewer

**Files:**
- Create: `src/lib/careeros/review.ts`
- Create: `src/lib/careeros/review.test.ts`
- Modify: `src/lib/careeros/generate.ts` only when a failing test requires a pure helper export.

**Produces:** `ReviewPack`, `reviewApplicationPack()`.

- [ ] **Step 1: Build a complete test fixture**

In `review.test.ts`, create `makePack()` from `createCareerOsData()` and `runScan()`. Use this complete application object:

```ts
const application: Application = {
  id: "app-review",
  jobId: job.id,
  company: job.company,
  title: job.title,
  location: job.location,
  workingArrangement: "Hybrid",
  employmentType: "Permanent",
  priority: "High",
  stage: "Preparing",
  dateAdded: "2026-08-20T00:00:00.000Z",
  notes: "Reviewer fixture",
  nextAction: "Run final review",
  compatibilityScore: scan.overall,
  linkedCvId: "cv-review",
  history: [],
};
```

Use this CV:

```ts
const cv: CvDocument = {
  id: "cv-review",
  name: `${job.title} | ${job.company}`,
  category: "Product Marketing",
  status: "Draft",
  applicationId: application.id,
  jobId: job.id,
  updatedAt: "2026-08-20T00:00:00.000Z",
  versions: [
    {
      id: "cvv-review-1",
      version: 1,
      createdAt: "2026-08-20T00:00:00.000Z",
      note: "Reviewer fixture",
      body: [
        "# Vinnie Jegathees",
        "## Professional Experience",
        "- Delivered landing-page and A/B testing work with website and stakeholder teams.",
      ].join("\n"),
      evidenceIds: ["ev-ab"],
    },
  ],
};
```

Use this cover letter:

```ts
const coverLetter: CoverLetter = {
  id: "cl-review-1",
  applicationId: application.id,
  jobId: job.id,
  status: "Draft",
  body: [
    "Dear Hiring Team,",
    "",
    `I am applying for the ${job.title} role at ${job.company}.`,
    "My verified experience includes landing-page and A/B testing work with website and stakeholder teams.",
    "",
    "Yours sincerely,",
    "Vinnie Jegathees",
  ].join("\n"),
  emailVersion: `Application for ${job.title} at ${job.company}`,
  evidenceIds: ["ev-ab"],
  createdAt: "2026-08-20T00:00:00.000Z",
};
```

Return `{ data, application, job, scan, cv, cvVersion: cv.versions[0]!, coverLetter }`.

- [ ] **Step 2: Add first failing tests and verify RED**

```ts
it("can reach READY FOR VINNIE APPROVAL when no blocking issue remains", () => {
  expect(reviewApplicationPack(makePack()).outcome).toBe("READY FOR VINNIE APPROVAL");
});

it("returns NEEDS INPUT for unverified evidence", () => {
  const pack = makePack();
  pack.data.evidence.find((item) => item.id === "ev-ab")!.status = "Needs Evidence";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
});
```

Run:

```bash
npm test -- src/lib/careeros/review.test.ts
```

Expected: FAIL because `review.ts` does not exist.

- [ ] **Step 3: Implement reviewer public types/helpers**

```ts
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
```

- [ ] **Step 4: Implement deterministic check rules**

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

Implement nine checks:

1. `jd-alignment`: Required Evidence Map `Gap`/`Blocked` items are advisory fit findings.
2. `evidence`: Every CV/cover-letter evidence ID must resolve to `Verified`; missing/non-Verified evidence is Blocking/Input.
3. `metrics`: Currency, percentage and multiplier values must exist in Verified `metricValue` or Approved profile wording; unsupported values are Blocking/Input.
4. `chronology`: A known employer line containing a year outside the approved employment start/end years is Blocking/Input.
5. `ats`: Reuse `runCvHealthCheck`; missing keywords are advisory when no supported evidence exists.
6. `star`: Existing weak/vague bullets are advisory unless another factual rule blocks the same claim.
7. `british-english`: An em dash or known US spelling is Blocking/Revision.
8. `ai-language-risk`: `AI_RISK_PHRASES` matches are Advisory and the check label is exactly `AI-like language risk`.
9. `cover-letter`: Missing exact role/company or >650 words is Blocking/Revision; non-Verified evidence is Blocking/Input.

- [ ] **Step 5: Implement outcome precedence**

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

`reviewApplicationPack()` returns a new `ApplicationReviewRun`, builds an input signature from exact pack identities, caps `strengths` at five and `highPriorityFixes` at eight, and never mutates `pack.data`.

- [ ] **Step 6: Add concrete reviewer tests**

```ts
it("returns NEEDS INPUT for an unsupported metric", () => {
  const pack = makePack();
  pack.cvVersion.body += "\n- Increased conversion by 91%.";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
});

it("returns NEEDS INPUT for a chronology conflict", () => {
  const pack = makePack();
  pack.cvVersion.body += "\nNortheastern University London | 2022-2025";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
});

it("returns NEEDS REVISION for an em dash", () => {
  const pack = makePack();
  pack.coverLetter.body += "\nDelivery — analytics.";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS REVISION");
});

it("returns NEEDS REVISION for known US spelling", () => {
  const pack = makePack();
  pack.coverLetter.body += "\nI optimized campaign reporting.";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS REVISION");
});

it("keeps unsupported ATS keywords advisory", () => {
  const result = reviewApplicationPack(makePack());
  const ats = result.checks.find((check) => check.key === "ats")!;
  expect(ats.status).not.toBe("Fail");
});

it("labels heuristic prose findings as AI-like language risk", () => {
  const pack = makePack();
  pack.coverLetter.body += "\nI am a results-driven professional.";
  const result = reviewApplicationPack(pack);
  expect(result.checks.find((check) => check.key === "ai-language-risk")?.label).toBe(
    "AI-like language risk",
  );
});

it("blocks non-Verified cover-letter evidence", () => {
  const pack = makePack();
  pack.data.evidence.find((item) => item.id === "ev-ab")!.status = "Archived";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
});

it("allows advisory warnings while remaining READY FOR VINNIE APPROVAL", () => {
  const pack = makePack();
  pack.coverLetter.body += "\nI am a results-driven professional.";
  expect(reviewApplicationPack(pack).outcome).toBe("READY FOR VINNIE APPROVAL");
});

it("uses NEEDS INPUT before NEEDS REVISION when both exist", () => {
  const pack = makePack();
  pack.cvVersion.body += "\n- Increased conversion by 91%.";
  pack.coverLetter.body += "\nDelivery — analytics.";
  expect(reviewApplicationPack(pack).outcome).toBe("NEEDS INPUT");
});
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/generate.profile.test.ts
git add src/lib/careeros/review.ts src/lib/careeros/review.test.ts
git commit -m "feat: add deterministic Agent 02 reviewer"
```

If `generate.ts` changed to expose a pure helper, stage it explicitly before the commit.

---

### Task 4: Review currency and derived final gate

**Files:**
- Modify: `src/lib/careeros/review.ts`
- Modify: `src/lib/careeros/review.test.ts`

**Produces:** `scanMatchesSavedJob()`, `currentReviewInputSignature()`, `applicationGateState()`, `approvalEligibility()`.

- [ ] **Step 1: Add failing staleness tests**

```ts
it("marks a review outdated after a new CV version", () => {
  const context = reviewedContext();
  const latest = context.cv!.versions.at(-1)!;
  context.cv!.versions.push({ ...latest, id: "cvv-new", version: latest.version + 1 });
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});

it("marks a review outdated after a new cover letter", () => {
  const context = reviewedContext();
  context.data.coverLetters.unshift({
    ...context.coverLetter!,
    id: "cl-new",
    createdAt: "2026-08-21T00:00:00.000Z",
    status: "Draft",
  });
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});

it("marks a review outdated after the saved JD changes", () => {
  const context = reviewedContext();
  context.job.description += " Additional requirement.";
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});

it("marks a review outdated after a new scan", () => {
  const context = reviewedContext();
  context.scan = { ...context.scan!, id: "scan-new" };
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});

it("requires a fresh scan when historical scan signature is absent", () => {
  const context = reviewedContext();
  context.scan!.jobDescriptionSignature = undefined;
  expect(applicationGateState(context)).toBe("REVIEW OUTDATED");
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/lib/careeros/review.test.ts
```

- [ ] **Step 3: Implement scan currency**

```ts
export function scanMatchesSavedJob(job: JobRecord, scan: ScanResult | undefined): boolean {
  return Boolean(
    scan?.jobDescriptionSignature &&
      scan.jobDescriptionSignature === textSignature(job.description),
  );
}
```

- [ ] **Step 4: Implement current signature and gate state**

`currentReviewInputSignature(context)` returns `null` unless the scan matches the saved JD, a CV/latest CV version exists, and a latest application cover letter exists. Latest cover letter is chosen by greatest `createdAt`.

Use this gate precedence:

```text
NOT REVIEWED
REVIEW OUTDATED
NEEDS INPUT
NEEDS REVISION
READY FOR VINNIE APPROVAL
READY TO APPLY
```

`READY TO APPLY` requires:

```ts
context.cv?.approvedVersionId === context.cv?.versions.at(-1)?.id &&
latestApplicationCoverLetter(context)?.status === "Approved"
```

- [ ] **Step 5: Implement approval eligibility**

Allow approval only in `READY FOR VINNIE APPROVAL` or `READY TO APPLY`. Return exact reasons for the other states:

```text
NOT REVIEWED: Run final review before approving this document.
REVIEW OUTDATED: The final review is outdated. Re-run it for the current application pack.
NEEDS INPUT: Resolve the evidence or factual blockers before approval.
NEEDS REVISION: Resolve the reviewer revisions before approval.
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
npm test -- src/lib/careeros/review.test.ts
git add src/lib/careeros/review.ts src/lib/careeros/review.test.ts
git commit -m "feat: derive CareerOS final application gate"
```

---

### Task 5: Enforce review before explicit approval

**Files:**
- Modify: `src/routes/applications.$id.tsx`
- Modify: `src/routes/-application-workflow.test.tsx`

- [ ] **Step 1: Make the workflow fixture scan current**

Import `textSignature` and add to `scan-test`:

```ts
jobDescriptionSignature: textSignature(data.jobs[0]!.description),
```

- [ ] **Step 2: Add failing approval tests**

```ts
it("blocks document approval before a current passing review", async () => {
  renderWorkspace();
  await screen.findByRole("heading", { name: "Growth Marketing Manager" });

  fireEvent.mouseDown(screen.getByRole("tab", { name: "CV" }), { button: 0 });
  expect(screen.getByRole("button", { name: "Approve latest CV" })).toBeDisabled();

  fireEvent.mouseDown(screen.getByRole("tab", { name: "Cover Letter" }), { button: 0 });
  expect(screen.getByRole("button", { name: "Approve latest cover letter" })).toBeDisabled();
});
```

Add a second workflow test that opens Apply, clicks `Run final review`, then verifies both approval buttons become enabled while both statuses remain Draft until clicked.

- [ ] **Step 3: Verify RED**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

- [ ] **Step 4: Invalidate CV approval provenance on regeneration**

Inside existing-CV `generateCv()`:

```ts
existing.status = "Draft";
existing.approvedVersionId = undefined;
```

- [ ] **Step 5: Add `runFinalReview()`**

Refuse review when any condition holds:

```ts
if (jdDraft !== job.description) return;
if (!scan || !scanMatchesSavedJob(job, scan)) return;
if (!cv || !latestCvVersion) return;
if (!latestLetter) return;
```

On success call `reviewApplicationPack()` and prepend the run to `draft.reviewRuns`. Add application history entry `Final review: ${run.outcome}.`.

- [ ] **Step 6: Enforce handler-level approval**

`approveCv()` sets both:

```ts
target.status = "Approved";
target.approvedVersionId = latestCvVersion.id;
```

only when `approvalEligibility(...).allowed` is true.

`approveLatestLetter()` may approve only the latest reviewed cover-letter record and only under the same eligibility rule.

- [ ] **Step 7: Verify GREEN and commit**

```bash
npm test -- src/lib/careeros/review.test.ts src/routes/-application-workflow.test.tsx
git add 'src/routes/applications.$id.tsx' src/routes/-application-workflow.test.tsx
git commit -m "feat: require final review before document approval"
```

---

### Task 6: Apply-stage Final Review UI

**Files:**
- Create: `src/components/careeros/final-review-panel.tsx`
- Modify: `src/routes/applications.$id.tsx`
- Modify: `src/routes/-application-workflow.test.tsx`

- [ ] **Step 1: Add failing UI test**

```ts
it("shows final review inside Apply without adding a seventh tab", async () => {
  renderWorkspace();
  await screen.findByRole("heading", { name: "Growth Marketing Manager" });
  expect(screen.getAllByRole("tab")).toHaveLength(6);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), { button: 0 });
  expect(screen.getByRole("heading", { name: "Final review" })).toBeInTheDocument();
  expect(screen.getByText("Reviewer: Not reviewed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run final review" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

- [ ] **Step 3: Create pure presentation component**

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

Render the `Final review` heading, gate-state pill, scan state, exact reviewed version labels, every review check with Pass/Warning/Fail, strengths, high-priority fixes, finding messages, and `Run final review`/`Re-run final review`.

- [ ] **Step 4: Add reviewer checkpoint to Application Pack**

Use exact mapping:

```text
NOT REVIEWED -> Reviewer: Not reviewed
REVIEW OUTDATED -> Reviewer: Review outdated
NEEDS INPUT -> Reviewer: Needs input
NEEDS REVISION -> Reviewer: Needs revision
READY FOR VINNIE APPROVAL -> Reviewer: Ready for approval
READY TO APPLY -> Reviewer: Ready to apply
```

- [ ] **Step 5: Add exact disabled reasons**

```text
Unsaved JD: Save the job description and re-run the role scan before final review.
Stale scan: Re-run the role scan for the current saved job description.
No CV: Create a tailored CV before final review.
No cover letter: Create a cover letter before final review.
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
npm test -- src/routes/-application-workflow.test.tsx
git add src/components/careeros/final-review-panel.tsx 'src/routes/applications.$id.tsx' src/routes/-application-workflow.test.tsx
git commit -m "feat: add final reviewer to application workspace"
```

---

### Task 7: End-to-end readiness and invalidation regressions

**Files:**
- Modify: `src/routes/-application-workflow.test.tsx`
- Modify: `src/lib/careeros/review.test.ts`
- Modify: `src/lib/careeros/cloud-bootstrap.test.ts` only when the final data shape introduces a historical-state case not already covered by Task 1

- [ ] **Step 1: Add the full happy-path workflow test**

Execute this sequence in one test:

```text
1. Open Apply.
2. Click Run final review.
3. Assert Reviewer: Ready for approval.
4. Open CV and click Approve latest CV.
5. Open Cover Letter and click Approve latest cover letter.
6. Return to Apply.
7. Assert Reviewer: Ready to apply.
```

Inspect the repository save mock and assert the saved state contains a review run referencing `cvv-2` and `cl-2`, `cv-test.approvedVersionId === "cvv-2"`, and `cl-2.status === "Approved"`.

- [ ] **Step 2: Add concrete invalidation tests**

```ts
it("removes ready-to-apply state after a new CV draft", async () => {
  renderReadyToApplyWorkspace();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "CV" }), { button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "New draft" }));
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), { button: 0 });
  expect(screen.getByText("Reviewer: Review outdated")).toBeInTheDocument();
});

it("removes ready-to-apply state after a new cover-letter draft", async () => {
  renderReadyToApplyWorkspace();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Cover Letter" }), { button: 0 });
  fireEvent.click(screen.getByRole("button", { name: "New cover letter draft" }));
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), { button: 0 });
  expect(screen.getByText("Reviewer: Review outdated")).toBeInTheDocument();
});

it("requires save and re-scan after the JD is edited", async () => {
  renderReadyToApplyWorkspace();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Job" }), { button: 0 });
  fireEvent.change(screen.getByLabelText("Job description"), {
    target: { value: "Changed JD content ".repeat(50) },
  });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Apply" }), { button: 0 });
  expect(
    screen.getByText("Save the job description and re-run the role scan before final review."),
  ).toBeInTheDocument();
});
```

For scan invalidation, start from a valid reviewed fixture, click the existing `Run scan` action after saving the same JD, then assert `Reviewer: Review outdated` because the scan ID changed.

- [ ] **Step 3: Add immutable-history test**

```ts
it("keeps historical review runs after re-review", () => {
  const context = reviewedContext();
  const oldRun = context.data.reviewRuns[0]!;
  const newPack = currentReviewPack(context);
  newPack.cvVersion = { ...newPack.cvVersion, id: "cvv-new", version: 3 };
  const newRun = reviewApplicationPack(newPack);
  const history = [newRun, oldRun];

  expect(history).toHaveLength(2);
  expect(history[0]!.id).not.toBe(history[1]!.id);
  expect(history[0]!.inputSignature).not.toBe(history[1]!.inputSignature);
});
```

- [ ] **Step 4: Add historical-CV approval regression**

```ts
it("does not treat historical document approval as Sprint 6 version approval", () => {
  const context = reviewedContext();
  context.cv!.status = "Approved";
  context.cv!.approvedVersionId = undefined;
  expect(applicationGateState(context)).not.toBe("READY TO APPLY");
});
```

- [ ] **Step 5: Run targeted regression suite**

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/cloud-bootstrap.test.ts src/routes/-application-workflow.test.tsx
```

Expected: PASS after the smallest production fixes needed by these tests.

- [ ] **Step 6: Commit Task 7**

Stage each changed file explicitly, then:

```bash
git commit -m "test: cover CareerOS final review workflow"
```

---

### Task 8: Exact-head verification

**Files:** no planned production changes.

- [ ] **Step 1: Full tests**

```bash
npm test
```

Expected: zero failures.

- [ ] **Step 2: Prettier check**

```bash
npx prettier --check src/lib/careeros/types.ts src/lib/careeros/seed.ts src/lib/careeros/normalise.ts src/lib/careeros/scoring.ts src/lib/careeros/review-signature.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/review.ts src/lib/careeros/review.test.ts src/components/careeros/final-review-panel.tsx 'src/routes/applications.$id.tsx' src/routes/-application-workflow.test.tsx src/lib/careeros/cloud-bootstrap.test.ts
```

If Prettier reports Sprint 6 files, run `npx prettier --write` with exactly those reported paths, commit those formatting changes, then repeat all verification commands.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: zero errors.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 5: Cloudflare dry run**

```bash
npm run deploy:dry-run
```

Expected: Wrangler dry-run succeeds and deploys nothing.

- [ ] **Step 6: Branch integrity**

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
git log --oneline --decorate main..HEAD
```

Expected: no uncommitted production changes, no whitespace errors, no SQL migration, and no auth/Drive/unrelated feature changes.

- [ ] **Step 7: Spec coverage checklist**

```text
[ ] saved JD has a current signed scan
[ ] exact CV and cover-letter versions are reviewed
[ ] review history is immutable
[ ] NEEDS INPUT precedence works
[ ] NEEDS REVISION works
[ ] READY FOR VINNIE APPROVAL works
[ ] only the user can approve documents
[ ] CV approval is version-specific
[ ] JD/scan/CV/cover-letter changes invalidate readiness
[ ] READY TO APPLY requires exact reviewed artifacts to be approved
[ ] evidence and metrics can block
[ ] chronology is checked
[ ] ATS gaps are advisory when unsupported
[ ] STAR/bullet quality is reported
[ ] British English and em-dash rules are enforced
[ ] AI-like language is reported as risk, not detection
[ ] cover-letter quality is checked
[ ] historical cloud state loads safely
[ ] six-stage workspace remains unchanged
[ ] no external AI call exists
[ ] no automatic application submission exists
```

- [ ] **Step 8: Fresh verification on final commit**

```bash
npm test
npm run lint
npm run build
npm run deploy:dry-run
git diff --check main...HEAD
```

All five commands must succeed on the exact final head before a PR is opened or implementation completion is claimed.

---

## Execution Order

Run Tasks 1 through 8 in order. Each task must finish its RED -> GREEN cycle before the next task starts. Do not open a PR before Task 8 passes. Do not merge without explicit user authorisation.

## Expected End State

1. The user saves a JD.
2. CareerOS scans it and stores the JD signature on that scan.
3. The latest CV and cover letter form the application pack.
4. Apply shows `NOT REVIEWED` and blocks approval.
5. Agent 02 runs deterministically against the exact pack.
6. Evidence/factual blockers produce `NEEDS INPUT`.
7. Fixable document-rule blockers produce `NEEDS REVISION`.
8. A clean pack produces `READY FOR VINNIE APPROVAL`.
9. The user explicitly approves the exact reviewed CV version and exact reviewed cover letter.
10. Apply derives `READY TO APPLY`.
11. Any saved JD, scan, CV or cover-letter change invalidates the old review for readiness.
12. Historical review runs remain available for auditability.
13. CareerOS never submits the application automatically.

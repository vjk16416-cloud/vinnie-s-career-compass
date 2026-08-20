# CareerOS Sprint 6 Automated Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Agent 02 quality gate that reviews the exact current saved JD, role scan, CV version and cover-letter version before explicit user approval can produce `READY TO APPLY`.

**Architecture:** Keep reviewer history inside the existing Supabase-authoritative `CareerOsData` JSON state. Add deterministic signatures for saved JDs and full application packs, add a focused `review.ts` domain module for checks and gate state, and keep the six-stage workspace unchanged by rendering the reviewer in Apply. Existing document generation remains separate from review, and Sprint 6 does not call an external AI provider.

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
- `src/lib/careeros/generate.ts` only if a pure existing health-check helper must be exported for reuse
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
  const oldShape = structuredClone(old) as CareerOsData & {
    reviewRuns?: unknown;
  };
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

- [ ] **Step 3: Add exact types in `types.ts`**

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

Extend the existing interfaces:

```ts
export interface CvDocument {
  // existing fields remain unchanged
  approvedVersionId?: string;
}

export interface ScanResult {
  // existing fields remain unchanged
  jobDescriptionSignature?: string;
}

export interface CareerOsData {
  // existing fields remain unchanged
  reviewRuns: ApplicationReviewRun[];
}
```

- [ ] **Step 4: Seed and normalise**

In `seed.ts` add:

```ts
reviewRuns: [],
```

In `normalise.ts`, keep the existing arrays and replace the CV/scan lines with:

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

Do not infer `approvedVersionId` from historical `status: "Approved"`.

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

- [ ] **Step 1: Write failing tests**

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

In `scoring.ts`, import `textSignature` and add to the returned `ScanResult`:

```ts
jobDescriptionSignature: textSignature(job.description),
```

- [ ] **Step 5: Verify GREEN**

```bash
npm test -- src/lib/careeros/review-signature.test.ts src/lib/careeros/generic-requirements.test.ts
```

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/careeros/review-signature.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/scoring.ts
git commit -m "feat: bind role scans to saved job descriptions"
```

---

### Task 3: Deterministic Agent 02 reviewer

**Files:**
- Create: `src/lib/careeros/review.ts`
- Create: `src/lib/careeros/review.test.ts`
- Modify: `src/lib/careeros/generate.ts` only if `runCvHealthCheck` needs a pure helper exported.

**Produces:** `ReviewPack`, `reviewApplicationPack()`.

- [ ] **Step 1: Create a complete failing fixture**

Use this `Application` object in `review.test.ts`:

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

Use a CV version backed only by `ev-ab`, and a cover letter naming the exact seeded job title/company and referencing only `ev-ab`.

Add the first two tests:

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

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/lib/careeros/review.test.ts
```

- [ ] **Step 3: Implement the public reviewer input**

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
```

Implement findings with exact resolution semantics:

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
```

- [ ] **Step 4: Implement reviewer rules**

Use these deterministic constants:

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

Implement these nine checks:

1. `jd-alignment`: required Evidence Map `Gap`/`Blocked` items are advisory fit findings.
2. `evidence`: every CV/cover-letter evidence ID must resolve to `Verified`; missing/non-Verified evidence is Blocking/Input.
3. `metrics`: currency, percentage and multiplier values must exist in Verified evidence `metricValue` or Approved profile wording; unsupported values are Blocking/Input.
4. `chronology`: if a document line names a known employer and contains a year outside that employment record's approved start/end years, return Blocking/Input.
5. `ats`: reuse `runCvHealthCheck`; missing keywords remain advisory unless another factual check blocks them.
6. `star`: existing weak/vague bullets remain advisory unless another factual check already blocks the claim.
7. `british-english`: em dash or known US spelling is Blocking/Revision.
8. `ai-language-risk`: phrase matches are Advisory only and labelled exactly `AI-like language risk`.
9. `cover-letter`: missing exact company/title, non-Verified evidence, or >650 words is Blocking/Revision or Blocking/Input as appropriate.

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

`reviewApplicationPack()` returns a new immutable `ApplicationReviewRun` and never mutates `pack.data`.

- [ ] **Step 6: Add the remaining unit cases**

```ts
it("returns NEEDS INPUT for an unsupported metric", ...);
it("returns NEEDS INPUT for a chronology conflict", ...);
it("returns NEEDS REVISION for an em dash", ...);
it("returns NEEDS REVISION for known US spelling", ...);
it("keeps unsupported ATS keywords advisory", ...);
it("labels heuristic prose findings as AI-like language risk", ...);
it("blocks non-Verified cover-letter evidence", ...);
it("allows advisory warnings while remaining READY FOR VINNIE APPROVAL", ...);
it("uses NEEDS INPUT before NEEDS REVISION when both exist", ...);
```

Each case uses `makePack()` and changes one input only, except the explicit precedence test, which adds one Input blocker plus one Revision blocker.

- [ ] **Step 7: Verify GREEN**

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/generate.profile.test.ts
```

- [ ] **Step 8: Commit Task 3**

```bash
git add src/lib/careeros/review.ts src/lib/careeros/review.test.ts
git commit -m "feat: add deterministic Agent 02 reviewer"
```

If `generate.ts` changed, add it explicitly before committing.

---

### Task 4: Review currency and derived final gate

**Files:**
- Modify: `src/lib/careeros/review.ts`
- Modify: `src/lib/careeros/review.test.ts`

**Produces:** `scanMatchesSavedJob()`, `currentReviewInputSignature()`, `applicationGateState()`, `approvalEligibility()`.

- [ ] **Step 1: Add failing staleness tests**

Add separate tests for:

```ts
new CV version -> REVIEW OUTDATED
new cover letter -> REVIEW OUTDATED
saved JD change -> REVIEW OUTDATED
new scan -> REVIEW OUTDATED
historical scan without jobDescriptionSignature -> REVIEW OUTDATED
historical review record remains stored but cannot authorise approval
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

- [ ] **Step 4: Implement current pack identity**

`currentReviewInputSignature(context)` returns `null` unless all four conditions hold:

```text
1. signed scan matches saved JD
2. CV exists and has a latest version
3. a latest cover letter exists for the application
4. all IDs needed by ReviewInputIdentity exist
```

Choose the latest cover letter by greatest `createdAt`, never array position.

- [ ] **Step 5: Implement gate precedence**

```ts
NOT REVIEWED
-> REVIEW OUTDATED
-> NEEDS INPUT
-> NEEDS REVISION
-> READY FOR VINNIE APPROVAL
-> READY TO APPLY
```

`READY TO APPLY` requires:

```ts
cv.approvedVersionId === latestCvVersion.id && latestLetter.status === "Approved"
```

Do not use historical CV document `status` as proof of version approval.

- [ ] **Step 6: Implement approval eligibility**

Return `{ allowed: true }` only for `READY FOR VINNIE APPROVAL` and `READY TO APPLY`; otherwise return a concise reason for UI/toast use.

- [ ] **Step 7: Verify GREEN and commit**

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

- [ ] **Step 1: Update the workflow fixture scan to be current**

Import `textSignature` and add to the existing `scan-test` fixture:

```ts
jobDescriptionSignature: textSignature(data.jobs[0]!.description),
```

- [ ] **Step 2: Add failing approval tests**

Add one test asserting `Approve latest CV` and `Approve latest cover letter` are disabled before a passing current review.

Add one test that runs final review and asserts the same buttons become enabled without changing either document to Approved automatically.

- [ ] **Step 3: Verify RED**

```bash
npm test -- src/routes/-application-workflow.test.tsx
```

- [ ] **Step 4: Invalidate CV provenance on regeneration**

Inside existing-CV `generateCv()`:

```ts
existing.status = "Draft";
existing.approvedVersionId = undefined;
```

- [ ] **Step 5: Add `runFinalReview()`**

The handler refuses to run when:

```text
jdDraft !== job.description
scan is absent
scan signature does not match saved JD
latest CV version is absent
latest cover letter is absent
```

On success, call `reviewApplicationPack()` and prepend the run to `draft.reviewRuns`. Add an application history entry `Final review: <OUTCOME>.`.

- [ ] **Step 6: Enforce approval in handlers**

`approveCv()` must set:

```ts
target.status = "Approved";
target.approvedVersionId = latestCvVersion.id;
```

only when `approvalEligibility(...).allowed` is true.

`approveLatestLetter()` may set only the latest reviewed cover-letter record to `Approved`, again only when approval eligibility is true.

Keep the handler guard even when the button is disabled.

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

Use this prop contract:

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

Render:
- `Final review` heading
- gate-state pill
- scan currency
- exact reviewed CV/cover-letter versions
- every review check with Pass/Warning/Fail
- strengths
- high-priority fixes
- grouped finding messages
- `Run final review` or `Re-run final review`
- disabled reason when the current pack cannot be reviewed

Use existing `Panel`, `StatusPill` and Button components only.

- [ ] **Step 4: Add reviewer checkpoint to Application Pack**

Map gate state to user copy:

```text
NOT REVIEWED -> Reviewer: Not reviewed
REVIEW OUTDATED -> Reviewer: Review outdated
NEEDS INPUT -> Reviewer: Needs input
NEEDS REVISION -> Reviewer: Needs revision
READY FOR VINNIE APPROVAL -> Reviewer: Ready for approval
READY TO APPLY -> Reviewer: Ready to apply
```

- [ ] **Step 5: Add stale-input reasons**

Use exact copy:

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
- Modify: `src/lib/careeros/cloud-bootstrap.test.ts` only if the Task 1 historical-state test does not already cover the final shape.

- [ ] **Step 1: Add the full happy-path workflow test**

Test exactly:

```text
open Apply
run final review
assert READY FOR VINNIE APPROVAL
approve latest CV
approve latest cover letter
return to Apply
assert READY TO APPLY
```

Also inspect the repository save mock and assert:

```text
review run references cvv-2 and cl-2
cv.approvedVersionId is cvv-2
cl-2.status is Approved
```

- [ ] **Step 2: Add four invalidation tests**

```ts
it("removes READY TO APPLY after a new CV draft", ...);
it("removes READY TO APPLY after a new cover-letter draft", ...);
it("requires save and re-scan after the JD is edited", ...);
it("marks the old review outdated after a new role scan", ...);
```

Each test starts from a valid passing review with exact document approvals, changes one input, then asserts prior readiness is gone.

- [ ] **Step 3: Add immutable-history test**

Create two review runs with different input signatures and assert both remain present and have distinct IDs.

- [ ] **Step 4: Add historical-CV approval test**

Use:

```ts
cv.status = "Approved";
cv.approvedVersionId = undefined;
```

Assert the gate is not `READY TO APPLY`.

- [ ] **Step 5: Run targeted regression suite**

```bash
npm test -- src/lib/careeros/review.test.ts src/lib/careeros/review-signature.test.ts src/lib/careeros/cloud-bootstrap.test.ts src/routes/-application-workflow.test.tsx
```

Expected: PASS after minimal fixes.

- [ ] **Step 6: Commit Task 7**

Stage only the files that actually changed, then:

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

If Prettier reports Sprint 6 files, run `npx prettier --write` with those exact reported file paths, commit only those formatting changes, then repeat all verification commands.

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

Expected:
- no uncommitted production changes
- no whitespace errors
- only Sprint 6 spec, plan, reviewer/state/scan/UI/test files differ from main
- no SQL migration
- no auth, Drive or unrelated feature changes

- [ ] **Step 7: Spec coverage checklist**

Verify each item directly from code/tests:

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

All five commands must succeed on the exact final head before a PR is opened or completion is claimed.

---

## Execution Order

Run Tasks 1 through 8 in order. Each task must finish its own RED -> GREEN cycle before the next task starts. Do not open a PR before Task 8 passes. Do not merge without explicit user authorisation.

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

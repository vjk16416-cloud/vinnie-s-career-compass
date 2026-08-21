# CareerOS Sprint 6 Automated Reviewer and Approval Gate Design

Date: 2026-08-20
Status: Approved design, pending written-spec review and implementation plan
Branch: `agent/sprint-6-automated-reviewer-design`
Base: `main` at `bdff19dce7a3832a8382ee5cb5056d1439d4c85d`

## 1. Purpose

Sprint 6 turns the existing CV health check and the approved Agent 02 rules into a real application quality gate.

CareerOS already creates evidence-led CVs and cover letters, preserves document versions, and shows an Application Pack checkpoint. It does not yet persist an independent reviewer decision, bind that decision to the exact JD, scan and document versions reviewed, invalidate the review when those inputs change, or prevent approval before final checks pass.

The product principle is trust: CareerOS must never imply that an application is reviewed, approved or ready to apply when the current job description or current document versions have not passed the required checks.

The resulting flow is:

`CV + Cover Letter -> Run final review -> Fix or resolve findings -> Re-run -> READY FOR VINNIE APPROVAL -> explicit user approval -> READY TO APPLY`

Agent 02 remains an independent reviewer. It can recommend changes and block unsafe approval, but it cannot mark an artifact `Approved` on the user's behalf.

## 2. Design source and rules

The implementation must follow the approved Career OS Agent 02 and AI Reviewer Instructions already maintained in Google Drive.

Core rules brought into the application are:

- use approved Career OS profile data and Verified evidence as the factual authority;
- never invent responsibilities, achievements, metrics, dates, tools, qualifications, budgets, stakeholders, management responsibility or commercial impact;
- keep founder, academic and commercial work correctly distinguished;
- use JD terminology only where supported by evidence;
- flag missing evidence rather than strengthening a claim through assumption;
- review ATS alignment separately from actual experience fit;
- use British English and natural, direct wording;
- avoid em dashes, inflated language, repetitive phrasing and obvious AI-style patterns;
- check STAR strength without mechanically forcing every bullet into the same formula;
- preserve the existing user approval boundary.

## 3. Scope

### In scope

- A persisted application review-run model.
- A deterministic reviewer that reuses and extends the existing CV health-check logic.
- Review of one complete current application pack: saved JD, current role scan, latest CV version and latest cover letter.
- A scan-to-JD signature so an old match analysis cannot be treated as current after the JD changes.
- Checks for JD alignment, evidence safety, metrics, chronology, ATS coverage, bullet strength, British English, AI-like language risk and cover-letter quality.
- Explicit blocking versus advisory findings.
- Reviewer outcomes: `NEEDS INPUT`, `NEEDS REVISION`, `READY FOR VINNIE APPROVAL`.
- A stale-review rule tied to the exact reviewed inputs.
- A final review panel inside the existing Apply stage rather than adding another workflow tab.
- Approval enforcement so the current CV and cover letter cannot be approved until their exact reviewed pack is `READY FOR VINNIE APPROVAL`.
- Version-specific CV approval provenance.
- `READY TO APPLY` only when the current review is valid and the exact reviewed CV and cover letter have then been explicitly approved by the user.
- Backward-compatible state normalisation and persistence through the existing Supabase CareerOS state document.
- Unit, workflow and regression tests.

### Out of scope

- Calling Claude, OpenAI or another external model during the reviewer pass.
- Claiming that heuristic language checks can determine whether text was written by AI.
- Automatic job submission.
- Automatic approval.
- Silent rewriting of approved or reviewed artifacts.
- Fabricating missing evidence or metrics to improve a score.
- Replacing the existing Job Scan or Evidence Map.
- Rebuilding the six-stage application workspace.
- A new Supabase SQL table or relational migration solely for review runs.
- Google Drive archival or synchronisation of final application documents. That remains a later handoff.

## 4. Architectural choice

### Recommended approach: deterministic reviewer first

Sprint 6 will use deterministic, testable CareerOS rules as the authoritative gate.

The current `runCvHealthCheck` already measures ATS coverage, responsibility coverage, evidence usage, unsupported claims, weak bullets and formatting. Sprint 6 should extract or compose those checks into a dedicated reviewer module instead of continuing to grow UI-specific health-check code.

Recommended boundary:

- `generate.ts` remains responsible for document generation and may continue exposing the existing health-check compatibility API during migration;
- a new focused reviewer module, for example `review.ts`, owns application-pack review logic, staleness and outcome calculation;
- the route calls the reviewer and persists immutable review-run records;
- UI components render the latest review but do not decide whether it passed.

This gives CareerOS a deterministic baseline that can later be supplemented by a second AI reviewer without making external model output the source of truth for factual approval.

### Rejected alternative: AI reviewer immediately

An external model could provide more nuanced prose feedback, but it would add provider configuration, cost, network failure handling, prompt-version management and probabilistic output before the core approval state machine is trustworthy.

### Rejected alternative: AI-only gate

A probabilistic model must not be the only authority deciding whether evidence is supported or whether an application can be approved.

## 5. Review and scan data model

Add a persisted review-run collection to `CareerOsData`, normalised to an empty array for existing stored state.

New scans must also record the signature of the saved JD they analysed.

Equivalent types:

```ts
export type ReviewOutcome =
  | "NEEDS INPUT"
  | "NEEDS REVISION"
  | "READY FOR VINNIE APPROVAL";

export type ReviewCheckStatus = "Pass" | "Warning" | "Fail";
export type ReviewFindingSeverity = "Blocking" | "Advisory";

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
```

`ScanResult` gains an optional compatibility field such as:

```ts
jobDescriptionSignature?: string;
```

New scans always populate it. Existing scans without it load safely but are treated as requiring one fresh scan before Sprint 6 final review can pass.

Exact property names may vary during implementation, but the semantics must remain explicit.

Review runs are immutable history. Re-running review creates a new record rather than overwriting the previous result.

## 6. Saved-JD and current-scan contract

Final review operates on the persisted `JobRecord.description`, not an unsaved textarea draft.

Before review can run:

1. the JD must be saved;
2. a current scan must exist;
3. the scan's `jobDescriptionSignature` must match the signature of the saved JD;
4. a latest CV version must exist;
5. a latest cover letter must exist.

If the user edits the JD after the scan, the old scan becomes stale for final-review purposes. CareerOS asks the user to save the JD and re-run the role scan before final review.

The review route must not silently scan an unsaved JD as part of approval. Job analysis stays an explicit stage in the workflow.

## 7. Exact-input binding and stale-review rule

A review is valid only for the exact input pack that was reviewed.

The input signature must incorporate at least:

- application ID;
- job ID and saved job-description content or its stable signature;
- current scan ID and scan JD signature;
- CV document ID and exact latest CV version ID;
- exact latest cover-letter ID.

The signature is for stale detection, not authentication or security. A deterministic digest or equivalent stable signature is sufficient.

A review becomes stale when any review-defining input changes, including:

- the saved JD changes;
- a new role scan replaces the previous scan;
- a new CV version is generated;
- a new cover-letter version is generated;
- either reviewed artifact is removed or no longer the current version.

A stale review remains in history but cannot authorise approval or produce `READY TO APPLY`.

## 8. Version-specific approval provenance

Cover letters are already stored as individual immutable records, so their existing `status` is tied to a specific version record.

CV approval is currently stored only at the `CvDocument.status` level. Sprint 6 must add version-specific provenance, for example:

```ts
approvedVersionId?: string;
```

Rules:

- approving a CV sets `status = "Approved"` and `approvedVersionId` to the exact latest reviewed version ID;
- generating a new CV version sets the document back to `Draft` and clears `approvedVersionId`;
- an older approved version may remain historically identifiable, but it cannot make a newer draft appear approved;
- the final gate compares `approvedVersionId` with the CV version ID on the current valid review.

This removes ambiguity without redesigning the full CV document model.

## 9. Required reviewer checks

The initial deterministic reviewer contains the following checks.

### 9.1 JD and requirement alignment

Use the current scan and Evidence Map to determine whether key required requirements are represented honestly in the application materials.

A missing keyword with no verified evidence is not automatically a failure. The reviewer must not recommend keyword stuffing. Unsupported required claims remain gaps.

### 9.2 Evidence and unsupported claims

Blocking failure when the CV or cover letter contains a claim tied to non-Verified evidence, a blocked profile item, a conflict item, or another known unsupported source.

Where a claim cannot be safely resolved from existing CareerOS evidence, the outcome must favour `NEEDS INPUT`.

### 9.3 Metrics credibility

Flag metrics that appear in the artifact without a Verified evidence record or approved profile basis.

A metric explicitly marked disputed, unconfirmed, Needs Evidence or otherwise unresolved is blocking.

Do not add metrics merely to reach a target percentage.

### 9.4 Chronology and factual consistency

Check visible employment, education and certification dates against approved CareerOS profile items where deterministic comparison is possible.

A clear contradiction is blocking. Inability to establish a fact from current data is `NEEDS INPUT`, not an invented correction.

### 9.5 ATS and terminology

Reuse the existing token and coverage logic where appropriate.

ATS gaps are generally advisory unless a must-have requirement is represented misleadingly or the document structure breaks the approved ATS-safe format.

### 9.6 STAR and bullet strength

Flag vague, very short, passive or outcome-free bullets as quality findings.

This check is advisory by default. It becomes blocking only when the wording creates a material credibility or clarity problem.

### 9.7 British English and house style

Check known US spellings, prohibited em dashes, excessive decorative formatting and existing CV layout rules.

Clear style-rule violations are revision blockers where they affect the exported artifact.

### 9.8 AI-like language risk

Use heuristic phrase and structure checks only.

The UI must call this `AI-like language risk` or equivalent, never an AI detector result. It may flag inflated phrasing, generic motivation, repetitive sentence structures, buzzword stacking and other house-style violations.

This is primarily advisory unless the language is materially misleading or unusable.

### 9.9 Cover-letter quality

Check that the cover letter:

- names the correct role and company;
- uses only supported evidence;
- focuses on two or three relevant themes rather than repeating the CV;
- avoids generic enthusiasm and invented company knowledge;
- uses JD terminology only where accurate;
- remains concise and natural.

Evidence failures are blocking. Pure quality improvements are normally advisory or revision-level depending on severity.

## 10. Outcome calculation

Outcome is calculated by code, not by the UI.

### `NEEDS INPUT`

Use when at least one blocking issue cannot be safely resolved from the current CareerOS evidence, for example an unsupported metric, contradictory chronology, missing factual source or evidence ambiguity.

### `NEEDS REVISION`

Use when there is no unresolved evidence-input blocker, but at least one blocking document-quality or rule-compliance failure remains.

### `READY FOR VINNIE APPROVAL`

Use only when all blocking checks pass for the exact current input signature.

Advisory warnings may remain visible, but they must be clearly distinguished from blocking failures.

Agent 02 still does not approve either document.

## 11. Final application gate

The application-level gate is derived rather than manually set.

Equivalent states:

- `NOT REVIEWED`
- `REVIEW OUTDATED`
- `NEEDS INPUT`
- `NEEDS REVISION`
- `READY FOR VINNIE APPROVAL`
- `READY TO APPLY`

`READY TO APPLY` requires all of the following at the same time:

1. the saved JD has a current scan;
2. the latest review is valid for the current input signature;
3. the review outcome is `READY FOR VINNIE APPROVAL`;
4. the exact reviewed CV version has been explicitly approved by the user;
5. the exact reviewed cover letter has been explicitly approved by the user.

No generated document, reviewer function or background process may set `READY TO APPLY` directly.

## 12. Approval enforcement

Existing direct approval actions must respect the final gate.

UI disablement alone is insufficient. The underlying approval handlers must also reject approval unless a current review exists with outcome `READY FOR VINNIE APPROVAL` for the exact artifact pack.

After a successful reviewer pass, the user can explicitly approve the current CV and cover letter. The UI should make it clear which exact versions are being approved.

If the JD, scan, CV or cover letter changes afterwards, the review becomes outdated and the application leaves `READY TO APPLY` until the new pack is reviewed and approved.

## 13. UI and workflow

Keep the existing six-stage workspace:

`Job -> Match -> Evidence -> CV -> Cover Letter -> Apply`

Do not add a Review tab.

Extend the current Apply view with a `Final review` panel beneath or alongside the Application Pack checkpoint.

The panel should show:

- current review state;
- exact CV and cover-letter versions reviewed;
- current scan state;
- reviewer outcome;
- pass, warning and fail status for each check;
- what is already strong;
- high-priority fixes;
- evidence or credibility risks;
- ATS or JD-alignment gaps;
- a `Run final review` or `Re-run final review` action;
- explicit stale-review messaging when inputs have changed.

The Application Pack should show the reviewer gate as an additional readiness line. It must not call the pack ready merely because Job, Match, Evidence, CV and Cover Letter exist.

Approval buttons in CV and Cover Letter remain visible for continuity, but before a valid reviewer pass they are disabled with a concise explanation. Handler-level enforcement remains mandatory.

## 14. Fix workflow

Sprint 6 does not silently rewrite a reviewed artifact.

Reviewer findings are guidance. The user can edit inputs, resolve evidence or create a new draft through the existing explicit generation flow, then re-run the reviewer.

Any future automatic fixer must create a new CV version or new cover-letter record. It must never mutate an approved or previously reviewed version in place.

This preserves auditability and keeps the Sprint 6 scope focused on the quality gate.

## 15. Persistence and migration

Review runs, scan JD signatures and CV approval provenance live inside the existing `CareerOsData` state and therefore use the current Supabase-authoritative state repository.

No new Supabase SQL table is required for Sprint 6.

The normalisation layer must:

- default missing review-run collections to `[]`;
- tolerate historical scans without `jobDescriptionSignature` and require a fresh scan before final review;
- tolerate older CV documents without `approvedVersionId`;
- avoid treating historical document-level `Approved` status as proof that a current CV version passed Sprint 6 review;
- preserve existing application, CV, cover-letter, scan and activity history.

A reviewer run should be logged in application/activity history with its outcome, but the structured review record remains the authoritative source for gate calculation.

## 16. Error handling

The reviewer must fail closed for approval.

If review cannot run because the saved Job, current scan, CV or cover letter is missing, the UI explains what is missing and does not create a passing result.

If the scan signature does not match the saved JD, the UI requires a fresh role scan before review.

If the route contains unsaved JD changes, the UI requires the user to save and re-scan rather than reviewing a hidden or transient version.

If stored review data is malformed or references missing artifact IDs, treat it as outdated or invalid rather than ready.

A reviewer exception must not change existing document approval state.

## 17. Testing strategy

Implementation follows TDD.

### Unit tests

Cover at least:

- current pack with verified evidence can reach `READY FOR VINNIE APPROVAL`;
- unverified or blocked evidence produces a blocking result;
- disputed or unsupported metrics cannot pass;
- clear chronology conflicts cannot pass;
- prohibited em dashes and known US spellings are detected;
- ATS gaps without supporting evidence do not cause keyword stuffing;
- AI-like language checks are labelled as risk, not proof of AI authorship;
- cover-letter evidence failures block the pack;
- advisory warnings do not automatically become blocking failures;
- outcome precedence is `NEEDS INPUT` before `NEEDS REVISION` before ready.

### Scan currency tests

Cover at least:

- a new scan stores the current saved JD signature;
- a JD change makes the previous scan stale for final review;
- an historical scan without a JD signature requires one fresh scan;
- unsaved JD edits cannot be silently reviewed.

### Review staleness tests

Cover at least:

- new CV version invalidates previous review;
- new cover letter invalidates previous review;
- saved JD change invalidates previous review;
- re-running the scan invalidates previous review;
- historical review remains stored but cannot authorise approval.

### Approval-gate tests

Cover at least:

- approval is rejected before a current passing review;
- exact reviewed CV version can be explicitly approved after a passing review;
- exact reviewed cover letter can be explicitly approved after a passing review;
- `READY TO APPLY` appears only after both exact artifacts are approved;
- a new draft removes `READY TO APPLY` until re-reviewed and re-approved.

### Backward-compatibility tests

Cover at least:

- older stored CareerOS state without review runs loads safely;
- older scans without JD signatures load safely and are treated as needing refresh;
- older CVs without `approvedVersionId` load safely;
- no existing job, evidence, scan, CV version, cover letter or application history is dropped.

### Workflow and build verification

Run the repository's full unit/workflow suite, formatting/lint checks and production build. Existing P0 trust verification must remain green.

## 18. Likely implementation surface

Expected files include, subject to the implementation plan:

- `src/lib/careeros/types.ts`
- new `src/lib/careeros/review.ts`
- reviewer unit tests
- `src/lib/careeros/scoring.ts` for scan JD signatures if that remains the scan boundary
- `src/lib/careeros/foundation.ts` or the current state-normalisation boundary
- `src/routes/applications.$id.tsx`
- a focused final-review component under `src/components/careeros/`
- workflow/regression tests

`generate.ts` may be refactored only enough to reuse existing health-check logic cleanly. Generation behaviour should not be broadly rewritten in this sprint.

## 19. Release and rollout

Sprint 6 should ship through the existing feature-branch and PR workflow.

Before merge:

1. demonstrate TDD red and green evidence for the new approval contracts;
2. run the full repository verification suite on the exact branch head;
3. verify the diff does not weaken evidence gating or Supabase trust behaviour;
4. confirm no external AI provider dependency was introduced;
5. confirm review state survives the existing CareerOS persistence flow.

After merge, staging deployment and end-to-end application testing are separate verification steps. A successful GitHub merge alone must not be reported as a successful Cloudflare deployment.

## 20. Acceptance criteria

Sprint 6 is implementation-complete only when all of the following are true:

- CareerOS can run and persist an Agent 02 review against the exact current application pack.
- Final review requires a saved JD and a current scan of that exact JD.
- New scans store a stable signature of the saved JD they analysed.
- The reviewer checks both the latest CV version and latest cover letter.
- Evidence, metrics, chronology, ATS, STAR/bullet quality, British English, AI-like language risk and cover-letter quality are represented in the review.
- Blocking and advisory findings are visibly distinct.
- Review outcome is derived deterministically.
- Changing the JD, scan, CV version or cover letter invalidates the prior review for approval purposes.
- The exact reviewed CV version and cover letter cannot be approved before a current `READY FOR VINNIE APPROVAL` result.
- Agent 02 never approves a document itself.
- `READY TO APPLY` requires a current scan, a current passing review and explicit user approval of both exact reviewed artifacts.
- Existing CareerOS state loads without data loss.
- No new Supabase SQL migration is required solely for reviewer state.
- Existing evidence trust rules remain intact.
- Full tests, lint/formatting and production build pass on the exact implementation head before merge.

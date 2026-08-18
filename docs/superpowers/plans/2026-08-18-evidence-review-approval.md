# Evidence Review & Approval Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make unresolved CareerOS profile claims actionable so the user can approve, defer, exclude, or resolve conflicting variants and have that decision immediately control generated CV and cover-letter content.

**Architecture:** Add a small pure decision layer that mutates `CareerProfileItem` and `CareerClaimVariant` state and records a provenance-rich decision log. Persist the log in `CareerOsData`, expose store actions for the UI, and keep generation dependent on the existing approved-profile selector so decisions automatically change downstream output.

**Tech Stack:** TypeScript, React, TanStack Start, Vitest, localStorage-backed CareerOS store, GitHub Actions.

**Spec:** PR #10 master-profile extraction/reconciliation layer and the agreed next step in CareerOS: user-controlled evidence review and approval.

## Global Constraints

- Existing source provenance must never be removed when a claim is approved or excluded.
- A decision must be persisted in the same CareerOS data object that localStorage already stores.
- Conflict resolution must approve exactly one selected variant for a canonical key and keep the other variants non-approved.
- Resolved variants must become available to the same approved-profile selector used by CV and cover-letter generation.
- Unsafe or unresolved wording must not become generator-eligible without an explicit user decision.
- Existing user-edited profile data must survive `withMasterProfileFoundation()` migrations.
- Use British English in user-facing copy.

---

### Task 1: Decision model and pure resolution functions

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Create: `src/lib/careeros/profile-review.ts`
- Test: `src/lib/careeros/profile-review.test.ts`

**Interfaces:**
- Produces: `CareerProfileDecision`, `setProfileItemDecision(data, input)`, `resolveClaimVariant(data, input)`.
- Consumes: existing `CareerProfileItem`, `CareerClaimVariant`, and `CareerOsData`.

- [ ] **Step 1: Write the failing test**

Test that approving a `Needs Evidence` profile item changes it to `Approved`, records a decision with the original and new status plus source IDs, and that resolving one conflict variant approves only the selected variant while creating/updating a generator-eligible profile item for the canonical key.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `bun run test -- src/lib/careeros/profile-review.test.ts`
Expected: FAIL because `profile-review.ts` and `CareerProfileDecision` do not exist.

- [ ] **Step 3: Implement the minimal decision layer**

Add decision records with timestamp, action, target identifiers, before/after status, selected variant where relevant, source IDs, and optional note. Resolution should create a deterministic profile item ID `resolved-<canonicalKey>` so repeated decisions update the same reconciled item rather than duplicating it.

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run: `bun run test -- src/lib/careeros/profile-review.test.ts`
Expected: PASS.

### Task 2: Persist decisions and preserve migrations

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Modify: `src/lib/careeros/profile-data.ts`
- Test: `src/lib/careeros/profile-review.test.ts`

**Interfaces:**
- Produces: optional `profileDecisions` in `CareerOsData`, defaulting to an empty array while preserving stored decisions.

- [ ] **Step 1: Add a failing migration test**

Create stored data with a prior decision, run it through `withMasterProfileFoundation()`, and assert the decision is preserved unchanged.

- [ ] **Step 2: Verify RED**

Run the targeted review test and confirm the migration assertion fails before implementation.

- [ ] **Step 3: Implement decision persistence**

Add `profileDecisions` to the returned master-profile data and preserve stored entries exactly.

- [ ] **Step 4: Verify GREEN**

Run the targeted review test and confirm all decision and migration tests pass.

### Task 3: Store actions and Career Profile review UI

**Files:**
- Modify: `src/lib/careeros/store.tsx`
- Modify: `src/routes/profile.tsx`
- Test: `src/lib/careeros/profile-review.test.ts`

**Interfaces:**
- Produces store actions `setProfileItemStatus` and `resolveProfileVariant`.
- UI consumes unresolved profile items and variant groups and exposes Approve, Needs evidence, Exclude, and Resolve actions.

- [ ] **Step 1: Add failing action assertions**

Verify the pure decision functions add a profile version entry and activity-safe decision summary that the store can expose after a decision.

- [ ] **Step 2: Verify RED**

Run the targeted review test and confirm the new history expectations fail.

- [ ] **Step 3: Implement store actions and UI**

Wire buttons to the pure decision functions. Show source IDs and confidence beside each item/variant. Add a compact Decision history panel showing newest decisions first. Use explicit action labels rather than ambiguous toggles.

- [ ] **Step 4: Verify GREEN**

Run targeted tests, then `bun run lint`.

### Task 4: Generator and regression verification

**Files:**
- Modify only if tests expose a defect: `src/lib/careeros/generate.ts`
- Test: `src/lib/careeros/generate.profile.test.ts`
- Test: `src/lib/careeros/profile-review.test.ts`

**Interfaces:**
- Consumes the existing approved-profile selector after review decisions.

- [ ] **Step 1: Add a generator regression test**

Resolve a formerly blocked variant, generate a CV/cover letter, and assert the resolved safe wording becomes eligible while an unselected conflicting variant remains absent.

- [ ] **Step 2: Verify RED if generation does not already consume the updated approved set**

Run the targeted generator and review tests.

- [ ] **Step 3: Make the smallest production change required**

Only modify generation if the regression test proves the approved selector is not sufficient.

- [ ] **Step 4: Full verification**

Run `bun run test && bun run lint && bun run build`. GitHub Actions must complete successfully with zero lint errors before the PR is marked ready.

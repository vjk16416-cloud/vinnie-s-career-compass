# Full Resume Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the PR 1 source register into a source-aware extraction and reconciliation layer that records what has actually been extracted, preserves conflicting variants, and prevents unresolved claims from leaking into generated CVs and cover letters.

**Architecture:** Keep the existing `CareerProfileItem` as the reconciled output layer. Add a lower-level `CareerClaimVariant` collection for extracted or audit-derived variants, plus explicit extraction status on each source. A selector exposes only approved reconciled profile items to generation. Missing raw files remain visible as missing rather than being silently treated as fully extracted.

**Tech Stack:** TypeScript, React, TanStack Start, Vitest, ESLint/Prettier, GitHub Actions.

**Spec:** PR 1 master-profile foundation plus `Vinnie CV Evidence Audit`, 23 July 2026.

## Global Constraints

- Preserve provenance for every imported claim.
- Do not promote audit summaries to raw-source extraction when the underlying file is unavailable.
- Excluded/unsafe sources must never produce usable generated claims.
- Conflicting metrics and qualifications stay blocked until explicitly resolved.
- Generated CV and cover-letter content must consume only approved profile items and verified evidence.
- Use British English in user-facing career copy.

---

### Task 1: Extraction and claim-variant model

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Create: `src/lib/careeros/profile-extraction.ts`
- Test: `src/lib/careeros/profile-extraction.test.ts`

**Interfaces:**
- Produces: `CareerClaimVariant`, source extraction status fields, `PROFILE_CLAIM_VARIANTS`, `approvedProfileItems(data)` and extraction coverage helpers.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createCareerOsData } from "./profile-data";
import { approvedProfileItems, PROFILE_CLAIM_VARIANTS } from "./profile-extraction";

describe("master-profile extraction", () => {
  it("keeps unresolved historical variants out of approved output", () => {
    const data = createCareerOsData();
    expect(PROFILE_CLAIM_VARIANTS.some((v) => v.canonicalKey === "nas-donor-base" && v.status === "Conflict")).toBe(true);
    expect(approvedProfileItems(data).some((item) => item.id === "pi-team-management")).toBe(false);
    expect(approvedProfileItems(data).some((item) => item.id === "pi-google-pm-certificate")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/careeros/profile-extraction.test.ts`
Expected: FAIL because `profile-extraction` does not exist.

- [ ] **Step 3: Write minimal implementation**

Add explicit source extraction state and a claim-variant record with `canonicalKey`, `value`, `sourceIds`, `basis`, `status`, `confidence` and notes. Seed the conflicts explicitly identified in the evidence audit.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/careeros/profile-extraction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/types.ts src/lib/careeros/profile-extraction.ts src/lib/careeros/profile-extraction.test.ts
git commit -m "Add resume extraction and reconciliation model"
```

### Task 2: Seed extraction coverage without pretending missing files were read

**Files:**
- Modify: `src/lib/careeros/profile-foundation.ts`
- Modify: `src/lib/careeros/profile-data.ts`
- Test: `src/lib/careeros/profile-extraction.test.ts`

**Interfaces:**
- Consumes: source extraction state and claim variants from Task 1.
- Produces: seeded source coverage and persisted `profileClaimVariants`.

- [ ] **Step 1: Extend the failing test**

```ts
it("distinguishes imported raw sources from audit-only indexed sources", () => {
  const data = createCareerOsData();
  const m01 = data.profileSources?.find((source) => source.auditId === "M01");
  const d20 = data.profileSources?.find((source) => source.auditId === "D20");
  expect(m01?.extractionStatus).toBe("Reconciled");
  expect(d20?.extractionStatus).toBe("Audit only");
});
```

- [ ] **Step 2: Run the targeted test and confirm failure**

Run: `bun run test -- src/lib/careeros/profile-extraction.test.ts`
Expected: FAIL because the extraction states are not seeded.

- [ ] **Step 3: Implement coverage seeding**

Mark the current master CV and evidence/user-confirmation sources as reconciled; mark historical CVs represented only through the audit as `Audit only`; preserve M06 as excluded. Persist seeded claim variants without overwriting future stored edits.

- [ ] **Step 4: Run the targeted test**

Run: `bun run test -- src/lib/careeros/profile-extraction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/profile-foundation.ts src/lib/careeros/profile-data.ts src/lib/careeros/profile-extraction.test.ts
git commit -m "Track source extraction coverage"
```

### Task 3: Block unresolved master-profile claims in generators

**Files:**
- Modify: `src/lib/careeros/generate.ts`
- Create: `src/lib/careeros/generate.profile.test.ts`

**Interfaces:**
- Consumes: `approvedProfileItems(data)`.
- Produces: CV and cover-letter generation that cannot print unresolved certification or people-management claims from the base profile.

- [ ] **Step 1: Write the failing generator test**

Create a test dataset whose base `profile.certifications` contains the unresolved full Google certificate and assert that generated output omits it while retaining an approved certification/profile item.

- [ ] **Step 2: Run the generator test and confirm failure**

Run: `bun run test -- src/lib/careeros/generate.profile.test.ts`
Expected: FAIL because generation currently renders every base certification and project entry.

- [ ] **Step 3: Implement approved-profile filtering**

Build approved certification/project/employment wording from `CareerProfileItem` where available and use legacy profile arrays only as a fallback for categories not represented in the master-profile approval layer.

- [ ] **Step 4: Run targeted tests**

Run: `bun run test -- src/lib/careeros/generate.profile.test.ts src/lib/careeros/profile-extraction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/generate.ts src/lib/careeros/generate.profile.test.ts
git commit -m "Gate generated career claims by approval status"
```

### Task 4: Surface extraction coverage and conflicts in the Profile UI

**Files:**
- Modify: `src/routes/profile.tsx`
- Test: `src/lib/careeros/profile-extraction.test.ts`

**Interfaces:**
- Consumes: extraction coverage helpers and claim variants.
- Produces: visible counts for reconciled, audit-only, missing/raw-needed and excluded sources, plus unresolved variant groups.

- [ ] **Step 1: Add helper assertions**

Assert coverage totals and that known conflict keys include `idea-delivery-improvement`, `buchanan-time-to-fill`, `nas-donor-base`, `infinite-ticket-uplift` and `google-project-management-certificate`.

- [ ] **Step 2: Run the targeted test and confirm failure**

Run: `bun run test -- src/lib/careeros/profile-extraction.test.ts`
Expected: FAIL until helpers are complete.

- [ ] **Step 3: Implement UI**

Add an Extraction coverage panel and a Conflicting variants list with source IDs and evidence notes. Do not display audit-only items as if raw files were read.

- [ ] **Step 4: Run tests, lint and build**

Run: `bun run test && bun run lint && bun run build`
Expected: all tests pass, lint has no errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/routes/profile.tsx src/lib/careeros/profile-extraction.test.ts
git commit -m "Show resume extraction coverage and conflicts"
```

### Task 5: PR verification

**Files:**
- No production-file changes unless verification finds a PR-caused defect.

- [ ] **Step 1: Run full GitHub Actions verification**

Expected: tests pass, lint has no errors, production build succeeds.

- [ ] **Step 2: Check the PR diff against `main`**

Expected: only extraction/reconciliation, generator gating, UI coverage and tests/planning changes.

- [ ] **Step 3: Keep the PR draft if raw-source coverage is incomplete**

The PR description must explicitly distinguish `Audit only` from raw-file extraction and list the exact remaining source-file gap.

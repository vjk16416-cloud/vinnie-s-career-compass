# Evidence-First CV Tailoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a vacancy-specific CV proposal that selects JD-relevant canonical evidence, preserves chronology, exposes provenance for review, and remains a draft until explicit approval.

**Architecture:** Extend the existing `src/lib/careeros/resume` subsystem rather than creating a parallel generator. Canonical Supabase Knowledge Bank and employment repositories remain the factual source; a deterministic evidence ranker and master-category selector feed a structured proposal builder, which the existing application workspace renders for review before approval.

**Tech Stack:** TypeScript, React, TanStack Router, Vitest, Supabase, existing CareerOS repositories and local application/CV version store.

**Spec:** `docs/superpowers/specs/2026-08-21-evidence-first-cv-tailoring-design.md`

## Global Constraints
- Only `verified` and `user_confirmed` Knowledge Bank records may become factual generated CV claims.
- `imported_cv`, `imported_linkedin`, and `needs_verification` are context-only and must not be emitted as factual CV claims.
- `archived` and `excluded` evidence is blocked.
- Preserve canonical employer names, role titles and dates.
- Generated CVs remain `Draft` until explicit user approval.
- British English and existing ATS-safe format rules remain mandatory.
- Every generated material role bullet must retain at least one Knowledge Bank evidence ID.

---

### Task 1: Lock the Evidence Eligibility Policy

**Files:**
- Modify: `src/lib/careeros/resume/evidence-selector.ts`
- Modify: `src/lib/careeros/resume/role-bullet-policy.test.ts`

**Interfaces:**
- Consumes: `KnowledgeItem[]`, `employmentRoleId: string`
- Produces: `selectRoleEvidence(items, employmentRoleId): RoleEvidenceSelection`

- [ ] **Step 1: Write a failing test proving imported evidence is context-only**

Add a case that creates one `verified`, one `user_confirmed`, one `imported_cv`, one `needs_verification`, and one `excluded` item for the same role. Assert `supported` contains only the first two, strengthening/context contains imported and needs-verification records, and blocked contains excluded.

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/lib/careeros/resume/role-bullet-policy.test.ts`
Expected: FAIL because `imported_cv` is currently included in `SUPPORTED_STATUSES`.

- [ ] **Step 3: Implement the policy**

Change `SUPPORTED_STATUSES` to:

```ts
const SUPPORTED_STATUSES = new Set<KnowledgeItem["status"]>([
  "verified",
  "user_confirmed",
]);
```

Treat `imported_cv`, `imported_linkedin`, and `needs_verification` as non-emittable context/strengthening records with a reason that reflects their status.

- [ ] **Step 4: Run the focused test again**

Run: `pnpm vitest run src/lib/careeros/resume/role-bullet-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/resume/evidence-selector.ts src/lib/careeros/resume/role-bullet-policy.test.ts
git commit -m "fix: enforce CV evidence eligibility policy"
```

### Task 2: Rank Eligible Evidence Against the JD

**Files:**
- Create: `src/lib/careeros/resume/evidence-ranker.ts`
- Create: `src/lib/careeros/resume/evidence-ranker.test.ts`

**Interfaces:**
- Consumes: `items: KnowledgeItem[]`, `jobText: string`
- Produces: `rankEvidenceForJob(items, jobText): RankedEvidence[]`

Define:

```ts
export interface RankedEvidence {
  item: KnowledgeItem;
  relevance: number;
  matchedTerms: string[];
}
```

- [ ] **Step 1: Write failing relevance tests**

Use a Product Manager JD containing `product`, `roadmap`, `customer`, `stakeholder`, and `delivery`. Assert an eligible product/project record ranks above an eligible unrelated paid-search record. Assert excluded and needs-verification records are absent.

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run src/lib/careeros/resume/evidence-ranker.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic ranking**

Tokenise lower-cased title, content, STAR fields and JD text. Score exact meaningful term overlap, with small boosts for `project`, `achievement`, `star_story`, and `metric` categories. Do not use status as a relevance boost beyond the eligibility gate.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/careeros/resume/evidence-ranker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/resume/evidence-ranker.ts src/lib/careeros/resume/evidence-ranker.test.ts
git commit -m "feat: rank CV evidence against job descriptions"
```

### Task 3: Select the Best Master CV Family

**Files:**
- Create: `src/lib/careeros/resume/master-selector.ts`
- Create: `src/lib/careeros/resume/master-selector.test.ts`

**Interfaces:**
- Consumes: `job: JobRecord`
- Produces: `selectMasterCvFamily(job): "Product / Product Management" | "Project / PMO / Delivery" | string`

- [ ] **Step 1: Write failing selection tests**

Assert `Associate Product Manager` with roadmap/customer/product language selects `Product / Product Management`. Assert `PMO Analyst` with governance, RAID, reporting and project language selects `Project / PMO / Delivery`.

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run src/lib/careeros/resume/master-selector.test.ts`
Expected: FAIL because the selector does not exist.

- [ ] **Step 3: Implement deterministic family selection**

Use title and JD keyword weights. Fall back to the existing `suggestCvCategory(job)` output when neither family reaches a clear threshold.

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run src/lib/careeros/resume/master-selector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/resume/master-selector.ts src/lib/careeros/resume/master-selector.test.ts
git commit -m "feat: select master CV family from vacancy"
```

### Task 4: Build a Structured Tailoring Proposal

**Files:**
- Modify: `src/lib/careeros/resume/tailored-cv.ts`
- Modify: `src/lib/careeros/resume/generate-workflow.test.ts`

**Interfaces:**
- Consumes: canonical knowledge/employment context plus `CareerOsData`, `JobRecord`, optional `ScanResult`
- Produces: extend `TailoredCvBuildResult` with `masterFamily` and `claims`

Define:

```ts
export interface TailoredCvClaim {
  id: string;
  section: "summary" | "skill" | "experience" | "project";
  profileRoleId: string | null;
  original: string | null;
  proposed: string;
  evidenceIds: string[];
}
```

- [ ] **Step 1: Write failing proposal tests**

Assert every experience claim has at least one eligible evidence ID, excluded/context-only IDs never appear, employment chronology is unchanged, and a Product vacancy returns the Product master family.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm vitest run src/lib/careeros/resume/generate-workflow.test.ts`
Expected: FAIL because structured claims/master family are not returned.

- [ ] **Step 3: Implement proposal construction**

Use `rankEvidenceForJob` to order eligible evidence within each canonical role. Build 3–5 bullets where possible, retain gaps when evidence is insufficient, construct summary/skills/projects from canonical profile plus relevant eligible evidence, and render `body` from the structured claims for backward compatibility.

- [ ] **Step 4: Run resume subsystem tests**

Run: `pnpm vitest run src/lib/careeros/resume`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careeros/resume/tailored-cv.ts src/lib/careeros/resume/generate-workflow.test.ts
git commit -m "feat: build evidence-traceable CV proposals"
```

### Task 5: Add Review Provenance to the Application Workspace

**Files:**
- Create: `src/components/careeros/tailored-cv-review.tsx`
- Create: `src/components/careeros/tailored-cv-review.test.tsx`
- Modify: `src/routes/applications.$id.tsx`

**Interfaces:**
- Consumes: `TailoredCvClaim[]` plus Knowledge Bank item lookup
- Produces: review UI showing Original, Proposed, Evidence and an explicit approval action

- [ ] **Step 1: Write the failing component test**

Render one experience claim and assert the screen shows `Original`, `Proposed`, `Evidence`, the proposed wording and the supporting evidence title. Assert it does not display an Approved state by default.

- [ ] **Step 2: Run the test**

Run: `pnpm vitest run src/components/careeros/tailored-cv-review.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the review component**

Use existing CareerOS `Panel`, `StatusPill`, and `Button` components. Keep the presentation accessible and responsive. Evidence references must display human-readable evidence titles/statuses, not only UUIDs.

- [ ] **Step 4: Integrate without redesigning the workspace**

In `applications.$id.tsx`, retain the existing Generate CV action, store the latest structured proposal in component state after generation, render `TailoredCvReview` in the CV tab, and keep `approveCv()` as the explicit transition from Draft to Approved.

- [ ] **Step 5: Run component and route-related tests**

Run: `pnpm vitest run src/components/careeros/tailored-cv-review.test.tsx src/lib/careeros/resume`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/careeros/tailored-cv-review.tsx src/components/careeros/tailored-cv-review.test.tsx 'src/routes/applications.$id.tsx'
git commit -m "feat: review tailored CV claims with evidence"
```

### Task 6: End-to-End Capital on Tap Regression and Verification

**Files:**
- Create: `src/lib/careeros/resume/capital-on-tap.test.ts`
- Modify only if test exposes a genuine defect in the resume subsystem.

**Interfaces:**
- Consumes: representative Associate Product Manager JD and canonical-style evidence fixtures
- Produces: regression coverage for the first real CareerOS tailoring case

- [ ] **Step 1: Write the regression test**

Use a representative JD requiring product/project management, end-to-end delivery, stakeholders, commercial thinking and customer outcomes. Fixtures should include Intentionally product evidence, CRM migration, Agile/Asana delivery, a verified commercial metric, and unrelated marketing evidence. Assert the Product family is selected, relevant evidence outranks unrelated evidence, blocked/context-only evidence is not emitted, and the result stays Draft at the application layer.

- [ ] **Step 2: Run the regression test**

Run: `pnpm vitest run src/lib/careeros/resume/capital-on-tap.test.ts`
Expected: PASS after Tasks 1–5. If it fails, fix only the demonstrated defect and rerun.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect the production-facing flow manually**

Open CareerOS staging, use the Capital on Tap vacancy, run Analyse Role, generate Tailored CV, confirm evidence references are visible, confirm the CV is Draft, then approve it explicitly. Verify no excluded/context-only claim appears in the generated wording.

- [ ] **Step 5: Commit any regression fixture only**

```bash
git add src/lib/careeros/resume/capital-on-tap.test.ts
git commit -m "test: cover Capital on Tap CV tailoring flow"
```

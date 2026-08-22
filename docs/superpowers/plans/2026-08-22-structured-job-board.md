# Structured Job Board v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-friendly structured Job Board that persists inside existing CareerOS state, analyses roles through the existing scoring engine, and creates normal applications without scraping protected third-party pages.

**Architecture:** Extend the existing CareerOS snapshot with `jobBoardListings`, add pure Job Board domain helpers, and build a new `/job-board` route that orchestrates those helpers with the existing `runScan`, `update`, and application workspace flow. Keep `/job-scan` unchanged in purpose and preserve all current trust, evidence, reviewer, cloud-save and 403 fallback behaviour.

**Tech Stack:** TypeScript, React 19, TanStack Router, Vitest, Testing Library, Tailwind CSS, existing CareerOS Supabase snapshot repository, Cloudflare Workers build.

**Spec:** `docs/superpowers/specs/2026-08-22-structured-job-board-design.md`

## Global Constraints

- Do not bypass anti-bot controls or scrape protected job sites in Job Board v1.
- Do not introduce a separate Job Board backend or new Supabase table in v1.
- Do not replace the existing Job Scan URL/paste flow.
- Use the existing `runScan` scoring engine and evidence rules.
- Preserve source provenance and original/apply URLs.
- A job description must contain at least 40 words before analysis.
- Maintain responsive behaviour with no page-level horizontal overflow at 320px, 375px, 768px or desktop widths.
- Keep British English product copy.

---

### Task 1: Job Board domain model and backward-compatible state

**Files:**
- Modify: `src/lib/careeros/types.ts`
- Modify: `src/lib/careeros/profile-data.ts`
- Create: `src/lib/careeros/job-board.test.ts`
- Create: `src/lib/careeros/job-board.ts`

**Interfaces:**
- Produces `JobBoardListing`, `JobBoardSourceKind`, `JobBoardFilters` types.
- Produces `normaliseJobBoardListing`, `listingToJobRecord`, `latestAnalysisForListing`, `filterJobBoardListings`, `jobBoardFilterOptions` pure functions.
- Extends `CareerOsData` with `jobBoardListings: JobBoardListing[]` and `JobRecord.sourceType` with `board`, plus optional `boardListingId`.

- [ ] **Step 1: Write failing domain tests** covering structured conversion, provenance, 40-word-ready description count, latest scan association, saved/search/workplace/employment filtering, malformed URL handling and missing older `jobBoardListings` default.
- [ ] **Step 2: Run `npm test -- src/lib/careeros/job-board.test.ts` and confirm RED** because the Job Board types/helpers do not exist.
- [ ] **Step 3: Implement minimal types and pure helpers**. `listingToJobRecord` must set `sourceType: "board"`, `extractionCompleteness: "complete"`, `extractionMethod: "structured"`, preserve description, choose `sourceUrl ?? applyUrl` for `url`, and set `boardListingId`.
- [ ] **Step 4: Update CareerOS bootstrap/foundation compatibility** so older snapshots lacking `jobBoardListings` are loaded with `[]` without mutating unrelated persisted data.
- [ ] **Step 5: Run the focused tests and existing cloud/bootstrap tests, confirm GREEN**.
- [ ] **Step 6: Commit** with `feat: add structured Job Board domain model`.

### Task 2: Job Board route, persistence and analysis workflow

**Files:**
- Create: `src/routes/-job-board.test.tsx`
- Create: `src/routes/job-board.tsx`
- Modify only if needed: `src/lib/careeros/job-board.ts`

**Interfaces:**
- Consumes Job Board helpers from Task 1.
- Consumes existing `runScan`, `uid`, `useCareerOs`, and application route conventions.
- Produces `/job-board` UI with add/import, filters, save, source links, Analyse role and Create application.

- [ ] **Step 1: Write failing route tests** for required fields, save toggle persistence, filters, Analyse role persistence, latest score/verdict rendering, pre-analysis application block, post-analysis application creation, salary/deadline/URL preservation and navigation to `/applications/$id`.
- [ ] **Step 2: Run `npm test -- src/routes/-job-board.test.tsx` and confirm RED** because the route does not exist.
- [ ] **Step 3: Implement minimal `/job-board` page** using existing CareerOS `Panel`, `StatusPill`, Button/Input/Label/Textarea and native/select controls already used by the codebase. Keep cards single-column on narrow screens and avoid fixed widths that overflow.
- [ ] **Step 4: Analyse role through existing `runScan` only**. Each analysis creates a fresh `JobRecord` plus `ScanResult` and persists both through `update`.
- [ ] **Step 5: Implement application creation from the latest listing analysis** with compatibility score, source/apply URL, salary, deadline, working arrangement, employment type and normal history/next-action fields.
- [ ] **Step 6: Run focused route tests plus current Job Scan/application workflow regressions and confirm GREEN**.
- [ ] **Step 7: Commit** with `feat: add Job Board workflow`.

### Task 3: Navigation and responsive regression coverage

**Files:**
- Modify: `src/components/careeros/app-shell.tsx`
- Modify or create relevant navigation test file under `src/routes` or `src/components/careeros` following existing test placement.

**Interfaces:**
- Adds `/job-board` to desktop navigation.
- Adds Job Board to the mobile `More` sheet unless the fixed six-slot bar remains clearly usable without shrinking existing destinations.

- [ ] **Step 1: Write failing navigation test** that expects a Job Board route in desktop navigation and an accessible mobile path.
- [ ] **Step 2: Run the navigation test and confirm RED**.
- [ ] **Step 3: Add `Job Board` navigation** with a suitable lucide icon and preserve the six-slot mobile bar by placing Job Board in the More sheet.
- [ ] **Step 4: Run navigation and route-guard regressions and confirm GREEN**.
- [ ] **Step 5: Commit** with `feat: add Job Board navigation`.

### Task 4: Full release-candidate verification and review

**Files:**
- Update: `docs/superpowers/plans/2026-08-22-structured-job-board.md` only to mark completed checkboxes if desired.
- Update PR #30 description/comments with verification evidence, not production code.

**Interfaces:**
- Produces verifiable evidence that the branch is safe to merge.

- [ ] **Step 1: Run full `npm test`** and require zero failures.
- [ ] **Step 2: Run `npm run lint`** and require zero lint errors; document non-blocking existing warnings separately.
- [ ] **Step 3: Run `npm run build`** and require a successful Cloudflare-targeted production build.
- [ ] **Step 4: Confirm existing Job Scan 403/manual fallback regression remains green**.
- [ ] **Step 5: Confirm PR preview deployment and signed-out route protection** when Cloudflare preview automation is available.
- [ ] **Step 6: Perform broad branch diff review** against the approved spec, checking trust boundaries, source provenance, duplicate scoring logic, mobile overflow risks and accidental changes outside Job Board scope.
- [ ] **Step 7: Leave PR #30 draft until automated verification is green and authenticated private smoke is ready for Vinnie**.

## Self-review

- Spec coverage: all approved v1 behaviours map to Tasks 1-4.
- Placeholder scan: no TBD/TODO/implementation-later steps.
- Type consistency: Job Board source type, listing ID, source/apply URLs and application fields use the same names across tasks.
- Scope: licensed feeds, browser share integration and employer-direct publishing remain future adapters, not part of this plan.

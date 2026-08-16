# Career OS Evidence and Cloudflare Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the Career OS evidence baseline, restore a clean quality gate, and publish a verified staging Worker.

**Architecture:** Keep the existing local seed model and add focused regression tests around the audited facts. Use the existing TanStack Start Cloudflare output and Wrangler environments, with Supabase browser configuration supplied at build time.

**Tech Stack:** TypeScript, React, TanStack Start, Vitest, ESLint, Prettier, Cloudflare Workers, Wrangler, Supabase.

## Global Constraints

- British English throughout user-facing career content.
- Confirmed user corrections override older derivative CVs.
- Vinnie's direct confirmation, the evidence audit and the supplied master CV are sufficient evidence. Primary employer records are not required.
- Academic and founder work must not be presented as commercial employment.
- Deploy staging only. Do not deploy production.

---

### Task 1: Evidence regression tests

**Files:**
- Create: `src/lib/careeros/seed.test.ts`
- Test: `src/lib/careeros/seed.test.ts`

**Interfaces:**
- Consumes: `createSeedData(): CareerOsData` from `src/lib/careeros/seed.ts`
- Produces: Regression coverage for the audited seed baseline

- [ ] **Step 1: Write failing tests for the corrected employment date, project records and evidence statuses**
- [ ] **Step 2: Run `vitest run src/lib/careeros/seed.test.ts` and confirm the tests fail against the old seed**
- [ ] **Step 3: Keep the failing output as the red phase evidence**

### Task 2: Correct the Career OS seed

**Files:**
- Modify: `src/lib/careeros/seed.ts`
- Test: `src/lib/careeros/seed.test.ts`

**Interfaces:**
- Consumes: Existing `CareerOsData` types and IDs used by the application
- Produces: Audited employment, project and evidence records

- [ ] **Step 1: End Northeastern University London in December 2025 and remove unsupported employment-type assumptions**
- [ ] **Step 2: Update Intentionally and add Atlas as non-commercial project records**
- [ ] **Step 3: Replace verified Gartner wording with TRL, AD² and S-curve wording**
- [ ] **Step 4: Keep supported CV metrics verified using the audit, master CV and direct user confirmation**
- [ ] **Step 5: Run the focused test and confirm it passes**

### Task 3: Restore the repository quality gate

**Files:**
- Modify: Files reported by ESLint/Prettier

**Interfaces:**
- Consumes: Existing ESLint and Prettier configuration
- Produces: A repository that passes `npm run lint`

- [ ] **Step 1: Apply Prettier mechanically to the repository source and documentation files**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Address any non-formatting lint errors without changing behaviour**

### Task 4: Verify Cloudflare readiness

**Files:**
- Modify: `README.md`, `package.json`, `bun.lock`, `wrangler.jsonc` only if validation identifies a configuration defect

**Interfaces:**
- Consumes: `.output/server/index.mjs`, `.output/public`, Wrangler staging environment
- Produces: A validated `careeros-staging` Worker bundle

- [ ] **Step 1: Run the complete Vitest suite**
- [ ] **Step 2: Run ESLint**
- [ ] **Step 3: Run the production build**
- [ ] **Step 4: Run `wrangler deploy --dry-run --env staging`**
- [ ] **Step 5: Inspect the diff and confirm no credentials or unrelated files are included**

### Task 5: Commit and deploy staging

**Files:**
- Commit: Only the audited evidence, tests, formatting, documentation and Cloudflare configuration changes

**Interfaces:**
- Consumes: Verified git working tree and authenticated Cloudflare account
- Produces: Git commit and staging Worker URL

- [ ] **Step 1: Commit the verified changes with an intentional message**
- [ ] **Step 2: Confirm Cloudflare authentication with `wrangler whoami`**
- [ ] **Step 3: Deploy with `npm run deploy:staging`**
- [ ] **Step 4: Check the returned staging URL and report any remaining external configuration**

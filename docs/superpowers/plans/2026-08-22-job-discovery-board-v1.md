# Job Discovery Board v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personalised CareerOS Job Board that discovers permitted-feed vacancies, launches tailored searches on major job sites, ranks and filters active roles, preserves source/status provenance, and sends an optional daily shortlist.

**Architecture:** Keep trusted profile/application workflow data in the existing `career_state` snapshot, while storing high-churn job discovery data in dedicated Supabase tables. Automatic discovery runs server-side through a provider adapter contract, starting with Adzuna when configured; LinkedIn, Indeed, Reed, Totaljobs and Glassdoor remain user-initiated main-site search destinations. Reuse the existing `runScan` engine for compatibility scoring, expose authenticated server functions for manual refresh/preferences/capture, and add a Cloudflare `scheduled()` handler for the daily run.

**Tech Stack:** TanStack Start, React 19, TypeScript, Supabase, Cloudflare Workers/Cron Triggers, Vitest, Zod, existing CareerOS scoring engine, Resend HTTP API for optional email.

**Spec:** `docs/superpowers/specs/2026-08-22-job-discovery-board-v1-design.md`

## Global Constraints

- British English UI copy.
- Do not use em dashes in user-facing copy.
- Do not scrape or bypass anti-bot protections on LinkedIn, Indeed, Reed, Totaljobs, Glassdoor or protected employer sites.
- Do not invent salary, visa, workplace, closing-date, eligibility or active-status data.
- Reuse `runScan`; do not add a second compatibility engine.
- Keep provider/service-role/email secrets server-only.
- Job Board route remains authenticated.
- Missing provider configuration must degrade visibly and safely.
- Expired jobs are archived, never deleted with their history.
- Do not merge to `main` before authenticated QA passes.

---

### Task 1: Discovery schema and domain types

**Files:**
- Create: `supabase/migrations/20260822120500_create_job_discovery.sql`
- Create: `src/lib/careeros/job-discovery.types.ts`
- Create: `src/lib/careeros/job-discovery.domain.ts`
- Test: `src/lib/careeros/job-discovery.domain.test.ts`

**Interfaces:**
- Produces `JobSearchPreferences`, `DiscoveredJob`, `JobSourceRef`, `JobDiscoveryRun`, `JobDiscoveryFilters`, `JobDiscoverySort`.
- Produces pure helpers `normaliseSafeUrl`, `buildDedupeKey`, `mergeSourceRefs`, `evaluateJobStatus`, `filterAndSortJobs`.

- [ ] **Step 1: Write failing domain tests** covering safe URL validation, deterministic dedupe, conservative source merging, 403/429 => uncertain, 404/410 => expired, closing-within-seven-days => closing soon, and filter/sort combinations.
- [ ] **Step 2: Run** `bun test src/lib/careeros/job-discovery.domain.test.ts` and confirm RED because the discovery domain does not exist.
- [ ] **Step 3: Add the Supabase migration** with `job_search_preferences`, `discovered_jobs`, and `job_discovery_runs`, user ownership indexes, scheduled-run idempotency, timestamps and RLS. Authenticated browser writes to `discovered_jobs` must be limited to `saved`; discovery fields are server-written.
- [ ] **Step 4: Implement the domain types and helpers** with no inferred unknown metadata.
- [ ] **Step 5: Re-run the domain test and confirm GREEN.**
- [ ] **Step 6: Commit** `feat: add job discovery data model`.

### Task 2: Preference derivation and external search destinations

**Files:**
- Create: `src/lib/careeros/job-search-preferences.ts`
- Test: `src/lib/careeros/job-search-preferences.test.ts`
- Create: `src/lib/careeros/job-search-destinations.ts`
- Test: `src/lib/careeros/job-search-destinations.test.ts`

**Interfaces:**
- Produces `deriveJobSearchPreferences(profile, profileItems)`.
- Produces `mergePreferenceOverrides(derived, stored)` where manual overrides win.
- Produces `buildExternalSearchLinks(preferences)` returning LinkedIn, Indeed, Reed, Totaljobs and Glassdoor URLs.

- [ ] **Step 1: Write failing preference tests** proving title/seniority/industry/location defaults derive from the Career Profile and stored manual overrides are never silently replaced.
- [ ] **Step 2: Write failing destination tests** proving every major-site link is HTTPS, includes target title/location terms, and never embeds secrets.
- [ ] **Step 3: Run both tests and confirm RED.**
- [ ] **Step 4: Implement preference derivation** conservatively from existing profile data, defaulting to UK + global UK-hireable + relocation sponsorship, all three employment types and email alerts enabled.
- [ ] **Step 5: Implement destination URL builders** as user-initiated main-site searches only.
- [ ] **Step 6: Re-run tests and confirm GREEN.**
- [ ] **Step 7: Commit** `feat: derive job search preferences and destination links`.

### Task 3: Provider adapter, normalisation and Adzuna

**Files:**
- Create: `src/lib/careeros/job-discovery.providers.ts`
- Create: `src/lib/careeros/job-discovery.adzuna.ts`
- Test: `src/lib/careeros/job-discovery.adzuna.test.ts`
- Create: `src/lib/careeros/job-discovery.normalise.ts`
- Test: `src/lib/careeros/job-discovery.normalise.test.ts`

**Interfaces:**
- Produces `JobDiscoveryAdapter`, `JobDiscoveryQuery`, `RawJobListing`, `DiscoveryEnv`.
- Produces `adzunaAdapter` and `normaliseRawJob`.

- [ ] **Step 1: Write failing adapter tests** with injected `fetch` proving no request is made when credentials are missing, configured requests use Adzuna's official endpoint shape, and provider failures return a source-level error rather than crashing the run.
- [ ] **Step 2: Write failing normalisation tests** for salary/date/workplace/employment/source fields and unknown fields remaining null/unknown.
- [ ] **Step 3: Run tests and confirm RED.**
- [ ] **Step 4: Implement the provider contract and Adzuna adapter** using `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` from server env only.
- [ ] **Step 5: Implement normalisation** and exact/adjacent role classification without making unsupported claims.
- [ ] **Step 6: Re-run tests and confirm GREEN.**
- [ ] **Step 7: Commit** `feat: add permitted job discovery provider adapter`.

### Task 4: Supabase discovery repository and orchestration

**Files:**
- Create: `src/lib/careeros/job-discovery.repository.ts`
- Test: `src/lib/careeros/job-discovery.repository.test.ts`
- Create: `src/lib/careeros/job-discovery.orchestrator.ts`
- Test: `src/lib/careeros/job-discovery.orchestrator.test.ts`
- Create: `src/lib/careeros/job-discovery.functions.ts`

**Interfaces:**
- Produces authenticated list/save/preferences methods for browser use.
- Produces service-role discovery repository for server runs.
- Produces `runJobDiscoveryForUser({ userId, runKind, now, env })`.
- Produces server functions `getJobBoard`, `saveJobSearchPreferences`, `refreshJobs`, `setJobSaved`.

- [ ] **Step 1: Write failing repository tests** proving rows map to domain objects and user-state updates cannot overwrite server discovery fields.
- [ ] **Step 2: Write failing orchestrator tests** proving one run: loads preferences and career state, calls configured adapters, normalises/dedupes, preserves source refs, calculates status, calls existing `runScan` only when description is reliable and >=40 words, upserts results, archives explicitly expired jobs, and records partial source failures.
- [ ] **Step 3: Run tests and confirm RED.**
- [ ] **Step 4: Implement request-scoped and service-role Supabase clients** without exposing `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- [ ] **Step 5: Implement repository and orchestration.** Background scoring stores summary fields only; full scan history is created only by explicit user analysis.
- [ ] **Step 6: Implement authenticated server functions** and zod validation for preferences/filter inputs.
- [ ] **Step 7: Re-run tests and confirm GREEN.**
- [ ] **Step 8: Commit** `feat: orchestrate personalised job discovery`.

### Task 5: Active-status checks, scheduled refresh and daily email

**Files:**
- Create: `src/lib/careeros/job-status.server.ts`
- Test: `src/lib/careeros/job-status.server.test.ts`
- Create: `src/lib/careeros/job-discovery.email.ts`
- Test: `src/lib/careeros/job-discovery.email.test.ts`
- Create: `src/lib/careeros/job-discovery.scheduled.ts`
- Test: `src/lib/careeros/job-discovery.scheduled.test.ts`
- Modify: `src/server.ts`
- Modify: `wrangler.jsonc`
- Modify: `.env.example`

**Interfaces:**
- Produces `checkDirectJobStatus(url, fetchImpl)`.
- Produces `sendDailyJobShortlist(input, env)` using Resend HTTP API when configured.
- Produces `runScheduledJobDiscovery(env, now)`.

- [ ] **Step 1: Write failing status tests** for 404/410 expired, 403/429 uncertain, explicit closed-page language expired, and ambiguous 200 uncertain.
- [ ] **Step 2: Write failing email tests** proving only fresh non-expired shortlist jobs are included, disabled alerts send nothing, missing Resend config is reported as unavailable rather than success, and one scheduled run cannot email twice for the same user/day.
- [ ] **Step 3: Run tests and confirm RED.**
- [ ] **Step 4: Implement safe status checks** with timeout, no anti-bot circumvention and conservative page interpretation.
- [ ] **Step 5: Implement Resend email boundary** using `RESEND_API_KEY` and `JOB_DISCOVERY_FROM_EMAIL`; recipient comes from the authorised Supabase user record.
- [ ] **Step 6: Implement scheduled discovery** over users with preferences, using service-role access and per-user run idempotency.
- [ ] **Step 7: Extend the existing custom `src/server.ts` default export with `scheduled()`** while preserving the existing SSR `fetch()` error wrapper.
- [ ] **Step 8: Add Cloudflare cron config** for one daily UTC run and document all server secrets in `.env.example` without values.
- [ ] **Step 9: Re-run tests and confirm GREEN.**
- [ ] **Step 10: Commit** `feat: schedule discovery and daily shortlist email`.

### Task 6: Job Board UI, filters, preferences and external capture

**Files:**
- Create: `src/routes/job-board.tsx`
- Test: `src/routes/-job-board.test.tsx`
- Create: `src/routes/job-capture.tsx`
- Test: `src/routes/-job-capture.test.tsx`
- Create: `src/components/careeros/job-search-preferences-panel.tsx`
- Create: `src/components/careeros/job-board-filters.tsx`
- Modify: `src/components/careeros/app-shell.tsx`
- Modify: `src/components/auth/account-shell.integration.test.tsx`
- Modify: `src/lib/auth/route-guard.test.ts`

**Interfaces:**
- `/job-board` reads from `getJobBoard` and calls the server functions from Task 4.
- `/job-capture?url=...` feeds the existing safe extraction flow and provides paste fallback.

- [ ] **Step 1: Write failing route tests** proving Job Board renders preference summary, destination buttons, New today, shortlist, refresh control, status/source badges, archived view, save action, and all supported filters/sorts.
- [ ] **Step 2: Write failing capture tests** proving valid HTTPS URL prefill, blocked extraction shows paste fallback, and unreliable extraction is never auto-analysed.
- [ ] **Step 3: Update failing navigation/auth tests** to require `/job-board` and `/job-capture` authentication and show Job Board in desktop plus mobile More navigation.
- [ ] **Step 4: Run route/navigation tests and confirm RED.**
- [ ] **Step 5: Implement Job Board UI** with filters for fit band, source, exact/adjacent, title, company, industry, seniority, salary, location, UK/global scope, workplace, employment type, sponsorship/relocation, status, date posted, closing soon, saved and New today where data exists. Sorting: Best fit, Newest, Closing soon, Salary.
- [ ] **Step 6: Implement preferences panel** including the email-alert toggle, all approved search-scope controls and a clear distinction between derived defaults and manual overrides.
- [ ] **Step 7: Implement explicit Analyse role** by converting the discovered job to a normal `JobRecord`, calling existing `runScan`, and appending a new job + scan snapshot to `career_state`; re-analysis appends rather than overwrites.
- [ ] **Step 8: Implement external capture route** and a copyable lightweight `Save to CareerOS` bookmarklet/link pattern.
- [ ] **Step 9: Re-run tests and confirm GREEN.**
- [ ] **Step 10: Commit** `feat: add personalised Job Board experience`.

### Task 7: Full verification, migration safety and release-candidate handoff

**Files:**
- Modify tests only if verification exposes a genuine missing requirement.
- Update: `README.md` only with operational setup needed for Job Discovery.

- [ ] **Step 1: Run** `bun test` and require zero failures.
- [ ] **Step 2: Run** `bun run lint` and require zero errors.
- [ ] **Step 3: Run** `bun run build` and require a Cloudflare-targeted production build.
- [ ] **Step 4: Review the migration** for RLS, indexes, constraints, backwards safety and no destructive changes.
- [ ] **Step 5: Verify secrets are absent from committed client code** and only variable names appear in docs/example env.
- [ ] **Step 6: Verify protected-site behaviour** remains safe: 403/429 => uncertain/paste fallback, never bypass.
- [ ] **Step 7: Open a draft PR to `main`** and wait for all repository checks/deploy preview results.
- [ ] **Step 8: Perform authenticated private smoke on the preview:** preferences, external search links, filters, manual refresh, one configured feed or explicit unavailable state, Save, Analyse role, archive behaviour, capture fallback and email toggle.
- [ ] **Step 9: Do not mark ready or merge** until authenticated QA passes and required provider/Resend/Cloudflare secrets are configured in the target environment.

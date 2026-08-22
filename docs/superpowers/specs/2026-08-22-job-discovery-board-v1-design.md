# Job Discovery Board v1 Design

**Date:** 22 August 2026  
**Status:** Approved design, ready for implementation planning  
**Branch:** `feature/job-discovery-board-v1`

## 1. Goal

Build a personalised CareerOS Job Board that discovers, ranks and tracks realistic vacancies for Vinnie rather than acting as a manual saved-jobs database.

The board must combine two legitimate discovery modes:

1. **Automatic feeds and APIs** where a provider permits programmatic job search.
2. **One-click searches on major job websites** such as LinkedIn, Indeed, Reed, Totaljobs and Glassdoor, using CareerOS preferences to pre-fill the search and sending the user to the provider's main website.

CareerOS must not bypass anti-bot protections, scrape protected pages without permission, or present an unverifiable vacancy as active.

## 2. Success criteria

V1 is successful when an authenticated user can:

- open a Job Board from CareerOS navigation;
- review and edit Job Search Preferences derived from the Career Profile;
- search UK roles plus globally accessible roles that can realistically employ a UK-based candidate;
- include visa-sponsored relocation roles;
- search exact target titles and adjacent roles;
- include permanent, contract and fixed-term work;
- see automatically discovered jobs from configured permitted sources;
- launch tailored searches on LinkedIn, Indeed, Reed, Totaljobs, Glassdoor and supported company career sites;
- save a job from an external source into CareerOS through a user-initiated capture flow;
- see duplicate listings merged into one job with multiple source references;
- see the employer's direct careers/application URL preferred when it is known;
- see CareerOS compatibility score and fit band for jobs with enough reliable description text to score;
- see jobs ranked by fit rather than hidden below a hard fit threshold;
- filter and sort the board using supported job metadata;
- see New today and a daily shortlist of the strongest fresh active matches;
- refresh jobs manually;
- have the discovery pipeline run daily automatically;
- receive the daily shortlist by email while email alerts are enabled;
- turn email alerts off inside CareerOS without turning off discovery;
- see job status as Active, Closing Soon, Expired/Removed or Status Uncertain;
- have inactive jobs archived without losing analysis, notes or application history.

## 3. Explicit non-goals

V1 will not:

- scrape LinkedIn, Indeed, Reed, Totaljobs or Glassdoor behind anti-bot controls;
- automate a user's LinkedIn or Indeed account;
- apply to jobs automatically;
- invent salary, visa, workplace, closing-date or active-status data;
- create a second compatibility scoring engine;
- silently overwrite an existing scan or application;
- merge this work into `main` before authenticated QA passes.

## 4. User model and search scope

### 4.1 Geography

Default discovery scope is:

- UK-based roles;
- remote roles that explicitly permit a worker based in the UK;
- international employers that can hire in the UK;
- roles open to UK residents or UK citizens where the advert says so;
- visa-sponsored relocation roles;
- relocation roles where sponsorship or work-authorisation support is explicit.

Jobs that explicitly exclude UK-based candidates should be filtered out when that exclusion is known. If eligibility cannot be established, the role may remain visible but must not be labelled as confirmed UK-eligible.

### 4.2 Role matching

Preferences include:

- exact target job titles;
- adjacent job titles;
- seniority;
- preferred industries;
- salary target/range;
- locations;
- remote, hybrid and on-site preferences;
- permanent, contract and fixed-term employment;
- UK-based, globally remote and relocation/sponsorship scope.

CareerOS derives an initial preference set from the Career Profile. The user can edit every derived field. Once a field is manually overridden, daily refreshes must not silently replace the override from the profile.

## 5. Architecture

### 5.1 High-level flow

```text
Career Profile
    ↓ derive defaults
Job Search Preferences
    ↓
Discovery orchestrator
    ├─ permitted feed/API adapters
    ├─ external main-site search link builder
    └─ user-initiated external job capture
    ↓
normalisation + validation
    ↓
deduplication + source merge
    ↓
active-status evaluation
    ↓
existing CareerOS runScan scoring
    ↓
Supabase discovered-job records
    ↓
Job Board + New today + daily shortlist
    ↓
optional daily email
```

### 5.2 Separation from the existing CareerOS snapshot

The existing `career_state` JSON snapshot remains the canonical store for profile, evidence, scans, documents and application workflow state.

High-churn discovery data must not be embedded into that snapshot. Daily refresh can create, update and archive many job records, and rewriting the full CareerOS snapshot for those changes would increase conflict risk and couple external feed churn to trusted career data.

V1 therefore adds dedicated Supabase tables for job discovery while preserving the existing `career_state` architecture.

### 5.3 Proposed Supabase tables

#### `job_search_preferences`

One row per authenticated user.

Required columns:

- `user_id uuid primary key references auth.users(id)`
- `exact_titles text[]`
- `adjacent_titles text[]`
- `seniority text[]`
- `industries text[]`
- `locations text[]`
- `salary_min integer null`
- `salary_currency text not null default 'GBP'`
- `workplace_types text[]`
- `employment_types text[]`
- `include_uk boolean not null default true`
- `include_global_uk_hireable boolean not null default true`
- `include_relocation_sponsorship boolean not null default true`
- `email_alerts_enabled boolean not null default true`
- `derived_from_profile_at timestamptz null`
- `manual_overrides jsonb not null default '{}'::jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

RLS permits the authenticated user to select, insert and update only their own row.

#### `discovered_jobs`

A user-specific, deduplicated vacancy record. V1 deliberately stores one canonical row per user rather than introducing a global multi-tenant vacancy catalogue.

Required columns:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `dedupe_key text`
- `title text`
- `company text`
- `location text null`
- `description text null`
- `description_word_count integer not null default 0`
- `industry text null`
- `seniority text null`
- `salary_min integer null`
- `salary_max integer null`
- `salary_currency text null`
- `salary_text text null`
- `workplace_type text null`
- `employment_type text null`
- `date_posted date null`
- `closing_date date null`
- `uk_eligibility text not null`
- `visa_sponsorship text not null`
- `match_type text not null` with values `exact`, `adjacent`, `other`
- `source_refs jsonb not null` containing provider, source URL, application URL, source job ID, first seen and last seen timestamps
- `preferred_source_url text null`
- `preferred_apply_url text null`
- `status text not null` with values `active`, `closing_soon`, `expired`, `uncertain`
- `status_reason text not null`
- `last_status_check_at timestamptz null`
- `first_seen_at timestamptz`
- `last_seen_at timestamptz`
- `archived_at timestamptz null`
- `saved boolean not null default false`
- `fit_score integer null`
- `fit_verdict text null`
- `fit_strategy text null`
- `fit_scored_at timestamptz null`
- `fit_description_signature text null`
- `created_at timestamptz`
- `updated_at timestamptz`

Unique constraint: `(user_id, dedupe_key)`.

RLS permits the authenticated user to read and update only their own rows. Client updates are restricted to user-state fields such as `saved`; server discovery writes use the service-role client.

#### `job_discovery_runs`

Audit trail and idempotency record for automatic and manual discovery.

Required columns:

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `run_kind text` with values `scheduled` or `manual`
- `run_day date`
- `started_at timestamptz`
- `completed_at timestamptz null`
- `status text` with values `running`, `success`, `partial`, `failed`
- `source_results jsonb not null default '{}'::jsonb`
- `new_jobs integer not null default 0`
- `updated_jobs integer not null default 0`
- `archived_jobs integer not null default 0`
- `email_sent_at timestamptz null`
- `error_summary text null`

Scheduled runs use a unique constraint on `(user_id, run_kind, run_day)` so a retry does not send the same daily email twice.

### 5.4 RLS and service-role boundary

- Browser code uses the authenticated Supabase client and may only access the current user's preferences, discovered jobs and discovery-run history.
- Scheduled discovery uses a server-only Supabase service-role key stored as a Cloudflare secret.
- Provider keys and email keys are server-only Cloudflare secrets.
- No provider secret is returned to the browser or stored in `career_state`.

## 6. Discovery providers

### 6.1 Provider adapter contract

All automatic providers implement the same server-side contract:

```ts
interface JobDiscoveryAdapter {
  id: string;
  isConfigured(env: DiscoveryEnv): boolean;
  search(input: JobDiscoveryQuery, env: DiscoveryEnv): Promise<RawJobListing[]>;
}
```

The orchestrator is responsible for retries, normalisation, deduplication, scoring and persistence. Adapters only translate provider-specific search results into `RawJobListing`.

### 6.2 Automatic providers

V1 supports permitted feed/API adapters only when credentials or public access are legitimately available. The first adapter should be Adzuna because its official search API supports job search criteria relevant to CareerOS.

The implementation must degrade cleanly when a provider is not configured. The UI must show that a feed source is unavailable rather than claiming it refreshed successfully.

Future legitimate providers can be added behind the same adapter interface without changing Job Board domain logic.

### 6.3 Major job websites as destinations

LinkedIn, Indeed, Reed, Totaljobs and Glassdoor are implemented as **search destination adapters**, not background scrapers.

Each destination adapter builds a current main-site search URL from Job Search Preferences. The Job Board displays actions such as:

- Search LinkedIn
- Search Indeed
- Search Reed
- Search Totaljobs
- Search Glassdoor

The links open the provider in a new tab. CareerOS does not sign in, click results or crawl result pages on the user's behalf.

### 6.4 Company career sites

When a direct employer careers/application URL is already known from a permitted feed or user capture, it becomes the preferred apply destination.

Public company ATS feeds may be added later as provider adapters if their documented/public access permits it. V1 must not invent a company-career URL from company name alone.

## 7. External job capture

### 7.1 V1 capture mechanism

V1 provides a lightweight bookmarklet-style or browser action that opens a CareerOS capture URL with the current job-page URL encoded as input.

This is user-initiated. It does not run as a background crawler.

CareerOS then uses the existing safe job-extraction pipeline:

1. validate the URL as `http` or `https`;
2. attempt permitted extraction;
3. if reliable structured/semantic extraction succeeds, preview the captured job;
4. if extraction is blocked, partial or unreliable, ask the user to paste the description;
5. never analyse an unreliable extraction silently.

Captured jobs pass through the same normalisation, deduplication, status and scoring path as feed jobs.

### 7.2 Protected sites

For LinkedIn, Indeed or any other site returning 403, 429, login walls or anti-bot content:

- do not bypass the protection;
- mark automated status as `uncertain` if no reliable independent source exists;
- keep the original source URL;
- show `Open source to verify`;
- allow manual description paste for analysis.

## 8. Normalisation and deduplication

### 8.1 Normalised vacancy fields

Provider data is normalised into one internal representation before storage. Missing values remain null/unknown.

URLs must be safe `http`/`https` URLs only.

### 8.2 Dedupe key

The primary dedupe key is a stable hash of normalised:

- company;
- title;
- coarse location or remote scope;
- provider job identifier or direct application URL when reliable.

Fuzzy fallback dedupe may merge jobs when company, title and location are strongly equivalent and posting dates overlap. Fuzzy merge must be conservative because incorrectly merging two distinct vacancies is worse than showing a duplicate.

### 8.3 Source merging

When a duplicate is detected:

- keep one `discovered_jobs` row;
- merge unique source references;
- update `last_seen_at`;
- choose the preferred application URL in this order:
  1. employer direct careers/application URL;
  2. permitted feed's direct apply URL;
  3. major job-board source URL.

No source history is discarded.

## 9. Active-job status

### 9.1 Status values

- **Active**: source/feed explicitly reports the listing active, or a direct employer page is reliably available and not past a known closing date.
- **Closing Soon**: otherwise active and closing date is within seven calendar days.
- **Expired/Removed**: source/feed explicitly removes/closes it, direct page returns reliable gone/not-found evidence, or a known closing date has passed.
- **Status Uncertain**: CareerOS cannot verify safely, including blocked pages, login walls, 403/429 responses or ambiguous pages.

### 9.2 Daily re-check

Every scheduled refresh rechecks previously active jobs when the source permits it.

For feed jobs, absence from a single refresh does not immediately prove expiry. A provider-specific rule may require consecutive misses unless the provider returns an explicit closed state.

For direct URLs:

- 404/410 can support `expired`;
- 403/429 supports `uncertain`, not `expired`;
- a successful HTTP response alone is insufficient if the page clearly says the vacancy is closed;
- ambiguous content remains `uncertain`.

### 9.3 Archiving

When status becomes `expired`, set `archived_at` and remove the job from the default active board view.

Archiving must not delete:

- source history;
- saved state;
- scan history in `career_state`;
- application history;
- notes or generated documents linked through the normal application workflow.

## 10. CareerOS compatibility scoring

### 10.1 Single scoring engine

V1 reuses existing `runScan(job, CareerOsData)` from `src/lib/careeros/scoring.ts`.

No discovery-specific compatibility formula is allowed.

### 10.2 Automatic scoring

The scheduled/manual discovery orchestrator loads the user's canonical `career_state` and scores any discovered job that has enough reliable description text to build a trustworthy `JobRecord`.

The discovered job stores only the summary score fields needed to rank the board:

- `fit_score`
- `fit_verdict`
- `fit_strategy`
- `fit_scored_at`
- description signature used for scoring

The full `ScanResult` is not silently inserted into the trusted application workflow during background discovery.

When the user clicks **Analyse role**, CareerOS creates a normal `JobRecord` and a new full `ScanResult` in `career_state` using the same `runScan` function. Re-analysis creates a new snapshot rather than overwriting history.

### 10.3 Fit bands

Use the existing scoring verdicts:

- Strong Fit
- Competitive
- Plausible Stretch
- Weak Fit

The default board shows plausible results ranked by fit. It does not hide Stretch jobs solely because they are below a threshold.

## 11. Job Board UX

### 11.1 Navigation

Add `Job Board` to desktop CareerOS navigation and to the mobile `More` menu, protected by the existing authenticated route guard.

### 11.2 Page structure

The Job Board contains, in order:

1. compact search-preference summary with `Edit preferences`;
2. external destination search buttons;
3. `Refresh jobs` action and last-refresh status;
4. `New today` section;
5. `Daily shortlist` section;
6. filter/sort controls;
7. full ranked active-job list;
8. separate Archived/Expired view.

### 11.3 Job card

Each job card should show supported fields only:

- role title;
- company;
- location;
- workplace type;
- employment type;
- salary when supplied;
- date posted when supplied;
- closing date when supplied;
- exact or adjacent role label;
- CareerOS score and fit verdict when scored;
- active-status badge and last checked time;
- source badges;
- UK eligibility / relocation information when known;
- saved state.

Primary actions:

- Save / Unsave
- Analyse role
- Open original
- Apply at source

`Apply at source` uses the preferred employer direct URL where available.

## 12. Filters and sorting

Filters must only rely on real supported metadata. Unknown values remain visible unless the user selects a filter that excludes unknowns.

V1 filters:

- free-text title/company search;
- fit band;
- source;
- exact vs adjacent role;
- industry;
- seniority;
- salary minimum/range where salary data exists;
- location;
- UK-based vs globally UK-hireable vs relocation/sponsorship;
- remote/hybrid/on-site;
- permanent/contract/fixed-term;
- visa sponsorship/relocation;
- Active / Closing Soon / Status Uncertain;
- date posted;
- closing soon;
- saved jobs;
- New today.

V1 sorting:

- Best fit
- Newest
- Closing soon
- Salary high to low, for jobs with comparable salary data

Filters operate locally on the currently loaded user job rows for responsiveness. Query-level filtering/pagination can be introduced if the dataset grows beyond the practical client limit.

## 13. Job Search Preferences UX

Preferences are accessible from the Job Board and may also be linked from Settings.

The form shows whether a value was derived from the Career Profile or manually overridden.

Editable groups:

- exact titles;
- adjacent titles;
- seniority;
- industries;
- salary minimum and currency;
- preferred locations;
- workplace types;
- employment types;
- include UK roles;
- include globally accessible roles for UK-based candidates;
- include visa-sponsored relocation;
- email alerts on/off.

A `Refresh from Career Profile` action may recompute derived values, but it must preserve manual overrides unless the user explicitly resets them.

## 14. Daily refresh

### 14.1 Cloudflare scheduled handler

Use the existing Cloudflare Worker deployment and add a custom TanStack Start server entry point that exports both normal `fetch` handling and a Workers `scheduled()` handler.

Cloudflare's current TanStack Start guidance explicitly supports custom server entry points for Cron Triggers.

Wrangler adds a daily cron trigger. Cron runs in UTC, so the chosen schedule must document the corresponding UK time and daylight-saving behaviour.

### 14.2 Discovery run steps

For each user with preferences:

1. create or claim the day's scheduled `job_discovery_runs` row;
2. load the user's `career_state` and Job Search Preferences;
3. run all configured permitted provider adapters;
4. normalise and validate results;
5. merge duplicates;
6. re-check active status where supported;
7. score reliable descriptions with the existing scoring engine;
8. upsert discovered jobs;
9. archive reliably expired jobs;
10. build the daily shortlist;
11. send email only if alerts are enabled and the day's email has not already been sent;
12. finish the discovery-run audit row.

A failure in one provider must not discard successful results from another provider. The run becomes `partial` and records source-level errors.

### 14.3 Manual refresh

`Refresh jobs` invokes the same orchestrator through an authenticated server function for the current user with `run_kind = manual`.

Manual refresh is rate-limited per user to prevent accidental repeated provider calls.

## 15. Daily shortlist

The shortlist contains fresh jobs first seen since the previous successful scheduled run and currently classified as `active` or `closing_soon`.

Ranking order:

1. fit score;
2. exact-title before adjacent-title when fit is otherwise similar;
3. UK-based or UK-hireable remote before relocation-only, all else equal;
4. recency;
5. closing urgency.

`Status Uncertain` jobs may appear on the full board but must not be emailed as a top active match unless the email clearly labels their status uncertain. Default V1 behaviour is to exclude uncertain jobs from the email shortlist.

## 16. Email

### 16.1 Provider boundary

Implement an email service interface so mail delivery is not coupled to the Job Board domain.

```ts
interface JobAlertEmailService {
  sendDailyShortlist(input: DailyShortlistEmail): Promise<void>;
}
```

V1 provider: Resend, configured through server-only secrets.

Required secrets/configuration:

- `RESEND_API_KEY`
- verified sender address/domain configuration

The recipient email comes from the authenticated user's Supabase account, not from a user-entered arbitrary destination in V1.

### 16.2 Email contents

Daily email contains:

- count of new active matches;
- top fresh active matches;
- score/verdict;
- company/location;
- salary where supplied;
- active/closing-soon status;
- direct CareerOS link to the Job Board;
- source/apply link where safe.

If there are no qualifying new jobs, V1 sends no empty daily email.

### 16.3 Toggle

`email_alerts_enabled = false` stops future emails but leaves automatic discovery and in-app shortlist active.

## 17. Error handling and trust rules

CareerOS must prefer truthful incompleteness over invented certainty.

Rules:

- Missing data remains unknown.
- Provider failure is shown in refresh status and audit data.
- A blocked source is not treated as expired.
- A source URL must be safe `http`/`https` before rendering.
- A partial or unreliable description is not automatically scored as if complete.
- External-source labels preserve provenance.
- Feed/provider credentials are never exposed to the browser.
- A failed daily refresh must not delete previously discovered jobs.
- A failed email must not roll back successfully persisted job discovery results.

## 18. Source-specific destination searches

Create small pure functions for each main-site destination so query-building is testable independently:

- LinkedIn
- Indeed
- Reed
- Totaljobs
- Glassdoor

Each function accepts a normalised search intent and returns a safe main-site URL. Provider URL formats can change, so adapters must be isolated and covered by tests rather than spread through UI components.

## 19. Testing strategy

### 19.1 Unit tests

Cover:

- preference derivation and manual override preservation;
- destination search URL builders;
- provider normalisation;
- safe URL validation;
- dedupe-key generation;
- source merge and preferred apply URL selection;
- active-status classification;
- filter behaviour;
- sort behaviour;
- shortlist ranking;
- email toggle and no-empty-email rule;
- discovery idempotency;
- score reuse through `runScan`.

### 19.2 Database/RLS tests

Verify:

- one user cannot read another user's preferences/jobs/runs;
- authenticated users can edit only allowed user-state/preferences rows;
- discovery server writes work through service role;
- scheduled run uniqueness prevents duplicate daily email dispatch.

### 19.3 Route/integration tests

Verify:

- `/job-board` is auth protected;
- desktop navigation contains Job Board;
- mobile More contains Job Board;
- filters alter visible results correctly;
- archived jobs are excluded from default view;
- Analyse role creates a normal CareerOS job/scan path;
- extraction-blocked capture offers paste fallback;
- email toggle persists.

### 19.4 Server tests

Mock provider and email services. Verify:

- one provider failure yields a partial run and keeps other provider results;
- scheduled retry is idempotent;
- 403/429 status checks become uncertain;
- 404/410 can expire a direct-source vacancy;
- background scoring skips descriptions below the reliability threshold;
- failed email does not fail persisted discovery data.

### 19.5 Build and deployment verification

Before QA:

- `npm test`
- `npm run lint`
- Cloudflare-targeted production build
- scheduled-handler local test
- staging deployment

Authenticated QA must then cover preference editing, external searches, capture fallback, automatic-feed results when configured, filters, scoring, save state, archiving, persistence, manual refresh and email toggle.

## 20. Deployment and credentials

The branch may deploy to staging before provider/email credentials are configured. In that state:

- the Job Board UI, preferences, destination searches, capture, filters and stored discovery data can still be tested;
- automatic provider cards show unconfigured status;
- scheduled refresh records provider-unconfigured state without pretending jobs were fetched;
- email shows unconfigured state and does not pretend a message was sent.

Production enablement of automatic discovery/email requires the relevant Cloudflare secrets and verified email sender configuration.

## 21. Migration from the rejected manual Job Board implementation

The earlier `feature/structured-job-board-v1` implementation is not the source of truth for this feature and must not be merged into `main` as-is.

Useful concepts may be reimplemented selectively, including safe source URLs, structured job-to-`JobRecord` conversion and reuse of `runScan`, but the new feature branch starts from `main` and follows this design.

The previous manual add-job form is not the primary Job Board experience. Manual paste remains only as a safe capture fallback when a source blocks reliable extraction.

## 22. Documentation references

- Cloudflare TanStack Start custom entry point and Cron Trigger guidance: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Adzuna job search API: https://developer.adzuna.com/docs/search
- Resend on Cloudflare: https://resend.com/cloudflare

## 23. Release gate

This feature remains on a draft feature branch until all of the following pass:

- unit/integration tests;
- lint/build;
- database migration/RLS validation;
- authenticated desktop staging smoke;
- authenticated mobile staging smoke;
- at least one real permitted provider test when credentials are configured;
- real external destination search checks;
- capture test from a protected source demonstrating safe fallback;
- active-status test for Active, Expired and Status Uncertain;
- email on/off behaviour test once mail credentials are configured.

Only then should the feature PR be considered for merge into `main`.

# CareerOS Job Board Design

Date: 22 August 2026

## Goal

Add a live Job Board to CareerOS that discovers active vacancies, filters them around Vinnie's career direction and preferences, and hands selected roles into the existing Job Scan / application workflow without duplicating CareerOS scoring, evidence, CV, cover-letter or application logic.

## Product position

The Job Board becomes the front of the CareerOS funnel:

Career Profile → Job Search Preferences → Live Job Board → Active-vacancy validation → Compatibility preview → Analyse Role → Application workspace → CV / cover letter → Apply → Track.

CareerOS remains evidence-first. Job discovery may suggest roles, but it must never turn inferred fit into a career claim. The existing `runScan()` and evidence-map logic remain authoritative for role compatibility.

## Scope for v1

### Included

- New `/jobs` Job Board route in desktop and mobile navigation.
- Live server-side vacancy retrieval from public, no-key sources:
  - Arbeitnow UK API for UK jobs. Arbeitnow documents that the feed aggregates employer ATS sources and includes remote and visa-sponsorship fields.
  - Remotive public API for global remote jobs. Every displayed Remotive vacancy must visibly identify Remotive as the source and link to the Remotive vacancy URL.
- Canonical vacancy model independent of provider response shape.
- Deduplication across providers by canonical URL first, then normalised company + title + location.
- Active-role freshness guard based on provider availability and posted timestamps. CareerOS must never label a vacancy "active" after a provider stops returning it.
- Job-search preferences persisted in CareerOS cloud state.
- Preferences derived from the Career Profile on first use, with user overrides.
- Default target families covering Product, Project / Delivery, Technology / Innovation, Product Marketing and adjacent digital / MarTech roles.
- Location modes:
  - UK
  - Remote worldwide / remote Europe / remote UK where provider data supports it
  - Visa sponsorship / relocation opportunities where provider data explicitly supports it
- Plain-language fit preview on Job Board using profile keywords only. This is a discovery ranking, not the formal Role Compatibility Score.
- "Analyse role" action that creates or reuses a `JobRecord` and routes the vacancy into the existing Job Scan flow for evidence-backed scoring.
- "Open source" action to view the employer/provider application page.
- Clear provider, posted date, location, remote and visa indicators.
- Loading, partial-provider-failure, empty and retry states.

### Not included in v1

- Auto-apply or application form submission.
- LinkedIn / Indeed scraping.
- Paid job APIs or API-key management.
- Email alerts or scheduled background refresh.
- Invented visa sponsorship. Visa is shown only when explicitly supplied by the provider.
- Replacing Job Scan's evidence-led `runScan()` with Job Board ranking.

## Architecture

### 1. Provider boundary

Create a small server-side provider layer. Each provider adapter returns `DiscoveredJob[]` with the same canonical fields. Provider failures are isolated, so one unavailable source does not blank the whole board.

Initial adapters:

- `arbeitnow-uk`: `https://www.arbeitnow.co.uk/api/job-board-api`
- `remotive`: `https://remotive.com/api/remote-jobs`

The UI never consumes provider-specific response objects directly.

### 2. Canonical model

`DiscoveredJob` contains:

- `id`
- `provider`
- `providerLabel`
- `providerJobId`
- `title`
- `company`
- `location`
- `remote`
- `remoteRegion`
- `visaSponsorship`
- `employmentType`
- `salary`
- `description`
- `tags`
- `sourceUrl`
- `postedAt`
- `fetchedAt`

`JobSearchPreferences` contains:

- `keywords: string[]`
- `roleFamilies: string[]`
- `locations: string[]`
- `includeRemote: boolean`
- `includeVisaSponsorship: boolean`
- `includeRelocation: boolean`
- `maxAgeDays: number`

Preferences live in `settings.jobSearchPreferences` so the existing cloud snapshot persists them without a new database table.

### 3. Discovery ranking

Job Board ranking is intentionally lightweight and transparent. It compares the job title / tags / description against:

- preference keywords and role families
- approved Career Profile skills and tools
- profile domains

It produces `discoveryScore` and short `matchReasons`. It does not read `Needs Evidence`, `Conflict` or `Excluded` profile items as affirmative evidence and it does not present itself as the formal compatibility score.

### 4. Analyse handoff

When the user clicks "Analyse role", the Job Board transforms the discovered vacancy into the existing `JobRecord` shape and navigates to `/job-scan` with a new query parameter containing a discovered-job key. The Job Scan route reads that key from session storage, prefills company, title, location, URL and description, then runs the existing user-controlled Analyse Role action. This avoids changing `runScan()` or the application workflow.

A discovered role is not automatically added to Applications. It only becomes an application through the current post-scan action.

### 5. Persistence and migration

`Settings.jobSearchPreferences` is optional at the type boundary. Seed data includes defaults derived from the current career direction. `normaliseData()` deep-merges stored preference values over current defaults so older cloud snapshots remain valid.

No new Supabase table or RLS policy is required for v1.

## UX

The Job Board route contains:

1. Header with refresh action and result count.
2. Compact preference panel with role-family chips, keyword input, UK / remote / visa toggles and age filter.
3. Results list sorted by discovery score, then recency.
4. Each vacancy card shows title, company, location, provider, posted age, remote / visa indicators, discovery match reasons, and two actions: `Analyse role` and `Open source`.
5. Remotive cards display `Source: Remotive` and always link to the Remotive vacancy URL to satisfy attribution requirements.

The interface follows the existing CareerOS panel / pill / button visual language and remains responsive with no horizontal overflow.

## Error handling

- If all providers fail, show one blocking error with Retry.
- If one provider fails, show results from successful providers plus a non-blocking warning naming the unavailable source.
- Invalid provider entries are skipped, not surfaced as broken cards.
- Empty matches show a concise explanation and a `Show broader matches` option that relaxes keyword filtering without changing stored preferences.
- Analyse handoff refuses vacancies with no usable description and directs the user to Job Scan's URL / paste flow instead.

## Security and trust

- Provider fetching happens server-side behind `requireAuthorisedUser()`.
- No user credentials or provider secrets are required for v1.
- All external links use the provider-supplied canonical URL.
- Job Board discovery never writes to Evidence, Career Profile or Applications.
- Career Profile trust boundaries remain unchanged.

## Testing

TDD coverage must prove:

- provider normalisation for Arbeitnow UK and Remotive
- provider failure isolation
- deduplication
- preference filtering and discovery ranking
- legacy settings normalisation
- Job Board empty / loading / partial-failure / results UI
- navigation contains Job Board
- Analyse Role handoff pre-fills Job Scan without auto-creating an application
- Remotive attribution and source link are present

Full repository tests, lint and production Cloudflare build must pass before merge.

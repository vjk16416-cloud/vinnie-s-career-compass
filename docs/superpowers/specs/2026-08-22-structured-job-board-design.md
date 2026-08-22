# Structured Job Board v1 Design

Date: 22 August 2026
Status: Approved design, pending implementation
Owner: CareerOS

## Problem

CareerOS can currently add a job by URL or by pasted job description. Some job sites return HTTP 403 or otherwise block automated server-side extraction. CareerOS correctly falls back to manual paste, but this creates friction, especially on mobile.

The product needs an internal Job Board that works from structured job data already available to CareerOS, rather than depending on scraping protected third-party pages.

## Goal

Add a mobile-friendly Job Board inside CareerOS where structured roles can be stored, searched, saved, analysed and converted into applications without a scraping step.

A Job Board role must feed the existing compatibility and Evidence Map engine using the same trusted CareerOS evidence rules as Job Scan.

## Non-goals

- Do not bypass anti-bot controls or disguise CareerOS as a third-party browser.
- Do not scrape LinkedIn, Indeed or other protected job sites in the background.
- Do not introduce a paid or licensed external jobs provider in v1.
- Do not create a separate job-board backend or new Supabase table in v1.
- Do not remove the existing Job URL and manual-paste Job Scan flow.
- Do not automatically apply to jobs.

## Product behaviour

### Navigation

Add a new `Job Board` destination to the main CareerOS navigation.

On mobile, Job Board should be a primary destination if it can fit without making labels or tap targets unusable. If the fixed mobile navigation would become crowded, place Job Board in the existing More sheet and preserve the current six-slot mobile pattern.

### Job Board listing model

A structured Job Board listing contains:

- `id`
- `title`
- `company`
- `location`
- `description`
- `sourceKind`: `manual`, `imported`, or `feed`
- `sourceName`, when known
- `sourceUrl`, when known
- `applyUrl`, when known
- `salary`, when known
- `workplaceType`, when known
- `employmentType`, when known
- `closingDate`, when known
- `postedAt`, when known
- `importedAt`
- `saved`

The full job description is required before a listing can be analysed. The board must never invent missing salary, location, employer, dates, requirements or source information.

### Source provenance

Every listing displays its source in human-readable form.

If an original source or application URL exists, CareerOS preserves it and exposes an `Open original` or `Apply at source` action. CareerOS must not imply that it owns or originally published a third-party job advert.

### Adding a listing

V1 provides a structured manual/import form inside Job Board. Required fields are role title, company and full job description. Optional fields include location, salary, workplace type, employment type, closing date, source name, original source URL and application URL.

This form is the stable ingestion interface for future source adapters. A future licensed feed or employer-posted job should create the same `JobBoardListing` shape rather than adding source-specific data models to the UI.

### Save behaviour

Each listing has a Save control. Save toggles the listing's `saved` state and persists through the existing CareerOS cloud state mechanism.

The screen can filter between all roles and saved roles.

### Search and filters

V1 supports lightweight client-side filtering over persisted listings:

- free-text search over title, company, location and description
- Saved only
- workplace type when values are available
- employment type when values are available

Filters must be usable on a 320px-wide screen without page-level horizontal scrolling.

### Analyse Role from Job Board

Each valid listing has an `Analyse role` action.

CareerOS converts the listing into a normal `JobRecord`, setting:

- `sourceType` to `board`
- `description` to the listing's stored full description
- `url` to `sourceUrl` or `applyUrl` when available
- `extractionCompleteness` to `complete`
- `extractionMethod` to `structured`
- `descriptionWordCount` from the stored description
- `boardListingId` to the listing ID

CareerOS then calls the existing `runScan` compatibility engine. The Job Board must not implement a separate scoring algorithm.

The resulting job and scan are persisted in the existing `jobs` and `scans` collections. The listing shows the latest compatibility score and verdict associated with that listing.

Running analysis again creates a new job/scan snapshot so historical results are not silently mutated.

### Create application

A listing may create an application only after it has a persisted scan result.

`Create application` uses the latest analysed JobRecord and ScanResult for that listing and creates the same Application shape used by the existing Job Scan flow, including compatibility score, source/application URL, salary and deadline where known.

If no analysis exists yet, the UI directs the user to Analyse role first rather than creating a partially evaluated application.

After application creation, navigate to the new application's workspace.

### Existing Job Scan

The existing `/job-scan` route remains unchanged in purpose:

- URL extraction when permitted
- safe fallback on HTTP 403 or unreliable extraction
- manual paste
- editable extracted details
- Analyse Role

The new Job Board is an additional structured-data path, not a replacement for Job Scan.

## Data architecture

Extend `CareerOsData` with `jobBoardListings: JobBoardListing[]`.

Because CareerOS currently persists the complete CareerOS state snapshot through its Supabase repository, v1 stores Job Board listings inside that existing snapshot. No new database table or migration is required for the first release.

`createCareerOsData()` and compatibility/bootstrap logic must default missing `jobBoardListings` to an empty array so older saved CareerOS snapshots continue to load safely.

Extend `JobRecord.sourceType` from `url | paste` to `url | paste | board` and add optional `boardListingId`.

Do not change the scoring evidence rules or approval/reviewer rules.

## Components and boundaries

### `src/lib/careeros/job-board.ts`

Owns pure Job Board domain functions:

- create/normalise a `JobBoardListing`
- convert a listing to `JobRecord`
- find the latest scan for a listing
- derive distinct filter values
- filter/search listings

These functions must be independently unit tested.

### `src/routes/job-board.tsx`

Owns the Job Board page UI and orchestration only:

- list and filter persisted listings
- structured add/import form
- Save toggle
- source/apply links
- call domain conversion plus existing `runScan`
- persist resulting jobs/scans
- create application from the latest analysis

The route must not duplicate the compatibility algorithm.

### `src/components/careeros/app-shell.tsx`

Adds Job Board navigation while preserving the current mobile navigation constraints.

### Existing Job Scan

No extraction behaviour should be weakened. If small shared helpers are needed for application creation, they may be extracted only when doing so reduces duplication without changing existing behaviour.

## Error handling and trust rules

- A listing with fewer than 40 description words cannot be analysed, matching current Job Scan minimum input safety.
- Required title/company/description fields receive clear inline or toast feedback.
- A malformed source URL does not block saving the listing, but it must not render as a clickable source link until valid.
- An external source returning 403 does not cause Job Board to scrape or retry through circumvention.
- A failed cloud save follows the existing CareerOS store rollback behaviour.
- A failed scan leaves the listing intact and shows an explicit error.
- Creating an application without a current analysed job/scan is blocked.

## Accessibility and mobile requirements

- No page-level horizontal overflow at 320px, 375px, 768px or desktop widths.
- Primary buttons must satisfy WCAG 2.2 AA target-size requirements.
- Filters and forms use labels, not placeholder-only identification.
- Job cards maintain readable source, score and action hierarchy on narrow screens.
- Keyboard users can reach Save, Analyse role, source/apply actions and Create application.

## Testing

Implementation is test-driven.

Required automated coverage:

1. Job Board listing type/backward-compatible data default.
2. Listing-to-JobRecord conversion preserves description and provenance and uses `sourceType: board`.
3. Search and saved/filter behaviour.
4. Analyse role persists a new job and scan and uses existing compatibility scoring.
5. Latest score/verdict is associated with the correct listing.
6. Create application is blocked before analysis.
7. Create application after analysis preserves compatibility score, URLs, salary and deadline.
8. Save state persists through CareerOS data updates.
9. Navigation exposes Job Board on desktop and through a usable mobile route.
10. Existing Job Scan regression tests continue to pass, including 403/manual fallback behaviour.
11. Full test suite, lint and production Cloudflare-targeted build pass.
12. Live Cloudflare preview smoke test checks signed-out route protection and responsive public shell. Authenticated private testing remains a separate release proof when user credentials are required.

## Future adapters

V1 intentionally defines an adapter-ready listing shape without selecting a provider.

Later sources may include:

- employer-direct postings
- licensed job APIs or feeds
- browser/mobile Share to CareerOS
- approved import files

Every future adapter must return the same structured listing contract, retain provenance, respect provider terms and avoid anti-bot circumvention.

## Success criteria

The feature is ready for merge when a user can create a structured role in Job Board, save/filter it, analyse it without any network scrape, see the compatibility result, create an application from the analysed role, open the original/apply link when provided, and all existing CareerOS trust, persistence and build tests remain green.
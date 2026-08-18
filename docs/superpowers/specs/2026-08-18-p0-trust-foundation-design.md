# CareerOS P0 Trust Foundation Design

Date: 2026-08-18
Status: Approved design, pending implementation plan
Branch: `agent/p0-trust-foundation`
Base: `main` at `86a4a5e0f8a402748ff7fc07a88bac98c56174e8`

## 1. Purpose

This work fixes the production trust gaps identified in the CTO UI and UX review before further visual polish.

The P0 programme has four outcomes:

1. Google-only authentication fails clearly and safely when external provider configuration is incomplete.
2. Supabase becomes the authoritative store for CareerOS career data, with a one-time migration from the current browser-local state.
3. Career Profile review decisions become actionable and control generator eligibility, using the evidence review model already developed on PR #11 but ported onto current `main` rather than merging the stale branch blindly.
4. CV health-check suggestions can never claim to be applied unless CareerOS has actually produced a revised CV body.

The primary product principle is trust: the interface must never imply that data is safely persisted, evidence is approved, or a document was revised when the underlying system has not actually done so.

## 2. Scope

### In scope

- Google OAuth initiation error handling and setup-state messaging.
- Supabase cloud persistence for the complete `CareerOsData` state.
- One-time browser-local to cloud migration after the first successful authenticated session.
- RLS protection so each authenticated user can access only their own CareerOS state.
- A repository/service boundary between UI state and persistence.
- Explicit sync and offline state in the UI.
- Porting PR #11 profile-item approval, exclusion, needs-evidence, conflict resolution and decision history onto current `main`.
- Persisting those review decisions in cloud state.
- Fixing the misleading CV health-check apply-suggestions interaction.
- Regression tests, migration tests and production-build verification.

### Out of scope

- Normalising every CareerOS object into separate Supabase tables.
- Deleting or repurposing the existing `profiles`, `employment_roles`, `knowledge_items`, `evidence_items`, `applications`, `resume_versions`, or `knowledge_update_proposals` tables.
- Multi-user collaboration, organisations, teams, sharing or roles.
- Offline editing and conflict resolution.
- Rebuilding the broader UI or application workspace information architecture.
- Google Cloud OAuth client creation itself. External Google and Supabase provider settings remain an operational prerequisite.
- Merging PR #11 directly.

## 3. Architectural choice

### Recommended approach: one authoritative state row per user

Add a dedicated Supabase table named `career_state` containing one versioned JSON document per authenticated user.

This is intentionally simpler than mapping the full existing `CareerOsData` graph into many relational tables. CareerOS is currently a one-user application with a mature in-memory data model and many cross-linked objects. A single transactional state document reduces migration risk and lets the current application move to reliable cross-device persistence without rewriting every feature at once.

The existing normalised Supabase tables remain untouched for future domain-specific migration.

### Rejected alternative: full table-by-table migration now

This is cleaner as a final architecture but creates a much larger P0 change. It would require mapping IDs, histories, profile variants, evidence provenance, scans, CV versions, cover letters, activity and application fields across multiple schemas. It increases the risk of data loss and inconsistent behaviour during a trust-focused release.

### Rejected alternative: hybrid dual-write

Writing some CareerOS records to relational tables and also saving the full local state would create two competing sources of truth. The P0 release must have one clear authority.

## 4. Supabase state model

Create:

```sql
create table public.career_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Enable RLS.

Policies must allow an authenticated user to select, insert and update only the row whose `user_id = auth.uid()`.

No anonymous access is permitted.

The migration will add a database trigger that sets `updated_at = now()` on every update. Application code does not need to manage that timestamp manually.

The design does not require database-side JSON validation beyond `NOT NULL`; application schema validation remains in the CareerOS normalisation layer.

## 5. Persistence boundary

Introduce a focused persistence module rather than calling Supabase throughout components.

Required responsibilities:

- `loadCareerState(userId)`
- `createCareerState(userId, data, schemaVersion)`
- `saveCareerState(userId, data, schemaVersion)`
- serialisation and normalisation at the boundary
- mapping Supabase failures into small application-level error types

A missing row is represented as a successful load with no state, not as an exceptional failure.

The React store remains the UI-facing state API. Components should not know whether state came from local cache, migration, or Supabase.

The provider will expose sync metadata in addition to `data`, with equivalent semantics to:

- `hydrating`
- `synced`
- `offlineCache`
- `saving`
- `saveError`

Exact property names may change during implementation, but the state machine must remain explicit and testable.

## 6. Source-of-truth rules

After authentication, Supabase is authoritative.

### Case A: cloud state exists

1. Load the cloud row.
2. Normalise it through the existing CareerOS migration/foundation functions.
3. Populate the React store from cloud.
4. Refresh localStorage as a cache copy.
5. Never replace cloud state with an older browser copy merely because localStorage exists.

### Case B: cloud state does not exist and local CareerOS state exists

1. Read localStorage key `careeros:v1`.
2. Parse, normalise and apply the master-profile foundation.
3. Insert the result into `career_state` for the authenticated user.
4. Read back the created row and confirm the successful cloud write.
5. Mark cloud as authoritative.
6. Retain localStorage only as a cache.

This import occurs once because subsequent sessions find the cloud row and follow Case A.

### Case C: neither cloud nor local state exists

1. Create the current seeded CareerOS data.
2. Normalise it.
3. Insert it into `career_state`.
4. Read back the created row.
5. Use that row as the authoritative initial state.

### Case D: cloud read fails

CareerOS may display the last valid local cache with a visible offline/degraded status, but the interface must not silently behave as if it is fully synced.

For the P0 release, editing while in offline-cache mode is disabled. This is deliberate. It prevents divergent local writes that might later overwrite newer cloud state.

The user should see plain-English messaging such as: `Cloud data is temporarily unavailable. You can view the last saved copy, but changes are disabled until sync returns.`

If no valid cache exists, show a blocking cloud-unavailable state rather than silently creating seed data locally.

### Case E: cloud save fails after an edit

Every edit is optimistic only until the cloud confirms it.

The provider keeps the previous confirmed cloud snapshot. If a save fails:

1. Roll the React store back to the previous confirmed snapshot.
2. Do not update localStorage with the failed version.
3. Show a concise error such as `That change was not saved. Please try again.`
4. Return the sync state to the last confirmed state, with an error indicator until the user dismisses it or a later successful save clears it.

This deterministic rollback rule avoids ambiguous unsaved data and divergent browser state.

## 7. Write strategy

P0 favours correctness over aggressive optimisation.

All user mutations go through one ordered promise queue owned by the persistence/store layer.

For each queued mutation:

1. Apply the mutation optimistically to the current confirmed or pending snapshot.
2. Save the resulting complete `CareerOsData` document to Supabase.
3. On success, make that snapshot the new confirmed state and refresh localStorage.
4. On failure, roll back to the previously confirmed snapshot as defined in Case E.

The next queued mutation must not start its cloud write until the previous write has resolved. This prevents an older snapshot from finishing after a newer one and becoming authoritative.

Approval/status actions save immediately. Existing text-entry interactions that commit on blur continue to produce one queued save per committed field change. No additional debounce layer is required for P0.

## 8. Google-only authentication readiness

The current UI correctly offers only Google sign-in. The remaining external blocker is that Supabase reports `Unsupported provider: provider is not enabled` until the Google provider has been enabled with a valid OAuth Client ID and Client Secret.

Application changes will:

- continue offering one `Sign in with Google` action only;
- map provider-disabled and equivalent OAuth-initiation failures to a friendly CareerOS message rather than exposing raw provider JSON;
- keep unauthorised-account handling separate from provider-configuration failures;
- preserve the existing approved-account restriction;
- retain safe callback and `returnTo` handling;
- never expose provider secrets in browser-visible configuration or repository content.

Operational prerequisite outside this codebase:

- Google OAuth Web client exists;
- Supabase Authentication > Providers > Google is enabled;
- Client ID and Client Secret are configured in Supabase;
- Supabase callback URI is authorised in Google;
- CareerOS production callback URL is allowed by Supabase URL configuration.

The application cannot mark Google authentication as operational until an end-to-end sign-in has been manually confirmed.

## 9. Profile governance and PR #11 port

PR #11 contains the desired evidence review behaviour but is based on an older repository state and is no longer safe to merge directly.

Port the feature concept and tested logic onto the P0 branch from current `main`.

Required behaviour:

- profile items can be explicitly marked Approved;
- profile items can be marked Needs Evidence;
- profile items can be Excluded;
- conflicting claim variants can be resolved by selecting one wording;
- all source variants and provenance remain preserved;
- conflict resolution creates or updates deterministic approved resolved items rather than duplicating them;
- each user decision creates a decision-history entry;
- generated CV and cover-letter content remains gated by approved profile items and verified evidence;
- unresolved and excluded wording remains blocked;
- no decision occurs silently.

The UI will make the review queue actionable on the Career Profile page and favour human-readable labels over raw canonical keys where possible. Provenance IDs remain available as supporting detail.

All review decisions persist inside the cloud-backed `CareerOsData` document.

## 10. CV health-check trust fix

Current behaviour is incorrect: `Approve suggestions and save new version` appends suggestion text and an HTML-style review marker into the CV body. That is not the same as applying the suggestions.

P0 behaviour is deliberately conservative:

- remove the current `applySuggestions` mutation path;
- remove the `Approve suggestions and save new version` action;
- keep health-check suggestions as review guidance only;
- do not create a new CV version merely because the user viewed or acknowledged guidance;
- never append internal review notes to the CV document body;
- keep the existing explicit `New draft` generator action as the only automated way to produce another CV body in P0;
- keep CV approval as a separate explicit action;
- keep previous CV versions immutable and visible in history.

No P0 control may claim that a health-check suggestion was applied. A later feature can implement evidence-aware per-suggestion rewriting with its own design and tests.

A regression test must prove that opening, reviewing or closing health-check guidance cannot contaminate the CV body or create a false revised version.

## 11. UI trust indicators

The shell must stop claiming `Local seeded data` after cloud persistence is active.

Replace the existing static data-source footer with a truthful state indicator, for example:

- `Cloud synced`
- `Saving...`
- `Cloud unavailable: viewing cached copy`
- `Setup required` where authentication configuration prevents sign-in

Status must be communicated in text, not colour alone.

In `offlineCache` mode, mutation controls are disabled at the store or shared UI boundary so individual feature screens cannot accidentally accept edits.

No large redesign is required for P0.

## 12. Error handling

Errors are divided into four user-relevant classes:

### Authentication setup error

Google provider or redirect configuration is incomplete. Show a friendly retry/setup message without secret or raw platform details.

### Unauthorised account

Authentication completed, but the Google account is not the approved CareerOS identity. Sign out the session and show the existing unauthorised message.

### Cloud read failure

Show cached state read-only when available. Do not accept edits. If no cache exists, block the workspace with a retryable cloud-unavailable state.

### Cloud write failure

Roll back to the last confirmed state, explain that the attempted change was not saved, and leave localStorage unchanged. Never silently report success.

Technical details may be logged for diagnostics, but user-facing messages remain concise.

## 13. Data migration and compatibility

The cloud JSON includes a `schema_version` column plus the complete existing `CareerOsData` payload.

The existing normalisation and master-profile foundation functions remain responsible for upgrading older payloads.

The migration process must be idempotent:

- running bootstrap repeatedly after successful migration does not create duplicates;
- local cache never overwrites an existing cloud row during bootstrap;
- an invalid local cache falls back to seed only when there is no valid cloud state;
- a valid cloud payload always takes precedence over local cache.

No existing localStorage data is deleted automatically in P0. It remains a cache and recovery aid, but not an authority.

## 14. Security

- RLS enabled on `career_state`.
- User-owned row access constrained to `auth.uid()`.
- No service-role key in client code.
- Existing public Supabase URL and publishable key remain acceptable browser configuration.
- Google Client Secret remains only in Supabase provider configuration.
- Authorisation policy remains limited to the approved account.
- Application routes remain fail-closed when session lookup errors.

## 15. Testing strategy

Implementation uses test-driven development.

Required automated coverage:

### Cloud repository

- load existing state;
- load missing row as a non-error result;
- create first state;
- update state;
- map read/write failures;
- reject or safely handle malformed payloads.

### Bootstrap migration

- cloud existing + local existing -> cloud wins;
- cloud absent + local valid -> local migrates once;
- cloud absent + local absent -> seed uploads once;
- cloud absent + local invalid -> seed uploads safely;
- cloud unavailable + cache valid -> read-only cached mode;
- cloud unavailable + no cache -> blocking retry state;
- repeated bootstrap is idempotent.

### Store persistence

- confirmed mutations persist to cloud;
- successful cloud saves refresh local cache;
- failed saves roll back to the previous confirmed snapshot;
- failed saves do not update local cache;
- ordered write queue prevents stale overwrites;
- offline-cache mode rejects mutation attempts.

### Profile governance

Port the decision-layer and generator-boundary regression coverage from PR #11 onto current `main`.

### CV health check

- opening and reviewing suggestions does not mutate the CV body;
- no false new version is created from health-check guidance;
- document versions remain intact;
- approval remains explicit.

### Authentication

- provider-disabled failure maps to friendly UI text;
- password/magic-link fields remain absent;
- unauthorised account behaviour remains separate.

## 16. Verification gates

Before a P0 implementation PR is considered ready:

1. All targeted and existing tests pass.
2. P0 changed files pass ESLint and Prettier.
3. Production Vite/Nitro build passes.
4. Supabase migration is applied successfully and security advisors are checked.
5. RLS policies are verified against authenticated-user access semantics.
6. Published CareerOS build is confirmed to use the new commit.
7. Manual Google OAuth end-to-end test succeeds after provider configuration is completed externally.
8. Manual cross-session persistence test confirms the same cloud state is loaded in a fresh browser session.
9. Manual profile decision test confirms approval changes generator eligibility.
10. Manual CV health-check test confirms no internal review notes enter the CV body.

Repository-wide lint failures caused solely by pre-existing Lovable-generated formatting debt must be reported separately rather than misrepresented as P0 failures. Changed files themselves must be clean.

## 17. Rollout sequence

Implementation is decomposed into independently verifiable stages on the same P0 branch:

1. Add Supabase migration and cloud-state repository with tests.
2. Replace localStorage authority with authenticated cloud bootstrap and safe cache semantics.
3. Add sync-state UI and friendly auth setup errors.
4. Port PR #11 profile review/governance logic onto current `main`.
5. Remove misleading CV health-check mutation semantics and add regression tests.
6. Run full verification.
7. Publish a preview or production build only after verification.
8. Complete manual Google OAuth and cross-session tests.

No stage may silently merge PR #11 or overwrite existing production data.

## 18. Acceptance criteria

The P0 programme is complete when all of the following are true:

- A successful Google-authenticated CareerOS session loads durable state from Supabase.
- Existing browser-local state is migrated automatically exactly once when no cloud state exists.
- A later browser or session loads the same cloud state without depending on the original localStorage.
- Cloud failure is visibly degraded and cannot silently create divergent local edits.
- Failed cloud saves roll back instead of appearing durable.
- Google provider setup failures are shown as friendly CareerOS errors, not raw platform JSON.
- Profile conflicts and attention items are actionable and every decision is explicit and persistent.
- Unapproved claims remain blocked from generated documents.
- CV health-check suggestions never contaminate a CV body, create a false version, or claim to have been applied.
- The shell truthfully reports sync/source status.
- Automated verification and the required manual trust checks pass.

## 19. Future direction

Once the P0 trust foundation is stable, individual domains can move from the JSON state document into the existing normalised Supabase tables when there is a concrete product need such as reporting, external integrations, collaboration, or server-side querying. That later migration can be incremental because the P0 release establishes a single reliable cloud authority first.

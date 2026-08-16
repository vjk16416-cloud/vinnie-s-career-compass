# Vinnie CareerOS Profile Import Audit

Date: 2026-08-16

Target Supabase project: `careeros-production`

Project ref: `gieehxdyzcrrmgxnfsxs`

Target account email: `vjk16416@gmail.com`

Import asset: `scripts/migrate-vinnie-data.ts`

## Current state

The canonical migration asset is prepared, deterministic and verified in CI. The production import has **not** been executed yet because the dedicated Supabase project does not currently contain an Auth user for `vjk16416@gmail.com`.

Career data must not be inserted against an invented user UUID or by writing directly to `auth.users`. The account must first be created through the supported Supabase Auth flow. The migration script then verifies that `CAREEROS_USER_ID` belongs to `vjk16416@gmail.com` before it writes any data.

## Source hierarchy used

Google Drive Career OS records were treated as the career-data source of truth. GitHub remains the source of truth for application code. The migration snapshot uses these canonical Drive records:

- Master Career Profile: `154AAI-KiLDpoZPDRmzX6UUn9n6niXHyeg1r09lWqs7c`
- Evidence Bank: `1RQC10S4I3LulysK6mkyTQmtc8EZ4BK8ENjVyKByelo4`
- Metrics Register: `1-nTmLGW90RB6SU-Vwn16-pXz7-I8Gc9ACNrmXpIV9Vc`
- Education & Certifications Register: `1Is4d-4q-lESLIMF1_C0avEBdmuVeOuhIofDU8SEM0Lw`
- STAR Evidence Bank: `164cKHi_68FAgWKt3b00uyAwfN3tw-LFCECtmQoMrbtQ`
- CV Library Index & Style Rules: `1plzPRS7F0LGCWTvaxdUsSQ-B7HPcaOdfu_npfn4PqwY`

The three current role-family master CVs are preserved as reference pointers only:

- BlackRock, Product / Product Management: `1ZnzOJLfcwCYlTlG3ekpi3fr4f2PSK8k5`
- Teya, Product / Junior Product Manager: `1hU-SE6kV-ysl-4lefvzUMmg7bcacTR3Q`
- Reply, Project / PMO / Delivery: `1aFC9hCV-MUor0--zyUI5qsg9OaJYdEdE`

CV text is not treated as independent proof of a claim or metric.

## Canonical chronology

Five employment roles are prepared for import:

1. Northeastern University London, Performance Marketing Manager, Contract, June 2025 to November 2025.
2. IDEA StatiCa UK, Marketing & Operations Executive, Contract, September 2023 to June 2024.
3. Buchanan Staffing Group, Senior Digital Marketing Executive, Contract, February 2023 to May 2023.
4. National Autistic Society, Digital Advertising Officer, April 2022 to February 2023.
5. Infinite Entertainment UK, Senior Digital Marketing Executive, June 2016 to April 2022.

Dates are stored at month precision using the first day of the month for the database `date` field. No role is marked current in this snapshot.

## Dry-run counts

GitHub Actions run `31939253373` executed `bun run migrate:vinnie:dry-run` successfully and produced:

| Record type | Count |
| --- | ---: |
| Profile | 1 |
| Employment roles | 5 |
| Knowledge Bank items | 62 |
| Evidence records | 62 |
| Applications | 0 |
| Master CV references | 3 |

The same CI run passed 45 automated tests, lint with zero errors, and the production build.

## Knowledge Bank status audit

The 62 Knowledge Bank items are deliberately conservative:

| Status | Count | Migration meaning |
| --- | ---: | --- |
| `verified` | 2 | Supported as verified by the canonical evidence set. This includes the APM PFQ and the explicit no-formal-line-management boundary. |
| `user_confirmed` | 28 | Canonical qualitative career facts, STAR stories, projects and confirmed education facts. |
| `imported_cv` | 3 | Training currently listed in CVs but lacking primary certificate evidence in the narrowed source set. |
| `needs_verification` | 19 | Evidence-sensitive metrics or qualifications that require a primary source before stronger use. |
| `excluded` | 10 | Conflicting, causal, or otherwise unsafe exact metrics that must not be used as resume facts. |

No item is promoted to `verified` merely because it appears in a CV.

## Evidence-sensitive examples

Examples deliberately kept out of verified status include:

- `£140k+ annual digital media budget`, `needs_verification`.
- `40%+ uplift in qualified leads`, `needs_verification`.
- `25% project-completion improvement`, `excluded` because older records conflict.
- `20% or 25% time-to-fill reduction`, `excluded` because versions conflict.
- `23% or 42% donor-base increase`, `excluded` because versions conflict.
- the full Google Project Management Professional Certificate, `needs_verification` because the Education & Certifications Register records conflicting evidence.

The APM Project Fundamentals Qualification is prepared as `verified`.

## Deliberately not migrated

- The GitHub seed's Monzo application is not migrated. No canonical current Drive application record was found for it, so it is treated as seeded/demo application data rather than real history.
- The stale GitHub seeded chronology is not used where it conflicts with the canonical Drive records. In particular, Northeastern University London ends in November 2025 rather than being marked current.
- Obsolete or superseded master CVs are not recreated.
- Unsupported metrics are not converted into resume-ready evidence.
- No passwords, service-role keys, or other secrets are stored in this audit or the migration asset.

## Idempotence and safety

The migration uses deterministic UUIDs derived from stable source identifiers. Automated tests prove repeated transformation runs produce identical IDs and no duplicate logical records.

The production command performs the upsert twice and then checks exact per-user row counts. A count mismatch fails the migration.

The script requires these server-side variables for a production run:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CAREEROS_USER_ID
```

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser or committed to GitHub.

Before writing, the script calls the Supabase Auth admin API for `CAREEROS_USER_ID` and refuses to run unless that UUID belongs to `vjk16416@gmail.com`.

## Remaining production gate

As of this audit, querying `auth.users` in `careeros-production` for `vjk16416@gmail.com` returned no user.

Required sequence before Task 8 can be marked complete:

1. Create the `vjk16416@gmail.com` account through the supported Supabase Auth flow.
2. Obtain its Auth user UUID.
3. Run the one-time migration with the server-side service-role key and that UUID.
4. Run the migration a second time through the scripted idempotence check.
5. Confirm the exact counts above in production.
6. Sign in as Vinnie and confirm the records are visible.
7. Create a separate test user and prove that user sees zero Vinnie records through the RLS-protected application/data-access path.

Until those checks are complete, the migration is **prepared and verified, but not imported to production**.

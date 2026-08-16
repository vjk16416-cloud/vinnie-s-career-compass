# CareerOS Independent Web Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move CareerOS to an independently owned web architecture using GitHub, a dedicated Supabase backend and Cloudflare deployment, while retaining Lovable only as an optional editor and preserving the current application during migration.

**Architecture:** Keep the existing TanStack Start application and migrate rather than rebuild it. GitHub remains the permanent code source, a new directly owned Supabase project becomes the authentication and user-data backend, and Cloudflare becomes the production host. User-owned career data is isolated by Supabase Row Level Security, with a structured Career Knowledge Bank feeding job analysis and resume refinement. Lovable remains connected to GitHub only as an optional editor and preview environment.

**Tech Stack:** React 19, TanStack Start, TanStack Router, TypeScript, Vite, Bun, Supabase Auth/Postgres/RLS, Cloudflare, GitHub, Vitest, Testing Library.

## Global Constraints

- Web app first. Mobile app is a later phase and must reuse the same Supabase backend.
- Preserve the current CareerOS interface and working features unless a migration change requires otherwise.
- Do not delete or disable the current Lovable version until the independent deployment is verified.
- Lovable may remain connected to GitHub, but production authentication, production data and production hosting must not require Lovable credits.
- Use a new dedicated Supabase project owned directly by the user for CareerOS.
- Initial account is `vjk16416@gmail.com`, but the architecture must support additional users without redesigning authentication.
- Every user-owned row must be tied to `auth.uid()` and protected by RLS.
- Never authorise from user-editable metadata.
- Never expose a Supabase secret or service-role key to browser code.
- CareerOS must never mix career data between users.
- Resume content may use only that user's own supported career information.
- Each employment role in a refined resume must contain 3 to 5 bullets.
- Resume bullets should use STAR/CAR thinking and must not invent missing results or metrics.
- If evidence is weak, CareerOS must explain why stronger evidence would help and allow the user to strengthen, use as-is or exclude the point.
- Resume edits may suggest Knowledge Bank changes, but the user must approve them before the Knowledge Bank is updated.
- Use British English in application copy and documentation.
- Do not use em dashes.
- Follow test-driven development and commit each independently reviewable task.

---

## File and subsystem map

### Existing files expected to remain central

- `src/routes/__root.tsx`: root application shell and top-level route protection.
- `src/integrations/supabase/client.ts`: current generated Supabase client to be replaced with an independent project client.
- `src/lib/careeros/store.tsx`: current CareerOS state layer, to be progressively redirected from local/seeded storage to repository-backed Supabase data.
- `src/components/careeros/app-shell.tsx`: signed-in shell and navigation.
- `vite.config.ts`: currently depends on `@lovable.dev/vite-tanstack-config`; migration must remove production dependence on this package.
- `package.json`: scripts and dependency cleanup.

### New focused modules

- `src/lib/auth/`: authentication, session and route-authorisation code.
- `src/lib/careeros/repositories/`: typed data access for profiles, roles, Knowledge Bank, evidence and resume versions.
- `src/lib/careeros/knowledge/`: Knowledge Bank domain types and update-proposal logic.
- `src/lib/careeros/resume/`: STAR/CAR quality checks, 3-to-5 bullet rules and evidence mapping.
- `supabase/migrations/`: production schema and RLS migrations for the dedicated project.
- `src/test/`: shared test setup.
- `wrangler.jsonc`: Cloudflare deployment configuration if required by the final TanStack/Nitro target.

---

### Task 1: Establish an independent build and test baseline

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: reproducible `bun test`, `bun run lint`, `bun run build` quality gates.
- Produces: environment contract `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

- [ ] **Step 1: Add a test harness before migration code**

Run:

```bash
bun add --dev --exact vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create Vitest setup**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    clearMocks: true,
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Make environment handling independent of Lovable**

Create `.env.example`:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Ensure `.gitignore` ignores `.env`, `.env.local` and `.env.*.local`, while retaining `.env.example`.

- [ ] **Step 4: Replace the Lovable Vite wrapper with explicit upstream plugins**

Remove `@lovable.dev/vite-tanstack-config` from `devDependencies` and replace `vite.config.ts` with explicit TanStack Start, React, Tailwind and tsconfig-path plugin configuration matching the currently installed versions. Preserve the existing `src/server.ts` entry and Cloudflare-compatible Nitro target.

The resulting config must not import from `@lovable.dev/*`.

- [ ] **Step 5: Verify baseline**

Run:

```bash
bun test --passWithNoTests
bun run lint
bun run build
```

Expected: all commands exit 0 before continuing.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock vite.config.ts vitest.config.ts src/test/setup.ts .env.example .gitignore
git commit -m "build: remove production Lovable build dependency"
```

---

### Task 2: Create the dedicated Supabase project and project-owned configuration

**External system:** Supabase

**Files:**
- Create: `docs/careeros/supabase-production-config.md`

**Interfaces:**
- Produces: dedicated CareerOS Supabase project reference.
- Produces: project URL and active publishable key for browser configuration.
- Produces: backend used by both future web and mobile clients.

- [ ] **Step 1: Create a new dedicated Supabase project in the user's chosen organisation**

Use the Supabase project creation workflow and choose region `eu-west-2` for London proximity unless the organisation does not offer it, in which case use `eu-west-1`.

Project name:

```text
careeros-production
```

Do not reuse `intentionally-mvp`, `intentionally-staging`, `two-user-todo` or any Lovable-created CareerOS backend.

- [ ] **Step 2: Record non-secret configuration**

Create `docs/careeros/supabase-production-config.md` containing only:

```md
# CareerOS Production Supabase Configuration

Project name: careeeros-production
Purpose: Dedicated CareerOS authentication and application data backend
Region: <actual region selected during project creation>
Project ref: <actual Supabase project ref>
Browser environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Never commit secret or service-role keys.
```

When executing this step, replace the angle-bracket values immediately with the actual returned values before committing. Do not leave placeholders in the committed file.

- [ ] **Step 3: Verify project health and publishable key**

Confirm the project is `ACTIVE_HEALTHY`, retrieve the project URL and retrieve an enabled publishable key.

- [ ] **Step 4: Commit the non-secret project record**

```bash
git add docs/careeros/supabase-production-config.md
git commit -m "docs: record dedicated CareerOS Supabase project"
```

---

### Task 3: Create the multi-user Career Knowledge schema with RLS

**Files:**
- Create: `supabase/migrations/20260816_001_careeros_core.sql`
- Create: `supabase/migrations/20260816_002_careeros_rls.sql`
- Create: `src/integrations/supabase/types.ts` from generated Supabase types after migrations.

**Interfaces:**
- Produces tables: `profiles`, `employment_roles`, `knowledge_items`, `evidence_items`, `applications`, `resume_versions`, `knowledge_update_proposals`.
- All user-owned tables use `user_id uuid not null references auth.users(id) on delete cascade`.

- [ ] **Step 1: Write migration for core tables**

Create `20260816_001_careeros_core.sql` with these exact minimum columns:

```sql
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  location text,
  professional_summary text,
  target_roles text[] not null default '{}',
  target_industries text[] not null default '{}',
  writing_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employment_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer text not null,
  title text not null,
  employment_type text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.knowledge_status as enum (
  'verified',
  'user_confirmed',
  'imported_cv',
  'imported_linkedin',
  'needs_verification',
  'archived',
  'excluded'
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employment_role_id uuid references public.employment_roles(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  star_context text,
  star_action text,
  star_result text,
  metrics jsonb not null default '{}'::jsonb,
  status public.knowledge_status not null default 'needs_verification',
  source_type text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_item_id uuid references public.knowledge_items(id) on delete cascade,
  evidence_type text not null,
  source_reference text,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  job_url text,
  job_description text,
  status text not null default 'interested',
  compatibility_score integer check (compatibility_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  version_number integer not null,
  status text not null default 'draft',
  content jsonb not null,
  evidence_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, application_id, version_number)
);

create table public.knowledge_update_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete cascade,
  knowledge_item_id uuid references public.knowledge_items(id) on delete set null,
  proposed_change jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
```

- [ ] **Step 2: Add indexes**

Add indexes on every `user_id` and on `knowledge_items(employment_role_id)`, `resume_versions(application_id)` and `knowledge_update_proposals(resume_version_id)`.

- [ ] **Step 3: Write RLS migration**

Enable RLS on all seven public tables. For every table, create `select`, `insert`, `update` and `delete` policies for `authenticated` using the ownership pattern:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

For INSERT, use only `with check`. For DELETE, use only `using`.

- [ ] **Step 4: Apply migrations to the dedicated project**

Apply the migrations through the Supabase SQL/migration workflow against the dedicated CareerOS project only.

- [ ] **Step 5: Run Supabase security advisors**

Expected: no missing-RLS or obvious exposed-table ownership issue for these tables.

- [ ] **Step 6: Generate TypeScript database types**

Generate types from the dedicated project and replace `src/integrations/supabase/types.ts` with generated output.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations src/integrations/supabase/types.ts
git commit -m "feat: add multi-user CareerOS data model and RLS"
```

---

### Task 4: Replace Lovable-managed Supabase wiring with dedicated-project auth

**Files:**
- Modify: `src/integrations/supabase/client.ts`
- Create: `src/lib/auth/auth-context.tsx`
- Create: `src/lib/auth/auth-context.test.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/components/careeros/app-shell.tsx`

**Interfaces:**
- Produces: `useAuth()` returning `{ user, loading, signIn, signOut }`.
- Security boundary: authenticated Supabase user plus database RLS.

- [ ] **Step 1: Write failing auth tests**

Test:

```ts
it("blocks unauthenticated CareerOS content", ...)
it("restores a valid Supabase session", ...)
it("signs out and returns to login", ...)
it("does not treat browser data as authorisation", ...)
```

Also test that the initial account email `vjk16416@gmail.com` can sign in once provisioned, while the auth architecture itself does not contain a permanent single-user allowlist.

- [ ] **Step 2: Replace the generated Lovable client message and assumptions**

`src/integrations/supabase/client.ts` must read only:

```ts
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

If either value is missing, throw:

```text
CareerOS Supabase configuration is missing.
```

Remove any instruction that says `Connect Supabase in Lovable Cloud.`

- [ ] **Step 3: Implement auth context**

Use `supabase.auth.getSession()` for initial client session restoration and `supabase.auth.onAuthStateChange()` for subsequent changes. Keep authentication identity separate from career profile data.

- [ ] **Step 4: Protect the entire application shell**

In `src/routes/__root.tsx`, ensure private CareerOS providers and pages do not render while unauthenticated. Public login UI must not require `CareerOsProvider`.

- [ ] **Step 5: Keep future-user behaviour multi-user ready**

Do not reject other valid authenticated users in application code. Access isolation comes from RLS and onboarding state. The first production user is created as `vjk16416@gmail.com`, but future authenticated users must receive separate profiles rather than an access-denied hard code.

- [ ] **Step 6: Verify**

Run:

```bash
bun test src/lib/auth/auth-context.test.tsx
bun test
bun run lint
bun run build
```

- [ ] **Step 7: Commit**

```bash
git add src/integrations/supabase/client.ts src/lib/auth src/routes/__root.tsx src/components/careeros/app-shell.tsx
git commit -m "feat: connect CareerOS to dedicated Supabase auth"
```

---

### Task 5: Introduce repository-backed Career Knowledge Bank CRUD

**Files:**
- Create: `src/lib/careeros/repositories/profile-repository.ts`
- Create: `src/lib/careeros/repositories/employment-repository.ts`
- Create: `src/lib/careeros/repositories/knowledge-repository.ts`
- Create: `src/lib/careeros/repositories/evidence-repository.ts`
- Create: `src/lib/careeros/repositories/repositories.test.ts`
- Create: `src/lib/careeros/knowledge/types.ts`
- Create: `src/routes/knowledge-bank.tsx`
- Create: `src/components/careeros/knowledge-bank/knowledge-bank-page.tsx`
- Create: `src/components/careeros/knowledge-bank/knowledge-item-form.tsx`

**Interfaces:**
- `listKnowledgeItems(userId)` returns only the current user's rows through RLS.
- `createKnowledgeItem(input)`, `updateKnowledgeItem(id, patch)`, `archiveKnowledgeItem(id)`.
- Users can add, edit, archive and remove information from their own Knowledge Bank.

- [ ] **Step 1: Write repository tests against a mocked Supabase client**

Tests must verify the repository selects/inserts/updates only expected columns and never accepts a caller-supplied `user_id` for another person.

- [ ] **Step 2: Define domain types**

In `knowledge/types.ts`, define:

```ts
export type KnowledgeStatus =
  | "verified"
  | "user_confirmed"
  | "imported_cv"
  | "imported_linkedin"
  | "needs_verification"
  | "archived"
  | "excluded";

export type KnowledgeItemDraft = {
  employmentRoleId?: string;
  category: string;
  title: string;
  content: string;
  starContext?: string;
  starAction?: string;
  starResult?: string;
  metrics?: Record<string, string | number>;
  status: KnowledgeStatus;
  sourceType: string;
  sourceReference?: string;
};
```

- [ ] **Step 3: Implement repository methods**

Repository functions obtain the active user ID from authenticated context/server boundary and must not expose cross-user query parameters.

- [ ] **Step 4: Build Knowledge Bank page**

Add navigation entry `Knowledge Bank`. Page must support filter by role, category, status and source, plus add/edit/archive actions.

Display provenance labels such as `Verified evidence`, `User confirmed`, `Imported from CV`, `Imported from LinkedIn`, `Needs verification`.

- [ ] **Step 5: Verify CRUD and isolation**

Create two test users in a non-production test context or use mocked RLS responses. Confirm user A cannot retrieve or modify user B records.

- [ ] **Step 6: Run checks and commit**

```bash
bun test src/lib/careeros/repositories/repositories.test.ts
bun test
bun run lint
bun run build
git add src/lib/careeros/repositories src/lib/careeros/knowledge src/routes/knowledge-bank.tsx src/components/careeros/knowledge-bank
git commit -m "feat: add user-owned Career Knowledge Bank"
```

---

### Task 6: Add resume evidence rules, STAR/CAR validation and 3-to-5 bullet enforcement

**Files:**
- Create: `src/lib/careeros/resume/quality-rules.ts`
- Create: `src/lib/careeros/resume/quality-rules.test.ts`
- Create: `src/lib/careeros/resume/evidence-map.ts`
- Create: `src/lib/careeros/resume/evidence-map.test.ts`
- Modify existing resume-generation service used by CareerOS.

**Interfaces:**
- `validateRoleBullets(role)` returns rule violations.
- `buildEvidenceMap(resume, knowledgeItems)` traces substantive bullets to the current user's Knowledge Bank.
- `getStrengtheningQuestions(item)` returns focused questions plus a plain-English reason.

- [ ] **Step 1: Write failing quality-rule tests**

Cover:

```ts
expect(validateRoleBullets({ bullets: [a, b] })).toContainEqual(expect.objectContaining({ code: "too_few_bullets" }));
expect(validateRoleBullets({ bullets: [a, b, c] })).toEqual([]);
expect(validateRoleBullets({ bullets: [a, b, c, d, e] })).toEqual([]);
expect(validateRoleBullets({ bullets: [a, b, c, d, e, f] })).toContainEqual(expect.objectContaining({ code: "too_many_bullets" }));
```

Test that unsupported metrics are rejected and that an absent result produces `needs_strengthening`, not a fabricated result.

- [ ] **Step 2: Implement STAR/CAR diagnostics**

A bullet may be considered strong when it contains an evidenced action plus an evidenced result/outcome. Context is optional when the bullet remains understandable.

Do not require visible `Situation`, `Task`, `Action`, `Result`, `Challenge`, `Action`, `Result` labels in final resume prose.

- [ ] **Step 3: Implement strengthening prompts**

For weak evidence, return a reason such as:

```text
This currently describes what you were responsible for, but not the impact. Adding scale, outcome or measurable change would make the bullet stronger and more credible.
```

Then ask only relevant prompts based on missing fields, such as stakeholder count, budget, audience size, delivery time, conversion change, revenue, cost saving or operational outcome.

- [ ] **Step 4: Enforce the three user choices**

The refinement UI must allow:

```text
Strengthen with more information
Use supported information as-is
Exclude this point
```

- [ ] **Step 5: Run tests and commit**

```bash
bun test src/lib/careeros/resume
bun test
bun run lint
bun run build
git add src/lib/careeros/resume src
git commit -m "feat: enforce evidence-led STAR CAR resume rules"
```

---

### Task 7: Add resume-to-Knowledge-Bank learning loop

**Files:**
- Create: `src/lib/careeros/knowledge/update-proposals.ts`
- Create: `src/lib/careeros/knowledge/update-proposals.test.ts`
- Create: `src/components/careeros/knowledge-bank/update-proposal-dialog.tsx`
- Modify existing resume review/editor component.

**Interfaces:**
- `detectKnowledgeChanges(original, edited, currentKnowledge)` returns proposed changes only.
- `approveKnowledgeProposal(id, editedProposal?)` writes an approved change.
- `rejectKnowledgeProposal(id)` leaves Knowledge Bank unchanged.

- [ ] **Step 1: Write failing proposal tests**

Test that wording-only edits do not create a Knowledge Bank proposal, while a newly introduced factual achievement, metric, tool, responsibility or project detail does.

- [ ] **Step 2: Implement proposal detection**

Create proposals with:

```ts
{
  proposedChange,
  reason,
  source: "resume_review",
  status: "pending"
}
```

Never automatically update `knowledge_items` from a resume edit.

- [ ] **Step 3: Build approval dialog**

Dialog copy must explain:

```text
You added career information that is not currently stored in your Knowledge Bank. Saving it can improve future resume tailoring.
```

Actions:

```text
Update Knowledge Bank
Edit before saving
Don't save
```

- [ ] **Step 4: Verify no silent writes**

Tests must prove a pending or rejected proposal does not change `knowledge_items`.

- [ ] **Step 5: Run checks and commit**

```bash
bun test src/lib/careeros/knowledge/update-proposals.test.ts
bun test
bun run lint
bun run build
git add src/lib/careeros/knowledge src/components/careeros/knowledge-bank src
git commit -m "feat: add resume knowledge feedback loop"
```

---

### Task 8: Seed Vinnie's existing CareerOS profile into the dedicated backend

**Files:**
- Create: `supabase/seed/vinnie-profile.sql` or an equivalent one-time import script that is not automatically run for every user.
- Create: `docs/careeros/vinnie-profile-import-audit.md`

**Interfaces:**
- Imports the existing CareerOS profile for only the authenticated Vinnie user.
- Does not mark unsupported metrics as verified.

- [ ] **Step 1: Build the seed from current approved CareerOS sources**

Use the existing CareerOS profile, Evidence Bank, approved Drive mirrors and current CV data. Preserve employer names, titles, dates and claims as they currently exist.

- [ ] **Step 2: Mark provenance conservatively**

For each imported item:

- source from an approved CV or canonical CareerOS record: `imported_cv` or `user_confirmed` as appropriate;
- metric without primary evidence: `needs_verification`;
- evidence confirmed by an approved CareerOS evidence record: `verified`.

Do not promote a metric to `verified` merely because it appears in a CV. The current CV contains quantified claims that remain evidence-sensitive. fileciteturn28file0L1-L2

- [ ] **Step 3: Run an import audit**

Create `docs/careeros/vinnie-profile-import-audit.md` listing counts of roles, Knowledge Bank items, verified items and needs-verification items. Do not include secrets or passwords.

- [ ] **Step 4: Verify RLS after import**

Sign in as Vinnie and confirm all imported records are accessible. Sign in with a separate test user and confirm zero Vinnie records are visible.

- [ ] **Step 5: Commit import assets and audit**

```bash
git add supabase/seed docs/careeros/vinnie-profile-import-audit.md
git commit -m "data: prepare Vinnie CareerOS profile migration"
```

---

### Task 9: Configure Cloudflare deployment without removing Lovable

**Files:**
- Create or Modify: `wrangler.jsonc`
- Modify: `package.json`
- Create: `docs/careeros/cloudflare-deployment.md`

**Interfaces:**
- Production host reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Cloudflare project environment configuration.
- GitHub remains the deployment source.
- Lovable remains available but is not required.

- [ ] **Step 1: Confirm the build target works locally**

Run:

```bash
bun run build
```

Inspect output and confirm TanStack Start/Nitro is targeting Cloudflare-compatible output without the Lovable config package.

- [ ] **Step 2: Configure Cloudflare project**

Connect the GitHub repository and configure the migration branch for preview deployment before production.

Build command:

```text
bun install --frozen-lockfile && bun run build
```

Set the runtime/output configuration required by the generated Nitro Cloudflare target.

- [ ] **Step 3: Set environment variables in Cloudflare**

Add only the dedicated project's URL and publishable key to the web runtime. Never add a Supabase service-role key to client-exposed variables.

- [ ] **Step 4: Add Supabase redirect/site URLs**

Add the Cloudflare preview origin and eventual production origin to the dedicated Supabase Auth URL configuration before end-to-end login testing.

- [ ] **Step 5: Document deployment and rollback**

Create `docs/careeros/cloudflare-deployment.md` recording the Cloudflare project name, GitHub branch, production hostname, environment-variable names, rollback procedure and last verified commit SHA. Populate the actual values during execution, with no placeholders left in the committed version.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc package.json docs/careeros/cloudflare-deployment.md
git commit -m "deploy: add independent CareerOS Cloudflare hosting"
```

---

### Task 10: End-to-end verification, migration PR and cutover gate

**Files:**
- Create: `docs/careeros/independent-web-verification.md`
- Modify: `docs/careeros/status-readiness-checklist-2026-08-14.md` only for evidence-backed status changes.

**Interfaces:**
- Produces a reviewable PR from `migration/independent-careeros-web` to `main`.
- Keeps current Lovable instance intact as rollback/editor option.

- [ ] **Step 1: Run automated quality gate**

```bash
bun test
bun run lint
bun run build
git grep -nE '(service_role|SUPABASE_SERVICE|sb_secret_|client_secret)' -- ':!docs/superpowers/plans/*'
git status --short
```

Expected: test, lint and build succeed; secret scan shows no committed secret values; only intentional changes remain.

- [ ] **Step 2: Verify authentication**

On the Cloudflare preview:

1. unauthenticated user sees login and cannot access CareerOS content;
2. `vjk16416@gmail.com` can sign in;
3. refresh restores the session;
4. sign-out returns to login;
5. a newly added authorised user can sign in without changing application code;
6. each user gets a separate profile and Knowledge Bank.

- [ ] **Step 3: Verify RLS isolation**

Using two authenticated test users, prove:

- user A cannot select user B profile, roles, knowledge, evidence, applications or resumes;
- user A cannot update or delete user B records;
- forged `user_id` values fail at the database policy boundary.

- [ ] **Step 4: Verify Knowledge Bank workflows**

Confirm add, edit, archive and remove behaviour, provenance display and user-specific filtering.

- [ ] **Step 5: Verify resume rules**

Run one real job description through refinement and confirm:

- every employment role has 3 to 5 bullets;
- unsupported metrics are not introduced;
- STAR/CAR weaknesses are explained;
- user can strengthen, use as-is or exclude;
- final bullets remain natural rather than mechanically labelled STAR/CAR;
- evidence mapping references only the signed-in user's Knowledge Bank.

- [ ] **Step 6: Verify Knowledge Bank learning loop**

Edit a resume to introduce a genuinely new factual claim. Confirm CareerOS proposes a Knowledge Bank update, explains why, and makes no write until the user explicitly approves.

- [ ] **Step 7: Verify regression and Lovable fallback**

Confirm existing navigation, Job Scan, Applications, CVs, Evidence and Settings still render correctly. Confirm the Lovable project still exists and can remain connected to GitHub, but turning off Lovable access does not break Cloudflare production or dedicated Supabase authentication/data.

- [ ] **Step 8: Record verification evidence**

Create `docs/careeros/independent-web-verification.md` with test command results, preview URL, Supabase project ref, Cloudflare project/hostname, tested user scenarios, RLS isolation evidence, resume-rule evidence, rollback commit and any remaining blockers.

- [ ] **Step 9: Update readiness checklist conservatively**

Mark only capabilities actually proven by the verification evidence as `VERIFIED`. Do not mark mobile app, Google Drive sync or unrelated CareerOS features complete.

- [ ] **Step 10: Commit verification record**

```bash
git add docs/careeros/independent-web-verification.md docs/careeros/status-readiness-checklist-2026-08-14.md
git commit -m "docs: record independent CareerOS web verification"
```

- [ ] **Step 11: Open a draft migration PR**

PR title:

```text
Migrate CareerOS web to independent Supabase and Cloudflare
```

PR body:

```md
## What changed
- removed production dependence on Lovable build and backend configuration
- added dedicated Supabase authentication and multi-user RLS data model
- added Career Knowledge Bank CRUD and provenance
- added evidence-led STAR/CAR resume quality rules
- added resume-to-Knowledge-Bank update proposals
- prepared Vinnie's existing CareerOS data for migration
- added independent Cloudflare deployment
- retained Lovable as an optional editor and backup

## Verification
- [ ] bun test
- [ ] bun run lint
- [ ] bun run build
- [ ] authorised login and logout verified
- [ ] multi-user RLS isolation verified
- [ ] Knowledge Bank CRUD verified
- [ ] 3-to-5 bullets per employment role verified
- [ ] STAR/CAR strengthening flow verified
- [ ] resume-to-Knowledge-Bank approval flow verified
- [ ] Cloudflare preview verified
- [ ] Lovable no longer required for production operation
- [ ] no secrets committed

## Cutover rule
Do not merge, change production DNS or remove the existing Lovable deployment until Vinnie reviews the verification evidence and explicitly approves cutover.
```

- [ ] **Step 12: Stop for explicit cutover approval**

Do not merge to `main`, promote Cloudflare preview to the final production endpoint, disable Lovable, or migrate additional users until Vinnie explicitly approves the verified PR and cutover.

## Final self-review

- [ ] Every approved migration-spec requirement maps to at least one task.
- [ ] No committed executable file contains placeholder credentials or project IDs.
- [ ] No Supabase secret/service-role key is exposed to the browser or repository.
- [ ] Authentication is multi-user ready and no permanent single-email allowlist remains in application code.
- [ ] Every user-owned database table has RLS ownership policies.
- [ ] Career Knowledge Bank supports add, edit, archive/remove and provenance.
- [ ] Resume refinement uses only the signed-in user's Knowledge Bank and evidence.
- [ ] Every employment role is checked for 3 to 5 bullets.
- [ ] STAR/CAR strengthening never invents missing outcomes.
- [ ] Resume edits cannot silently alter the Knowledge Bank.
- [ ] Vinnie's evidence-sensitive metrics remain conservatively classified until verified.
- [ ] Cloudflare production operation does not depend on Lovable credits.
- [ ] Lovable remains available as an optional editor and rollback aid.
- [ ] Mobile implementation remains out of scope for this plan.

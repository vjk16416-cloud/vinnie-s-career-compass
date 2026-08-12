# CareerOS Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring CareerOS profile data, Southeastern application metadata, approved CV metadata, and CV writing rules into sync without weakening the Verified-evidence gate or overwriting valid saved user data.

**Architecture:** Keep the existing `careeros:v1` local-first architecture. Extend `Settings` with typed `cvRules`, update the canonical seed, and add a one-time August 2026 migration inside normalisation that only corrects known stale baseline values and inserts missing Southeastern records. Update generation output only where required to consume the no-em-dash rule and preserve the existing Verified-only evidence filter.

**Tech Stack:** TypeScript 5.8, React 19, TanStack Start/Router, Vite 8, Bun lockfile/runtime, browser localStorage.

## Global Constraints

- British English.
- No em dashes in newly generated CV or application content.
- Professional experience bullets follow compact STAR/CAR structure.
- Roughly half of experience bullets may use metrics when verified evidence exists.
- Never invent metrics, unsupported scope, or formal line-management responsibility.
- Only `Verified` evidence is eligible for generated CVs, cover letters, and supporting statements.
- Times New Roman, 10 to 12 pt, black text, left aligned, no graphics, tables, icons, rating bars, or decorative columns in final CV output.
- Target about two pages.
- New tailored CVs create new versions and never overwrite the base CV.
- Northeastern University London ends in Dec 2025.
- Southeastern Assistant Project Manager application remains `Preparing` unless the user explicitly confirms submission.
- Do not add Google Drive or Claude integration claims.
- Do not change scoring weights or redesign the UI.
- Do not rewrite published Git history, force-push, rebase, amend, or squash pushed commits because this repository syncs with Lovable.

---

## File map

- `src/lib/careeros/types.ts`: define `CvRules` and add `settings.cvRules`.
- `src/lib/careeros/seed.ts`: update the current profile baseline and add canonical Southeastern job, application, CV, profile-version, activity, and `cvRules` defaults.
- `src/lib/careeros/normalise.ts`: deep-normalise `cvRules` and run a one-time, idempotent August 2026 data migration for older `careeros:v1` saved state.
- `src/lib/careeros/generate.ts`: preserve Verified-only evidence and remove em dashes from generated CV/application output when the rule is enabled.
- `src/lib/careeros/normalise.test.ts`: cover stale-data migration, idempotence, record linking, conservative evidence statuses, and nested `cvRules` defaults.
- `src/lib/careeros/generate.test.ts`: cover Verified-only evidence and no-em-dash output.

---

### Task 1: Add typed CV rules

**Files:**
- Modify: `src/lib/careeros/types.ts`

**Interfaces:**
- Produces: `CvRules` and required `Settings.cvRules: CvRules`.

- [ ] **Step 1: Add the typed rules interface before `Settings`**

```ts
export interface CvRules {
  language: "British English";
  noEmDashes: boolean;
  experienceBulletStyle: "Compact STAR/CAR";
  metricUsage: "Roughly half, verified only";
  neverInventMetrics: boolean;
  allowUnsupportedScope: boolean;
  allowFormalLineManagementWithoutEvidence: boolean;
  fontFamily: "Times New Roman";
  fontSizeMinPt: number;
  fontSizeMaxPt: number;
  blackTextOnly: boolean;
  leftAligned: boolean;
  allowGraphics: boolean;
  allowTables: boolean;
  allowIcons: boolean;
  allowRatingBars: boolean;
  targetPages: number;
  preserveBaseCv: boolean;
}
```

- [ ] **Step 2: Extend `Settings`**

```ts
export interface Settings {
  claudeReviewEnabled: boolean;
  googleDriveFolder: string;
  driveConnected: boolean;
  dataSource: "Local seeded data";
  cvRules: CvRules;
}
```

- [ ] **Step 3: Run a type-only check after dependent tasks are complete**

Run after Tasks 2 to 4: `bunx tsc --noEmit`

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/careeros/types.ts
git commit -m "feat: add CareerOS CV writing rules"
```

---

### Task 2: Update the canonical seed with current career data

**Files:**
- Modify: `src/lib/careeros/seed.ts`

**Interfaces:**
- Consumes: `Settings.cvRules` from Task 1.
- Produces fixed IDs for migration and linking:
  - `job-southeastern-apm-3577`
  - `app-southeastern-apm-3577`
  - `cv-southeastern-apm-3577`
  - `cvv-southeastern-apm-1`
  - `pv-2026-08-12-career-sync`

- [ ] **Step 1: Correct the profile positioning**

Change the profile headline to:

```ts
headline: "Project & Technology Delivery | APM PFQ | UCL MSc Technology Management candidate",
```

Change the profile summary to:

```ts
summary:
  "APM PFQ-qualified technology management professional and part-time UCL MSc Technology Management candidate with experience coordinating project delivery, reporting, budgets, stakeholders and technology change across higher education, enterprise software and recruitment. Previously managed a £140k+ digital media portfolio at Northeastern University London and delivered software-adoption, CRM-migration, reporting and workflow-improvement initiatives.",
```

For `emp-nul`, set:

```ts
end: "Dec 2025",
summary:
  "Managed paid acquisition, reporting, budget allocation and cross-functional delivery across a multi-market student recruitment portfolio.",
```

Change the first Northeastern highlight from present tense to:

```ts
"Managed an annual digital media budget of £140k+ across PPC, paid social, display and third-party platforms.",
```

Do not modify the chronology of other employers.

- [ ] **Step 2: Add the August profile-version marker**

Append:

```ts
{
  id: "pv-2026-08-12-career-sync",
  createdAt: now,
  label: "v2 - August 2026 career sync",
  note: "Corrected Northeastern end date to Dec 2025 and aligned CareerOS toward project and technology delivery. Approved by Vinnie.",
},
```

- [ ] **Step 3: Add the Southeastern job record**

Add a `JobRecord` with:

```ts
{
  id: "job-southeastern-apm-3577",
  company: "Southeastern",
  title: "Assistant Project Manager",
  location: "London Bridge / London & Kent",
  url: "https://jobs.southeasternrailway.co.uk/jobs/job/Assistant-Project-Manager/3577",
  sourceType: "url",
  createdAt: now,
  description:
    "Support delivery across Southeastern's Major Programmes portfolio, including infrastructure, engineering, digital and business transformation projects. Coordinate project activities and workstreams, maintain plans and documentation, monitor budgets, risks, assumptions, issues, dependencies, milestones and change activity, support governance and reporting, build stakeholder and supplier relationships, and help transition project outcomes into business as usual. The role requires experience supporting structured project delivery, project management principles, planning and organisation, accurate reporting and documentation, stakeholder communication, project controls, Microsoft Office 365 and APM PFQ or an equivalent foundation-level project management qualification.",
},
```

Do not seed a fabricated scan result or compatibility score.

- [ ] **Step 4: Add the Southeastern application record**

Add:

```ts
{
  id: "app-southeastern-apm-3577",
  jobId: "job-southeastern-apm-3577",
  company: "Southeastern",
  title: "Assistant Project Manager",
  location: "London Bridge / London & Kent",
  workingArrangement: "Unspecified",
  employmentType: "Permanent",
  priority: "High",
  stage: "Preparing",
  dateAdded: now,
  deadline: "2026-08-24",
  salary: "£40,000 - £44,000 per annum DOE",
  source: "Southeastern careers site",
  url: "https://jobs.southeasternrailway.co.uk/jobs/job/Assistant-Project-Manager/3577",
  linkedCvId: "cv-southeastern-apm-3577",
  notes:
    "High-priority project-delivery application. APM PFQ is an explicit requirement. Rail-sector experience is a gap and must not be implied.",
  nextAction: "Review final application and submit before the closing date",
  history: [
    {
      at: now,
      entry: "Southeastern Assistant Project Manager application added during the August 2026 CareerOS data sync.",
    },
  ],
},
```

- [ ] **Step 5: Add the approved CV metadata record**

Append a `Project Delivery` CV record:

```ts
{
  id: "cv-southeastern-apm-3577",
  name: "Vinnie Jegathees - Assistant Project Manager CV - Southeastern",
  category: "Project Delivery",
  status: "Approved",
  applicationId: "app-southeastern-apm-3577",
  jobId: "job-southeastern-apm-3577",
  updatedAt: now,
  versions: [
    {
      id: "cvv-southeastern-apm-1",
      version: 1,
      createdAt: now,
      note:
        "Approved two-page STAR-style application CV. External filename: Vinnie_Jegathees_Assistant_Project_Manager_CV_Southeastern.pdf. Metadata record only. Metrics remain reusable only when linked evidence is Verified.",
      body: "",
      evidenceIds: [
        "ev-budget",
        "ev-rag",
        "ev-agency",
        "ev-ab",
        "ev-adoption",
        "ev-powerbi",
        "ev-agile",
        "ev-crm",
        "ev-npd",
        "ev-trl",
      ],
    },
  ],
},
```

Do not add `Needs Evidence`, `Archived`, or `Excluded` IDs to `evidenceIds`.

- [ ] **Step 6: Add `cvRules` defaults to settings**

```ts
cvRules: {
  language: "British English",
  noEmDashes: true,
  experienceBulletStyle: "Compact STAR/CAR",
  metricUsage: "Roughly half, verified only",
  neverInventMetrics: true,
  allowUnsupportedScope: false,
  allowFormalLineManagementWithoutEvidence: false,
  fontFamily: "Times New Roman",
  fontSizeMinPt: 10,
  fontSizeMaxPt: 12,
  blackTextOnly: true,
  leftAligned: true,
  allowGraphics: false,
  allowTables: false,
  allowIcons: false,
  allowRatingBars: false,
  targetPages: 2,
  preserveBaseCv: true,
},
```

- [ ] **Step 7: Add activity entries**

Add fixed IDs so migration can remain idempotent:

```ts
{ id: "act-sync-2026-08-12", at: now, text: "CareerOS profile corrected and synced to the August 2026 approved career record." },
{ id: "act-southeastern-app", at: now, text: "Application added: Assistant Project Manager at Southeastern." },
{ id: "act-southeastern-cv", at: now, text: "Approved Southeastern Assistant Project Manager CV registered in CareerOS." },
```

- [ ] **Step 8: Confirm evidence statuses are unchanged**

Review the evidence array. `ev-cvr` and `ev-nas` must remain `Needs Evidence`; `ev-events` remains `Archived`; `ev-pmo` remains `Excluded`. Do not create quantified `Verified` evidence from the approved CV alone.

- [ ] **Step 9: Commit**

```bash
git add src/lib/careeros/seed.ts
git commit -m "feat: sync approved CareerOS profile and Southeastern records"
```

---

### Task 3: Add safe, one-time migration for existing localStorage

**Files:**
- Modify: `src/lib/careeros/normalise.ts`
- Create: `src/lib/careeros/normalise.test.ts`

**Interfaces:**
- Consumes fixed seed IDs from Task 2.
- Produces: `normaliseData(raw)` that applies the August 2026 sync once and remains idempotent.

- [ ] **Step 1: Write migration tests first**

Create `src/lib/careeros/normalise.test.ts` using Bun's test API:

```ts
import { describe, expect, test } from "bun:test";
import { createSeedData } from "./seed";
import { normaliseData } from "./normalise";

describe("normaliseData August 2026 sync", () => {
  test("corrects known stale baseline values without overwriting unrelated saved values", () => {
    const old = createSeedData();
    old.profileVersions = old.profileVersions.filter((v) => v.id !== "pv-2026-08-12-career-sync");
    old.profile.name = "Vinnie Custom";
    old.profile.headline = "Performance Marketing Manager | UCL MSc Technology Management candidate";
    old.profile.summary =
      "Performance Marketing Manager and part-time UCL MSc Technology Management candidate, combining multi-market digital acquisition experience with technology evaluation, new product development, analytics, stakeholder management, project delivery, and product/innovation work.";
    const nul = old.profile.employment.find((e) => e.id === "emp-nul")!;
    nul.end = "Present";

    const result = normaliseData(old);

    expect(result.profile.name).toBe("Vinnie Custom");
    expect(result.profile.headline).toContain("Project & Technology Delivery");
    expect(result.profile.employment.find((e) => e.id === "emp-nul")?.end).toBe("Dec 2025");
  });

  test("adds cvRules and Southeastern records once", () => {
    const old: any = {
      profile: createSeedData().profile,
      profileVersions: [{ id: "pv-1", createdAt: "x", label: "old", note: "old" }],
      evidence: createSeedData().evidence,
      jobs: [],
      applications: [],
      cvs: [],
      coverLetters: [],
      scans: [],
      activity: [],
      settings: { claudeReviewEnabled: true, googleDriveFolder: "", driveConnected: false, dataSource: "Local seeded data" },
    };

    const once = normaliseData(old);
    const twice = normaliseData(once);

    expect(once.settings.cvRules.noEmDashes).toBe(true);
    expect(once.settings.claudeReviewEnabled).toBe(true);
    expect(once.jobs.filter((j) => j.id === "job-southeastern-apm-3577")).toHaveLength(1);
    expect(twice.jobs.filter((j) => j.id === "job-southeastern-apm-3577")).toHaveLength(1);
    expect(twice.applications.filter((a) => a.company === "Southeastern" && a.title === "Assistant Project Manager")).toHaveLength(1);
    expect(twice.cvs.filter((c) => c.id === "cv-southeastern-apm-3577")).toHaveLength(1);
  });

  test("preserves an existing Southeastern application stage", () => {
    const old = createSeedData();
    old.profileVersions = old.profileVersions.filter((v) => v.id !== "pv-2026-08-12-career-sync");
    const app = old.applications.find((a) => a.id === "app-southeastern-apm-3577")!;
    app.stage = "Applied";

    const result = normaliseData(old);

    expect(result.applications.find((a) => a.id === "app-southeastern-apm-3577")?.stage).toBe("Applied");
  });

  test("does not promote conservative evidence statuses", () => {
    const result = normaliseData(createSeedData());
    expect(result.evidence.find((e) => e.id === "ev-cvr")?.status).toBe("Needs Evidence");
    expect(result.evidence.find((e) => e.id === "ev-nas")?.status).toBe("Needs Evidence");
    expect(result.evidence.find((e) => e.id === "ev-pmo")?.status).toBe("Excluded");
  });
});
```

- [ ] **Step 2: Run the tests to verify current code fails**

Run: `bun test src/lib/careeros/normalise.test.ts`

Expected before implementation: FAIL because nested `cvRules` and the one-time migration are not implemented.

- [ ] **Step 3: Implement nested settings normalisation**

Import `CvRules` and `Settings` from `types.ts`, derive `savedSettings`, then build settings as:

```ts
const savedSettings = (saved.settings ?? {}) as Partial<Settings> & {
  cvRules?: Partial<CvRules>;
};

const settings: Settings = {
  ...seed.settings,
  ...savedSettings,
  cvRules: {
    ...seed.settings.cvRules,
    ...(savedSettings.cvRules ?? {}),
  },
};
```

- [ ] **Step 4: Implement an idempotent August migration helper**

Add a private helper that runs only when `pv-2026-08-12-career-sync` is absent. It must:

1. Correct the Northeastern end date only when it is still exactly `Present`.
2. Replace the profile headline only when it is the known stale Performance Marketing headline.
3. Replace the profile summary only when it is the known stale baseline summary.
4. Insert or link the Southeastern job, application and CV from `seed` only when no equivalent record already exists.
5. Preserve an existing application stage, notes, dateAdded and other valid user edits.
6. Add the sync profile-version and activity markers once.

Use matching by fixed ID first, then by Southeastern URL or company/title to avoid duplicates.

- [ ] **Step 5: Return the migrated result**

Build the current normalised object first, then:

```ts
return applyAugust2026Sync(normalised, seed);
```

- [ ] **Step 6: Run migration tests**

Run: `bun test src/lib/careeros/normalise.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/careeros/normalise.ts src/lib/careeros/normalise.test.ts
git commit -m "fix: migrate older CareerOS data safely"
```

---

### Task 4: Enforce no-em-dash output while preserving Verified-only generation

**Files:**
- Modify: `src/lib/careeros/generate.ts`
- Create: `src/lib/careeros/generate.test.ts`

**Interfaces:**
- Consumes: `data.settings.cvRules.noEmDashes`.
- Preserves: `usableEvidence(data)` returns only `status === "Verified"`.

- [ ] **Step 1: Write generation tests first**

Create `src/lib/careeros/generate.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { buildCoverLetter, buildTailoredCv, usableEvidence } from "./generate";
import { createSeedData } from "./seed";

describe("CareerOS generation rules", () => {
  test("usableEvidence remains Verified only", () => {
    const data = createSeedData();
    expect(usableEvidence(data).every((e) => e.status === "Verified")).toBe(true);
    expect(usableEvidence(data).some((e) => e.id === "ev-cvr")).toBe(false);
    expect(usableEvidence(data).some((e) => e.id === "ev-nas")).toBe(false);
  });

  test("generated application documents contain no em dash", () => {
    const data = createSeedData();
    const job = data.jobs.find((j) => j.id === "job-southeastern-apm-3577")!;
    const cv = buildTailoredCv(data, job, undefined);
    const letter = buildCoverLetter(data, job, undefined);

    expect(cv.body).not.toContain("—");
    expect(letter.body).not.toContain("—");
    expect(letter.emailVersion).not.toContain("—");
    expect(cv.evidenceIds.every((id) => data.evidence.find((e) => e.id === id)?.status === "Verified")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify current output fails the em-dash assertion**

Run: `bun test src/lib/careeros/generate.test.ts`

Expected before implementation: Verified-only test PASS; no-em-dash test FAIL because existing CV headings and email subject use an em dash.

- [ ] **Step 3: Add a small output-rule helper**

```ts
function applyCvWritingRules(text: string, data: CareerOsData): string {
  if (!data.settings.cvRules.noEmDashes) return text;
  return text.replace(/\s*—\s*/g, ", ");
}
```

- [ ] **Step 4: Make authored generator separators naturally compliant**

Change role headings from an em dash separator to a pipe:

```ts
lines.push(`### ${role.title} | ${role.company} (${role.employmentType})`);
```

Change education lines to commas:

```ts
p.education.forEach((e) => lines.push(`- ${e.qualification}, ${e.institution}, ${e.detail}`));
```

Change email subject to:

```ts
`Subject: Application: ${job.title}`,
```

- [ ] **Step 5: Apply the rule as a final safety pass**

Return `applyCvWritingRules(lines.join("\n"), data)` from CV generation and apply the same helper to `body` and `emailVersion` in cover-letter generation. Do not change `usableEvidence` or `relevantEvidence` filtering.

- [ ] **Step 6: Run generation tests**

Run: `bun test src/lib/careeros/generate.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/careeros/generate.ts src/lib/careeros/generate.test.ts
git commit -m "fix: apply approved CV writing rules to generation"
```

---

### Task 5: Full verification and sync readiness

**Files:**
- Review only unless a verification defect is found.

**Interfaces:**
- Validates Tasks 1 to 4 as one working change set.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test src/lib/careeros/normalise.test.ts src/lib/careeros/generate.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
bun run lint
```

Expected: PASS, or document pre-existing unrelated lint findings separately without claiming they were introduced by this change.

- [ ] **Step 4: Run production build**

Run:

```bash
bun run build
```

Expected: PASS.

- [ ] **Step 5: Static verification of linked records**

Confirm in `createSeedData()`:

```ts
const data = createSeedData();
const job = data.jobs.find((j) => j.id === "job-southeastern-apm-3577");
const app = data.applications.find((a) => a.id === "app-southeastern-apm-3577");
const cv = data.cvs.find((c) => c.id === "cv-southeastern-apm-3577");
```

Verify:

```ts
app?.jobId === job?.id
app?.linkedCvId === cv?.id
cv?.jobId === job?.id
cv?.applicationId === app?.id
app?.stage === "Preparing"
app?.compatibilityScore === undefined
```

- [ ] **Step 6: Confirm conservative evidence statuses**

Verify the sync did not change `ev-cvr`, `ev-nas`, `ev-events`, or `ev-pmo` away from their existing conservative statuses.

- [ ] **Step 7: Review diff for scope**

Only these implementation files should have changed, plus the approved tests and plan/spec docs:

```text
src/lib/careeros/types.ts
src/lib/careeros/seed.ts
src/lib/careeros/normalise.ts
src/lib/careeros/normalise.test.ts
src/lib/careeros/generate.ts
src/lib/careeros/generate.test.ts
```

No Job Scan scoring, UI redesign, Drive integration, or Claude integration changes belong in this pass.

- [ ] **Step 8: Commit any verification-only correction if required**

If no correction is needed, do not create an empty commit. If a correction is needed:

```bash
git add <only corrected files>
git commit -m "fix: complete CareerOS data sync verification"
```

- [ ] **Step 9: Open a pull request without rewriting history**

Create a normal PR from the implementation branch to `main`. Do not rebase, squash already-pushed commits, amend pushed commits, or force-push.

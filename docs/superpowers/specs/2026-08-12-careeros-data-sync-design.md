# CareerOS Data Sync Design

Date: 12 August 2026

## Goal

Bring the CareerOS seeded career record into alignment with the latest approved user facts and application workflow without weakening the evidence gate or redesigning the product.

## Source-of-truth order

1. Explicit user corrections in the current conversation.
2. CareerOS evidence audit for evidence strength and claim safety.
3. Approved Southeastern Assistant Project Manager CV for application-specific positioning and layout/content reference.
4. Existing CareerOS seed structure and types for implementation shape.

## Approaches considered

### A. Minimal seed-only sync
Update the existing profile dates/headline, add the Southeastern job/application/CV records, and leave schema unchanged.

Pros: lowest implementation risk.
Cons: CV writing rules remain outside the app and cannot be consumed consistently by future generation logic.

### B. Typed data sync plus CV generation rules, recommended
Update the seed data and add a small typed `cvRules` settings object that captures the approved writing rules. Preserve the existing generation/evidence architecture.

Pros: CareerOS can reuse the approved rules consistently in later tailoring and generation. Small, bounded schema change.
Cons: requires normalisation/default support for older localStorage data.

### C. Full document archive/integration
Persist uploaded DOCX/PDF artifacts and external Drive references inside CareerOS.

Pros: richer archive.
Cons: unnecessary for this pass, more integration work, higher regression risk.

## Chosen design

Use approach B.

### 1. Career profile correction

Update Northeastern University London to `Jun 2025` through `Dec 2025` and remove any wording that implies current employment. Update the profile headline and summary so they position Vinnie toward project and technology delivery rather than describing him as a current Performance Marketing Manager.

Do not change the other employment chronology unless a current user correction exists.

### 2. Evidence integrity

Do not promote quantified claims to `Verified` solely because they appear in a CV. The July 2026 evidence audit explicitly says repeated CV claims are not independent verification and that primary dashboards, finance records, CRM/Power BI exports, campaign reports, or employer evidence are still needed for many metrics.

Keep the existing evidence gate: only `Verified` evidence is eligible for generated application content.

Where the seed currently has a high-confidence verified qualitative claim, preserve it. Where a quantified claim lacks primary evidence, keep or create it as `Needs Evidence` rather than silently upgrading it.

No direct-report or formal team-management claim will be added.

### 3. Southeastern application record

Add a non-placeholder job and application for Southeastern Railway, Assistant Project Manager.

Store known job metadata from the reviewed posting, including the job URL, London/Kent location context, permanent employment type, salary range if already captured in the approved analysis, and closing date if already captured in the approved analysis. Set the application stage to `Preparing` unless the user later confirms submission.

Do not fabricate a compatibility score inside the seed unless a deterministic CareerOS scan result is stored from the actual JD.

### 4. Approved CV record

Add a `Project Delivery` CV document for the approved Southeastern Assistant Project Manager CV and mark it `Approved`.

Store an application-specific version with a note that it is the approved two-page STAR-style version. Link it to the Southeastern job/application records.

The CV record may preserve the approved document body as reference text, but automated regeneration must still obey the evidence gate. Any metrics present in the approved static document that remain `Needs Evidence` must not automatically become reusable verified evidence.

### 5. CV writing rules

Extend `Settings` with a compact typed `cvRules` object:

- British English.
- No em dashes.
- Compact STAR/CAR-style bullets for professional experience.
- Roughly half of experience bullets may contain metrics when verified evidence exists.
- Never invent metrics or unsupported scope.
- Do not claim formal line management without explicit evidence.
- Preserve ATS-friendly output: Times New Roman, 10 to 12 pt, black text, left aligned, no graphics/tables/icons/rating bars, target about two pages.
- New tailored CVs create new versions and never overwrite the base CV.

Update normalisation so older `careeros:v1` localStorage data receives safe defaults for `cvRules` without overwriting existing valid user data.

### 6. Activity and profile version history

Add a new profile version entry noting the August 2026 correction and add activity entries for the data sync, approved Southeastern CV registration, and Southeastern application creation.

## Files expected to change

- `src/lib/careeros/types.ts`
- `src/lib/careeros/normalise.ts`
- `src/lib/careeros/seed.ts`
- Any existing generator file only if required to consume `cvRules` safely. No unrelated UI redesign.

## Safety constraints

- No unsupported evidence status upgrades.
- No invented metrics.
- No em dashes in newly authored CV/application content rules.
- No claim of formal people management.
- No Google Drive or Claude integration claims unless connected.
- Existing Job Scan repair remains unchanged unless required by type compatibility.

## Verification

1. Typecheck/build passes.
2. Fresh seed loads with Northeastern ending Dec 2025.
3. Older partial `careeros:v1` data normalises without losing valid values and gains default `cvRules`.
4. Southeastern job/application/CV records are present and linked.
5. Evidence statuses remain conservative and no quantified claim is upgraded based only on CV repetition.
6. Existing Job Scan, applications, CVs, Evidence and Settings routes still load.
7. Generated content path, if it reads `cvRules`, still filters to `Verified` evidence only.

## Out of scope

- Uploading the DOCX/PDF binaries into the app.
- Google Drive integration.
- Claude review integration.
- New scoring weights.
- UI redesign.
- Marking the Southeastern application as submitted without user confirmation.

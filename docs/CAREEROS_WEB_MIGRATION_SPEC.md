# CareerOS Independent Web Migration Spec

## Status

Approved design direction for the CareerOS web migration.

This document defines the architecture and product rules for moving CareerOS away from any critical dependency on Lovable while keeping Lovable available as an optional backup/editor.

## 1. Migration objective

CareerOS should run independently as a production web application with:

- GitHub as the source of truth for application code.
- A new dedicated Supabase project owned directly by CareerOS for authentication, database and future storage needs.
- Independent web deployment outside Lovable.
- Lovable retained only as an optional visual editor and backup workflow.
- No production-critical dependency on Lovable AI credits.
- A clean path to a future mobile app after the web migration is stable.

The existing CareerOS application should be migrated, not rebuilt from scratch.

## 2. Migration safety

The migration must be non-destructive.

- Keep the current working CareerOS version intact while the new independent version is developed and tested.
- Perform migration work on `migration/independent-careeros-web`.
- Do not remove or disable the existing Lovable version until the independent deployment is verified.
- Preserve the current CareerOS interface and existing functionality unless a change is required for the migration architecture.
- Do not silently delete user data or existing application features.

## 3. Target web architecture

### Production path

CareerOS Web -> GitHub -> independent deployment -> dedicated Supabase

### Responsibilities

**GitHub**
- Permanent source of truth for CareerOS code.
- Stores migration documentation, application code, schema migrations and deployment configuration.

**Dedicated Supabase project**
- Authentication.
- User profiles.
- Career Knowledge Bank.
- Employment roles and career history.
- Evidence and achievement records.
- Applications and job descriptions.
- Resume versions and related metadata.
- Row Level Security for user isolation.
- Shared backend for the future CareerOS mobile app.

**Independent deployment**
- Hosts the production web app without requiring Lovable credits.
- Environment variables point directly to the dedicated CareerOS Supabase project.

**Lovable**
- Optional editor and preview environment only.
- May remain connected to GitHub.
- Must not be required for production authentication, production data or deployment.

## 4. Multi-user architecture

CareerOS must be designed as a multi-user career intelligence system.

Each authenticated user has their own isolated career pathway and data. The system must never assume all users share the same experience, skills, target roles or evidence.

Authentication identifies the person. Their Career Knowledge Bank defines what CareerOS knows about that person's career.

Every user-owned record must be linked to the authenticated user's stable user ID.

Supabase Row Level Security must ensure that one user cannot read, update or use another user's career data.

The initial production account is Vinnie's account. The architecture must support adding other users later without rebuilding authentication or the core data model.

## 5. Authentication model

### Initial state

- Email/password authentication.
- Initial authorised account: `vjk16416@gmail.com`.
- Public access to CareerOS must be blocked.
- The application must restore sessions securely and support sign-out.
- Unauthenticated users must not be able to access CareerOS content.

### Future-ready design

Authentication must not be structurally hard-coded around one user.

Future users should be added using the same authentication system and receive their own isolated CareerOS workspace and Knowledge Bank.

Authorisation must be enforced using authenticated user identity and database policies, not only front-end checks.

## 6. Career Knowledge Bank

Every user receives a dedicated **Career Knowledge Bank**.

This is the long-term source of truth CareerOS uses to understand the user before analysing jobs or building a refined resume.

Users must be able to:

- Add information.
- Edit information.
- Remove or archive information.
- Review imported information.
- Correct CareerOS when information is inaccurate.
- Approve suggested updates created during resume refinement.

The Knowledge Bank should contain structured information such as:

- Personal/professional profile.
- Employment history.
- Job responsibilities.
- STAR/CAR achievements.
- Projects.
- Quantified outcomes and metrics.
- Skills.
- Tools and technologies.
- Industries and domain experience.
- Education.
- Certifications and professional development.
- Awards and memberships where relevant.
- Career goals and target roles.
- Writing/style preferences.
- Supporting evidence and source references.

## 7. Knowledge sources

CareerOS may build a user's Knowledge Bank from user-approved sources including:

- Existing CV or resume uploads.
- LinkedIn profile information.
- Guided onboarding questions.
- CareerOS AI career interview questions.
- Supporting documents such as certificates, project documents, appraisals, reports, portfolios, presentations and achievement notes.
- User-entered information.
- User corrections and edits made during resume review.
- Optional connected storage such as Google Drive in a later phase.

CareerOS must not treat LinkedIn as the sole source of truth.

Imported information should preserve provenance so the system can distinguish where a fact came from.

## 8. Knowledge and evidence status

Knowledge items should carry a clear source/status model. The exact database labels may be refined during implementation, but the product behaviour must distinguish at least:

- Verified evidence.
- User confirmed.
- Imported from CV.
- Imported from LinkedIn.
- Needs verification or missing evidence.
- Archived or excluded.

AI inference must never silently become a confirmed career fact.

## 9. Resume intelligence workflow

CareerOS should follow this workflow:

Career Profile -> Knowledge Bank -> Target Job -> Requirement Analysis -> Evidence Mapping -> Gap Analysis -> Resume Draft -> Evidence Validation -> User Review -> Final Resume

The system must understand the individual user before refining their resume.

Resume generation must use only that user's own career data and must never mix information between users.

If the target job requires experience that the user has not demonstrated, CareerOS should identify the gap rather than invent a claim.

## 10. STAR/CAR resume standard

CareerOS must explain to users that strong resume bullets should demonstrate impact, rather than merely listing duties.

Resume bullet generation should use STAR or CAR thinking:

- Situation / Challenge or relevant context.
- Task or responsibility where useful.
- Action taken by the user.
- Result or outcome where evidence exists.

The final resume should read naturally. It should not normally display literal `Situation`, `Task`, `Action`, `Result` or `Challenge`, `Action`, `Result` headings inside each bullet.

CareerOS should use STAR/CAR as the underlying writing structure.

## 11. Employment role bullet rule

Every employment role in a refined resume should normally contain **3 to 5 bullet points**.

This rule applies to each employment role, including older roles.

Each bullet should:

- Be relevant to the target role where possible.
- Follow STAR/CAR principles.
- Prioritise achievements and impact over generic duties.
- Use metrics only when supported by the user's knowledge/evidence.
- Never invent results merely to reach the 3-bullet minimum.

If there is not enough information to produce three strong bullets for a role, CareerOS should ask the user targeted follow-up questions rather than padding the resume with unsupported content.

## 12. Follow-up questions and evidence strengthening

When CareerOS identifies a potentially useful achievement but lacks enough detail, the user should have the option to strengthen it.

CareerOS must explain **why** the extra information is useful before asking for it.

Example behaviour:

- Explain that the current statement describes a responsibility but not the result.
- Explain that a stronger STAR/CAR bullet would benefit from scale, action, measurable impact or outcome.
- Ask a focused question such as number of stakeholders, budget size, audience, time saved, revenue, conversion change, project scale or delivery outcome where relevant.

The user should be able to choose:

- Answer questions and strengthen the evidence.
- Use the existing supported information as-is.
- Exclude the point.

CareerOS must never manufacture the missing result.

## 13. Resume review and Knowledge Bank feedback loop

Resume refinement should improve the user's Knowledge Bank over time.

Flow:

Knowledge Bank -> Refined Resume -> User Review/Edit -> Suggested Knowledge Bank Update

If the user changes a resume and introduces meaningful new career information, CareerOS should detect that the information is not currently stored and ask whether the Knowledge Bank should be updated.

CareerOS must show the proposed change clearly before saving it.

The user should be able to:

- Update Knowledge Bank.
- Edit the proposed Knowledge Bank change before saving.
- Decline the update.

The system must not silently write resume edits back into the Knowledge Bank.

## 14. Resume quality control

Before a resume can be considered final, CareerOS should check:

- Each employment role contains 3 to 5 bullets.
- Bullets follow STAR/CAR principles where evidence allows.
- Claims are supported by the user's Knowledge Bank/evidence.
- Unsupported or weak claims are flagged.
- Important requirements from the target job are addressed where the user genuinely has relevant evidence.
- Missing job requirements are shown as gaps rather than fabricated experience.
- Resume content comes only from the current user's data.
- User-approved resume formatting rules are satisfied.

CareerOS should make weak evidence visible to the user and explain how it can be strengthened.

## 15. Existing Vinnie data

Vinnie's existing CareerOS career content should become the first user profile and Knowledge Bank in the new architecture.

Existing evidence should not automatically be marked verified simply because it exists in a previous CV or application.

Evidence-sensitive metrics must retain their appropriate review/verification state during migration.

The existing confirmed login email is `vjk16416@gmail.com`.

## 16. Data model direction

The detailed SQL schema will be produced during implementation planning, but the data model must support clear ownership boundaries for at least:

- `profiles`
- `career_preferences`
- `employment_roles`
- `role_bullets` or achievements/responsibilities
- `projects`
- `education`
- `certifications`
- `skills`
- `knowledge_items`
- `evidence_items`
- `job_opportunities`
- `applications`
- `job_requirements`
- `resume_versions`
- `resume_bullets`
- `knowledge_update_suggestions`

Each user-owned table must be scoped to the authenticated user directly or through a securely owned parent record.

## 17. Security requirements

- Use Supabase Row Level Security on user data exposed through the Data API.
- Users may access only their own records unless a future explicit administrative role is introduced.
- Never expose Supabase service-role or secret keys in browser code.
- Use publishable credentials appropriate for front-end clients.
- Authorisation must be enforced at the database/API layer, not only through hidden UI elements.
- Avoid using user-editable metadata for security decisions.

## 18. Existing application preservation

The migration should preserve the current CareerOS experience including, where currently implemented:

- Home/dashboard.
- Applications.
- Job Scan.
- CV library.
- Career Profile.
- Evidence features.
- Settings.
- Existing seeded/local data until equivalent persisted data is available.

The migration should replace data/auth infrastructure incrementally instead of rewriting unrelated UI.

## 19. Lovable relationship after migration

Lovable remains an optional backup/editor.

It may continue to:

- Open the GitHub-backed CareerOS project.
- Provide visual editing or prototyping when credits are available.
- Preview changes.

It must not own or gate:

- Production authentication.
- Production Supabase data.
- Production environment credentials.
- Production deployment.
- The only editable copy of the application.

GitHub remains canonical.

## 20. Web-first scope

This migration covers the **web application only**.

The future mobile app is explicitly phase two.

The web architecture must nevertheless avoid decisions that would block a later React Native/Expo application from using the same Supabase backend, authentication model and Career Knowledge Bank.

## 21. Migration phases

### Phase 1: Foundation

- Audit existing Lovable-specific dependencies.
- Create the dedicated CareerOS Supabase project.
- Define schema and RLS policies.
- Establish independent environment configuration.

### Phase 2: Authentication

- Connect web app to the dedicated Supabase project.
- Implement and verify sign-in, session restoration and sign-out.
- Migrate Vinnie's initial account.
- Verify unauthenticated access is blocked.

### Phase 3: User-owned career data

- Add profile and Knowledge Bank storage.
- Seed/migrate Vinnie's existing CareerOS data carefully.
- Add user ownership and RLS verification.
- Preserve provenance and evidence state.

### Phase 4: Resume intelligence

- Connect resume refinement to the Knowledge Bank.
- Enforce user-specific evidence use.
- Add STAR/CAR guidance.
- Enforce 3 to 5 bullets for every employment role.
- Add targeted evidence-strengthening questions.
- Add resume-to-Knowledge-Bank update suggestions.

### Phase 5: Independent deployment

- Remove production dependency on Lovable build/runtime configuration.
- Configure independent hosting.
- Set production environment variables.
- Run end-to-end staging tests.
- Deploy independent CareerOS web app.

### Phase 6: Cutover and verification

- Verify production authentication.
- Verify user isolation.
- Verify Knowledge Bank CRUD.
- Verify resume generation uses only the active user's data.
- Verify 3 to 5 bullet rule and STAR/CAR checks.
- Verify existing CareerOS workflows still operate.
- Keep Lovable available as an optional editor.

## 22. Success criteria

The web migration is complete only when:

1. CareerOS can run and deploy without Lovable credits.
2. GitHub is the canonical source of code.
3. The production app uses a dedicated CareerOS Supabase project.
4. Vinnie can authenticate using `vjk16416@gmail.com`.
5. Unauthenticated users cannot access protected CareerOS content.
6. The architecture supports additional users with isolated career pathways.
7. Each user has an editable Career Knowledge Bank.
8. Users can add, edit, remove/archive and review their own knowledge.
9. Resume generation uses only the current user's own knowledge and evidence.
10. CareerOS explains STAR/CAR and applies it to job-responsibility bullets.
11. Every employment role normally contains 3 to 5 supported bullets.
12. Missing evidence triggers transparent optional follow-up questions instead of invented claims.
13. Resume edits can trigger explicit, user-approved Knowledge Bank update suggestions.
14. Row Level Security prevents cross-user access.
15. Existing CareerOS functionality is preserved through the migration.
16. Lovable remains optional rather than production-critical.
17. The architecture remains compatible with a later mobile-app phase.

## 23. Out of scope for this web migration

- Building the mobile app.
- Rebuilding CareerOS from scratch.
- Making Lovable the production dependency again.
- Automatic unapproved modification of a user's Knowledge Bank.
- Using another user's career data in a user's resume.
- Inventing unsupported achievements, metrics or responsibilities.

## 24. Next step after approval

After this design spec is reviewed and approved, create a detailed implementation plan covering:

- Exact Supabase schema.
- RLS policies.
- Authentication migration.
- Existing data migration.
- Removal/replacement of Lovable-specific build dependencies.
- Independent hosting configuration.
- Test strategy and cutover plan.

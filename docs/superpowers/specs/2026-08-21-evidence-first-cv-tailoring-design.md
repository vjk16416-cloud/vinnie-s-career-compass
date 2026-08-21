# Evidence-First CV Tailoring Design

## Goal
Build a controlled CV tailoring flow where a vacancy can produce a role-specific CV proposal while every material factual claim remains traceable to canonical CareerOS evidence.

## User flow
Job Scan → Evidence Selection → Master CV Selection → Tailoring → Review & Approval → Export.

## Design principles
- Knowledge Bank and canonical employment chronology are the factual source of truth.
- Verified and user-confirmed evidence may be used directly.
- Imported evidence is context only until the user has confirmed it for factual reuse.
- Needs-verification evidence is cautionary and cannot become a factual CV claim.
- Archived and excluded evidence is blocked.
- Canonical employer names, job titles and dates must never be invented or silently changed.
- Tailoring changes positioning and emphasis, not history.
- Every generated bullet or material claim carries evidence IDs for review.
- A generated CV remains Draft until explicitly approved.
- British English and the existing ATS-safe CareerOS CV format rules remain mandatory.

## Architecture
The existing resume subsystem remains the foundation. `generate-workflow.ts` loads canonical Supabase Knowledge Bank and employment data. The tailoring layer will be split into focused responsibilities: evidence eligibility and JD relevance ranking, master CV/category selection, proposal generation, and review provenance.

The existing application workspace remains the entry point. It will call the tailoring workflow and render a reviewable proposal rather than treating generated prose as implicitly approved.

## Evidence policy
### Eligible
- `verified`
- `user_confirmed`

### Context only
- `imported_cv`
- `imported_linkedin`
- `needs_verification`

### Blocked
- `archived`
- `excluded`

Context-only records can explain gaps or prompt the user for confirmation, but cannot be emitted as factual CV bullets.

## Master CV selection
CareerOS chooses the closest approved master/category based on the JD and scan signals. Initial supported families are Product / Product Management and Project / PMO / Delivery, with a deterministic fallback to the existing category suggestion. The selected master is a structural and positioning reference, never an authority that can override canonical evidence.

## Tailored proposal
The V1 proposal contains:
1. Professional profile
2. Core skills
3. Professional experience bullets
4. Relevant projects

Education, qualifications and chronology remain canonical. Each proposed material claim contains one or more Knowledge Bank evidence IDs. Role bullets target 3–5 supported bullets where evidence allows. Insufficient evidence creates an explicit gap rather than fabricated content.

## Review and approval
The application workspace will show proposed changes with three concepts: Original, Proposed, Evidence. The user can approve the complete draft in V1. The data model must retain claim-level provenance so later iterations can support approve/reject/replace per claim without rebuilding the generator.

## Persistence
Existing local CV version objects can continue to store the rendered body and aggregate `evidenceIds` during the first slice. The proposal model adds structured claim provenance in memory first. A later persistence migration can store structured proposals in Supabase once the interaction is proven.

## Testing
- Evidence policy tests prove context-only and blocked records cannot become CV claims.
- Relevance tests prove JD-aligned evidence outranks unrelated eligible evidence.
- Master selection tests cover Product and Project/PMO vacancies.
- Tailored CV tests prove chronology is preserved and every generated role bullet has provenance.
- Workflow tests prove canonical repositories are loaded before generation.
- Application integration tests prove a generated CV remains Draft until approval.

## V1 success criterion
A user can paste/import a vacancy, click Tailor CV, receive a complete proposed CV, inspect the evidence supporting its material claims, and approve it without CareerOS inventing experience, dates, metrics or qualifications.
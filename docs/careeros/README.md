# CareerOS Google Drive document mirrors

This directory contains Markdown mirrors of the current canonical CareerOS operational Google Docs.

Google Drive remains the source of truth for original career evidence, approved career documents and reusable career knowledge. GitHub remains the source of truth for application code and technical implementation. Supabase remains the source of truth for live workflow and application state.

Operational documents that exist in both Google Drive and this directory must be reconciled in the same update pass. Historical status records may remain in Drive only when clearly marked SUPERSEDED, and their old blockers must not be presented as current launch blockers.

Last manual sync: 22 August 2026

| Document | GitHub mirror | Google Drive document | Status |
| --- | --- | --- | --- |
| Master Career Profile | Drive-only, not mirrored here | [Open in Google Drive](https://docs.google.com/document/d/154AAI-KiLDpoZPDRmzX6UUn9n6niXHyeg1r09lWqs7c/edit) | APPROVED |
| Agent 01, Career OS Second Brain Sync | [agent-01-second-brain-sync.md](./agent-01-second-brain-sync.md) | [Open in Google Drive](https://docs.google.com/document/d/1mXXQRCbAStPrF93jwiFByHbMEoXPwEJ32_eDm7asxEg/edit) | APPROVED, v1.2 |
| Agent 02, CV and Cover Letter Reviewer and Fixer | [agent-02-reviewer-and-fixer.md](./agent-02-reviewer-and-fixer.md) | [Open in Google Drive](https://docs.google.com/document/d/1tcKwq618Yq709Wq9S3CmQMpqKP57hgfdi-dV0_janPg/edit) | APPROVED |
| Career OS Status and Readiness Checklist | [status-readiness-checklist-2026-08-22.md](./status-readiness-checklist-2026-08-22.md) | [Open in Google Drive](https://docs.google.com/document/d/1sJIcLdThNJeweCBgLQWaLdIxN2CqfvNHydLz8cswVO8/edit) | CURRENT IMPLEMENTATION RECORD |
| Drive mirror index | This README | [Open in Google Drive](https://docs.google.com/document/d/1-SDhl6wx3uIdKbYUgdXeJ512iJ7pEv1cBaV1wdhTpdM/edit) | CURRENT |

The previous 14 August readiness checklist is retained in Google Drive as `SUPERSEDED - Career OS Status & Readiness Checklist - 14 August 2026` for audit history only. Its blocker list is not current.

The Master Career Profile points to the latest approved CareerOS evidence and profile state as the authoritative baseline. Historical evidence audits are provenance only and must not override later approved evidence.

## Synchronisation rule

1. For code and technical implementation facts, establish current truth from GitHub.
2. For original career evidence, approved career documents and reusable career knowledge, establish current truth from Google Drive.
3. For live workflow and application state, Supabase is authoritative.
4. Update the relevant canonical document and its mirror in the same reconciliation pass.
5. Verify both copies after the write.
6. Never treat a GitHub mirror as approval. Only Vinnie's explicit confirmation changes a career artifact to APPROVED.
7. Never restore superseded blockers merely because they appear in an older status record.

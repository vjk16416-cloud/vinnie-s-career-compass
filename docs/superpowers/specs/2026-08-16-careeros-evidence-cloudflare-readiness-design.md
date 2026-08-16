# Career OS Evidence and Cloudflare Readiness Design

## Purpose

Bring the Career OS seeded career record into line with the July 2026 evidence audit and Vinnie's confirmed employment correction, then make the existing Cloudflare staging configuration verifiable and ready to publish.

## Evidence authority

- The evidence audit is the authority for claim support and project classification.
- Vinnie's later direct confirmation that Northeastern University London ended in December 2025 overrides older CV wording that says "Present".
- Vinnie's direct confirmation, the evidence audit and the supplied master CV are sufficient evidence for the recorded claims. Primary employer records are not required by Career OS.
- Academic concepts, founder projects, prototypes and commercial employment remain clearly separated.

## Career record changes

- End Northeastern University London in December 2025.
- Keep the £140k+ budget claim as verified from the supplied evidence and Vinnie's direct confirmation.
- Describe the 3D Bioprinting work using TRL, AD² and S-curve analysis. Do not classify Gartner Hype Cycle as verified by the final report.
- Expand Intentionally to reflect the current mobile-first MVP work, including product vision, core journey, MVP scope, roadmap, safety requirements, documentation and clickable prototype.
- Add Atlas as a separate internal founder decision-support concept and static prototype, with no claim of production deployment.
- Keep National Autistic Society and Infinite Entertainment UK employment types unqualified because the audit does not establish them consistently.

## Cloudflare deployment

- Use a Cloudflare Worker with static assets for the full-stack TanStack Start output.
- Preserve separate `careeros-staging` and `careeros` Worker names.
- Keep Supabase as the authentication and data backend.
- Supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. Never expose a Supabase service-role key through a `VITE_` variable.
- Validate locally before publishing. Publish staging only after tests, lint and build succeed.

## Testing and acceptance

- Automated tests assert the corrected employment date, project classifications and evidence statuses.
- The complete test suite passes.
- ESLint completes without errors.
- The production build completes.
- The Cloudflare bundle passes a Wrangler dry run before staging deployment.
- The staging deployment returns a Worker URL and is checked for a successful HTTP response where access permits.

## Scope boundaries

- No production deployment in this task.
- No editing of the supplied audit or master CV files.
- Claims contradicted by the audit, including managed-team, commercial-launch and production-Atlas claims, remain excluded.
- No unrelated product features or UI redesigns are included.

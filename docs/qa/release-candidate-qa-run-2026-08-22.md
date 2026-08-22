# Career OS Release Candidate QA Run

Run date: 22 August 2026  
QA branch: `agent/release-candidate-qa-2026-08-22`  
Draft QA PR: #29  
Baseline `main` at QA start: `6f627aef0c0ab2a84bc512f0c57e6a9cfbf02c87`  
Final QA head covered by the recorded browser and deployment evidence: `a82b7d8332e69404773d09ebe87c88ae21449679`  
Purpose: independently verify the launch-critical Career OS flow and distinguish code-level verification, live unauthenticated browser verification, live backend verification and tests that require Vinnie's authenticated Google session.

## Executive verdict

**Release classification: RELEASE CANDIDATE, NOT YET LAUNCH READY.**

No previously retired P0 defect was reproduced during this QA run. Authentication initiation, signed-out route protection, the automated Career OS workflow, review gates, persistence implementation, production database security configuration, Cloudflare builds and Cloudflare previews all passed the tests available to the QA agent.

The remaining launch gate is not a known code failure. It is the missing **authenticated live end-to-end browser proof** using the authorised Google account. That final pass must prove the private workflow from sign-in through READY TO APPLY, including real job intake, saved state after refresh, Google Drive read-only permission and the private desktop/mobile UI.

### Evidence summary

- PASS: frozen dependency install.
- PASS: 37 automated test files.
- PASS: 192 automated tests, 0 failures.
- PASS: lint with 0 errors and 9 non-blocking Fast Refresh warnings.
- PASS: production Cloudflare-targeted build.
- PASS: live Cloudflare branch preview responds successfully.
- PASS: Google-only sign-in surface rendered on the deployed preview.
- PASS: real Google OAuth initiation from the Cloudflare preview reaches `accounts.google.com` through `careeros-production` Supabase.
- PASS: `/applications`, `/job-scan`, `/cvs`, `/profile`, `/evidence` and `/settings` remain protected while signed out, verified both by HTTP smoke checks and Chromium.
- PASS: no horizontal page overflow on the signed-out surface at 1440px, 768px, 375px and 320px widths.
- PASS: Cloudflare successfully deployed QA commit `a82b7d83` to both the repository preview service and `careeros-staging`.
- PASS: `careeros-production` Supabase project reports ACTIVE_HEALTHY.
- PASS: all eight public database tables have RLS enabled.
- PASS: ownership policies are present for the exposed Career OS tables and use `auth.uid() = user_id` style ownership checks, with `WITH CHECK` on updates/inserts.
- PASS: live `career_state` persistence exists in production, with one current state row containing saved jobs, applications, CVs and a cover letter.
- ADVISORY: Google sign-in control is 40px high on tablet/mobile layouts. This exceeds the WCAG 2.2 AA 24x24 CSS pixel minimum, but is below the stronger 44px touch-friendly target.
- ADVISORY: Supabase security advisor reports leaked-password protection disabled. Career OS currently exposes Google-only sign-in, so this is not treated as a launch blocker unless password authentication is enabled.
- ADVISORY: Supabase performance advisor reports several unindexed foreign keys and currently unused indexes. These are optimisation items, not observed release blockers for the present single-user workload.
- BLOCKED BY AUTHENTICATED SESSION: full private browser journey, private responsive UI, refresh/second-browser persistence, live Drive permission/folder listing/source registration and actual exported-file inspection.

## Test status legend

- PASS: test evidence confirms the expected behaviour on the stated surface.
- FAIL: observed behaviour does not meet the expected result.
- BLOCKED: the test cannot be completed without an authorised interactive session or another unavailable test surface.
- ADVISORY: quality or maintainability finding that is not an observed P0 launch failure.

## Gate A: repository verification

**Status: PASS**

- [PASS] Install dependencies from the locked dependency graph with `bun install --frozen-lockfile`.
- [PASS] Run the complete automated test suite, 37 files and 192 tests passed.
- [PASS] Run lint, 0 errors, 9 `react-refresh/only-export-components` warnings.
- [PASS] Build the production Cloudflare Worker bundle.
- [PASS] QA branch was created directly from `main` commit `6f627aef0c0ab2a84bc512f0c57e6a9cfbf02c87`.

Build advisories:

- `vite-tsconfig-paths` is now redundant because current Vite supports native tsconfig path resolution.
- Nitro reports the source Wrangler `main` and `assets` fields are overridden in the generated Cloudflare config.
- `inlineDynamicImports` is ignored when `codeSplitting` is specified.

None caused a build failure.

## Gate B: authentication

**Status: PARTIAL PASS, AUTHENTICATED COMPLETION BLOCKED**

Expected result:

- Google sign-in is the supported authentication route.
- Authorised user can enter the private Career OS application.
- Session restoration works after refresh.
- Sign-out ends the private session.

Evidence:

- [PASS] Automated authentication tests, including Google-only login presentation, authorisation policy, route guards, OAuth functions and error handling.
- [PASS] Deployed preview displays Google-only sign-in. No password, magic-link or sign-up fallback was found.
- [PASS] Chromium clicked `Sign in with Google` on the deployed Cloudflare QA preview and reached the real Google OAuth screen.
- [PASS] OAuth request used the `careeros-production` Supabase callback endpoint.
- [PASS] Supabase auth logs from the preceding production usage window show successful Google-provider redirect, login/token activity and `/user` responses with HTTP 200. This is supporting production evidence, not a substitute for the current QA-branch authenticated journey.
- [BLOCKED] Complete Google account sign-in on the QA preview, because the QA agent does not impersonate or enter credentials for Vinnie's Google account.
- [BLOCKED] Current-run refresh/session restoration in an authenticated browser.
- [BLOCKED] Current-run live sign-out.

Release interpretation: OAuth initiation and production auth infrastructure are functioning. Final launch sign-off still requires one authorised interactive sign-in on the exact release candidate.

## Gate C: job intake and analysis

**Status: AUTOMATED PASS, LIVE AUTHENTICATED TEST BLOCKED**

Expected result:

- A job can be supplied by URL or manual JD paste.
- URL extraction does not silently overwrite manually entered JD text.
- Extraction quality and fallback behaviour are visible.
- Analyse Role stores and analyses the current JD.

Evidence:

- [PASS] `job-extract.server` regression suite.
- [PASS] Job Scan regression confirms extracted text does not silently replace a manually pasted JD.
- [PASS] Job Scan regression confirms manual JD input is recorded as manual input.
- [PASS] Analyse Role regression confirms current JD state is saved and analysed.
- [BLOCKED] Live URL extraction with a real advert inside an authenticated QA session.
- [BLOCKED] Live manual-paste fallback inside an authenticated QA session.

No old Job URL or Analyse Role blocker was reproduced in the automated implementation tests.

## Gate D: compatibility score and Evidence Map

**Status: AUTOMATED PASS, LIVE AUTHENTICATED TEST BLOCKED**

Expected result:

- The role scan produces an explainable compatibility assessment.
- Requirement-level Evidence Map states include Covered, Partial, Gap and Blocked where applicable.
- Unsupported evidence is not presented as verified support.

Evidence:

- [PASS] Evidence Map scoring tests passed.
- [PASS] Job Scan UI regression renders requirement-level evidence behind the compatibility score.
- [PASS] Trust-control tests require explicit confirmation before evidence changes to Verified or Excluded.
- [BLOCKED] Visual inspection of the Evidence Map for a newly entered real job on the QA preview.

## Gate E: CV generation and versioning

**Status: AUTOMATED PASS, LIVE AUTHENTICATED TEST BLOCKED**

Expected result:

- A tailored CV can be generated from Career OS evidence.
- Existing versions are preserved.
- Current version can be previewed and compared.
- Unsupported claims are not silently promoted as verified evidence.

Evidence:

- [PASS] Profile-based generation tests.
- [PASS] Application workflow test confirms CV preview, comparison and export controls for saved versions.
- [PASS] Evidence confirmation controls passed.
- [PASS] Final review is bound to the exact CV version.
- [BLOCKED] Generate a new CV from a live real-role QA application.
- [BLOCKED] Private-page visual inspection of that CV.

## Gate F: CV export

**Status: AUTOMATED PASS, LIVE OUTPUT INSPECTION BLOCKED**

Expected result:

- Current CV can be exported through the implemented Word-compatible `.doc` route.
- Browser Print / Save as PDF route is available.
- Export controls operate on the selected saved version.

Evidence:

- [PASS] CV export unit tests.
- [PASS] Application workflow test confirms export controls on saved CV versions.
- [BLOCKED] Download a real tailored CV from an authenticated preview session.
- [BLOCKED] Open the generated Word-compatible file and inspect final formatting.
- [BLOCKED] Run the browser Print / Save as PDF route from an authenticated application.

Important product truth: native `.docx` generation and server-side native PDF generation are not part of the currently verified baseline.

## Gate G: cover letter

**Status: AUTOMATED PASS, LIVE AUTHENTICATED TEST BLOCKED**

Expected result:

- A role-specific cover letter can be generated from supported evidence.
- Versions are preserved.
- Current version can be exported.

Evidence:

- [PASS] Application workflow tests confirm preview, comparison, approval and export controls.
- [PASS] A newer cover-letter draft preserves earlier versions.
- [PASS] Final review invalidates when the reviewed cover-letter version changes.
- [BLOCKED] Generate and export a new live cover letter on the QA preview.

## Gate H: final review and approval

**Status: AUTOMATED PASS, LIVE AUTHENTICATED TEST BLOCKED**

Expected result:

- Final Review is bound to the current saved JD, role scan, CV version and cover-letter version.
- A material change invalidates an older review.
- Approval remains locked until the current review passes.
- READY TO APPLY requires a current passing review plus explicit approval of current documents.

Evidence:

- [PASS] Review is invalidated by a new CV draft.
- [PASS] Review is invalidated by a new cover-letter draft.
- [PASS] Review is invalidated by a new role scan.
- [PASS] Review is blocked when JD edits are unsaved.
- [PASS] Review history remains immutable.
- [PASS] Document approval remains locked before a current passing review.
- [PASS] Explicit approval unlocks after a current passing review.
- [PASS] READY TO APPLY occurs only after a passing current review plus both explicit document approvals.
- [BLOCKED] Execute the full review and approval sequence in an authenticated live browser.

This is one of the strongest automated areas of the release candidate.

## Gate I: Supabase persistence

**Status: LIVE BACKEND PASS, CROSS-BROWSER UX TEST BLOCKED**

Expected result:

- Current Career OS state persists to Supabase.
- Browser refresh does not lose saved state.
- A fresh browser or second device sees expected state after authentication.
- Conflict and ordered-save behaviour do not corrupt newer data.

Evidence:

- [PASS] `careeros-production` project status is ACTIVE_HEALTHY.
- [PASS] Repository persistence tests passed.
- [PASS] Cloud store tests passed, including the rule that durable cache is not updated until cloud save succeeds.
- [PASS] Ordered save queue tests passed for write order, failure recovery and stale queued writes.
- [PASS] Live production database contains one `career_state` row.
- [PASS] The live saved state snapshot contains 2 applications, 6 jobs, 2 CVs and 1 cover letter at the time of the read-only QA query.
- [PASS] All 8 public Career OS tables have RLS enabled.
- [PASS] Ownership policies use authenticated user ownership checks. UPDATE policies include both `USING` and `WITH CHECK` ownership conditions where applicable.
- [BLOCKED] Refresh the exact QA application after making a new live change.
- [BLOCKED] Confirm the same new state in a fresh authenticated browser or second device.

Database advisories:

- Security advisor: leaked-password protection disabled. Non-blocking for the current Google-only UI, but should be revisited if password auth is ever enabled.
- Performance advisor: several composite foreign keys lack covering indexes. This is a scale/performance improvement, not a reproduced functional failure for the current single-user product.

## Gate J: Google Drive read-only integration

**Status: CODE-LEVEL PASS, LIVE APP PERMISSION TEST BLOCKED**

Expected result:

- Drive permission is explicitly granted.
- Career OS can list permitted folders and register source references.
- Integration does not edit, move, delete or silently archive Drive files.

Evidence:

- [PASS] Drive integration test explicitly requests the read-only scope and `prompt: consent`.
- [PASS] Folder parsing test.
- [PASS] Drive listing code uses HTTP GET with bearer token.
- [PASS] Drive errors fail safely.
- [PASS] Trust-control test states that Drive files are listed only after a real Google provider token exists.
- [BLOCKED] Grant Drive read-only scope from the live Career OS Settings page using the authorised Google account.
- [BLOCKED] List the actual Career OS folder through the app.
- [BLOCKED] Register a source from that live listing.

The ChatGPT Google Drive connector is separately operational, but it is not accepted as proof that the Career OS application's own Google OAuth token and Drive permission path work.

## Gate K: desktop and mobile UX

**Status: PUBLIC/AUTH SHELL PASS, PRIVATE WORKSPACE BLOCKED**

Browser matrix tested on deployed Cloudflare preview:

| Viewport | Horizontal overflow | Google sign-in target | Result |
| --- | ---: | ---: | --- |
| 1440x900 | 0px | 398x40px | PASS |
| 768x1024 | 0px | 398x40px | PASS with touch-size advisory |
| 375x812 | 0px | 293x40px | PASS with touch-size advisory |
| 320x700 | 0px | 238x40px | PASS with touch-size advisory |

Additional signed-out browser checks:

- [PASS] `/applications` protected in Chromium.
- [PASS] `/job-scan` protected in Chromium.
- [PASS] `/cvs` protected in Chromium.
- [PASS] `/profile` protected in Chromium.
- [PASS] `/evidence` protected in Chromium.
- [PASS] `/settings` protected in Chromium.
- [PASS] No obvious server failure markers on the public/login surface.
- [PASS] Google sign-in button is keyboard/browser actionable and initiates OAuth.
- [ADVISORY] Touch layouts use a 40px-high Google sign-in control. It clears the WCAG 2.2 Level AA 24px minimum but a 44px or larger touch target would be stronger mobile polish.
- [BLOCKED] Private desktop navigation/back-navigation check after login.
- [BLOCKED] Private Job Scan layout after login.
- [BLOCKED] Application workspace responsive stacking after login.
- [BLOCKED] CV/cover-letter preview and export controls on mobile after login.
- [BLOCKED] Final Review/approval controls on mobile after login.

## Gate L: deployment identity

**Status: PASS FOR QA PREVIEW**

Expected result:

- Tested deployment is a Career OS Cloudflare Worker.
- Worker configuration uses the expected staging identity during release verification.
- Exact tested commit/deployment relationship is recorded.

Evidence:

- [PASS] Wrangler configuration regression tests passed.
- [PASS] Production build passed.
- [PASS] Cloudflare reported successful deployment for commit `a82b7d83` to `vinnie-s-career-compass`.
- [PASS] Cloudflare reported successful deployment for the same commit `a82b7d83` to `careeros-staging`.
- [PASS] QA browser and HTTP smoke tests ran against the branch preview produced from this QA branch.
- [PASS] `careeros-staging` has its own commit and branch preview URL tied to the same QA commit.

Recorded Cloudflare QA identities:

- Repository service commit preview: `https://c99bce80-vinnie-s-career-compass.vjk16416.workers.dev`
- Repository service branch preview: `https://agent-release-candidate-qa-2026-08-22-vinnie-s-career-compass.vjk16416.workers.dev`
- `careeros-staging` commit preview: `https://fa37be74-careeros-staging.vjk16416.workers.dev`
- `careeros-staging` branch preview: `https://agent-release-candidate-qa-2026-08-22-careeros-staging.vjk16416.workers.dev`

The duplicate Cloudflare service naming is not itself a failed test, but the release process should continue to treat `careeros-staging` as the intended Career OS staging identity and avoid ambiguity when promoting to the final production service.

## Remaining launch-critical authenticated script

The following single controlled session completes the outstanding release proof:

1. Open the exact release-candidate `careeros-staging` preview.
2. Sign in with the authorised Google account.
3. Confirm private dashboard loads and cloud status is healthy.
4. Add one real role by URL.
5. Confirm extracted JD title/company/body and extraction completeness.
6. If extraction is incomplete, paste the real JD manually and confirm the fallback is explicit.
7. Click Analyse Role.
8. Inspect compatibility score and requirement-level Evidence Map.
9. Generate a tailored CV.
10. Confirm version history and compare view.
11. Export the CV and inspect the Word-compatible output.
12. Exercise Print / Save as PDF and inspect the print preview.
13. Generate a cover letter.
14. Confirm version history and export.
15. Run Final Review.
16. Verify approval remains locked until the current review passes.
17. Approve the current CV and current cover letter.
18. Confirm READY TO APPLY.
19. Refresh the browser and verify the application, versions, approvals and review remain.
20. Open a fresh browser profile or second device, sign in, and verify the same state.
21. Open Settings and grant Google Drive read-only permission.
22. List the intended Career OS Drive folder.
23. Register one real source reference.
24. Confirm no Drive edit/move/delete/archive capability is exposed.
25. Repeat the main private workflow inspection at desktop width and at 375px/320px mobile width, checking navigation, workspace stacking, previews, exports and approval controls.

If all 25 steps pass on the exact build intended for promotion, the QA recommendation changes from RELEASE CANDIDATE to LAUNCH READY.

## Current blocker list after QA

There are **no reproduced historical P0 defects** in this run.

The only P0 release block is:

- **Authenticated end-to-end live proof is incomplete.** The QA agent can initiate OAuth but cannot impersonate the authorised Google account to complete the private session.

No other observed result currently justifies restoring the old blockers for Job URL, Analyse Role, scoring, downloads, reviewer or Cloudflare build/deployment.

## Non-blocking follow-up work

- Increase touch-target height toward 44px on touch layouts for stronger usability.
- Clean the 9 React Fast Refresh lint warnings.
- Remove or replace the redundant `vite-tsconfig-paths` plugin.
- Review the Nitro/Wrangler override warnings and document why the generated config is authoritative.
- Review Supabase foreign-key index advisories before data volume grows.
- Revisit leaked-password protection only if password authentication becomes part of the supported product.
- Decide whether native `.docx`, server-generated PDF or automatic Drive archival are v1 requirements rather than later enhancements.

## Release decision rule

Career OS is LAUNCH READY only when all launch-critical tests are PASS or an explicitly accepted non-blocking limitation is documented. A previous historical blocker must not be restored unless the failure is observed again in a current QA run.

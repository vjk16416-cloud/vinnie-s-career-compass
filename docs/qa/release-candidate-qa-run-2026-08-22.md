# Career OS Release Candidate QA Run

Run date: 22 August 2026
Branch: `agent/release-candidate-qa-2026-08-22`
Baseline: current `main` at the start of the run
Purpose: independently verify the launch-critical Career OS flow and distinguish code-level verification from live-browser verification.

## Test status legend

- PASS: test evidence confirms the expected behaviour.
- FAIL: observed behaviour does not meet the expected result.
- BLOCKED: the test cannot be completed with the current test surface or credentials.
- NOT RUN: test has not yet been executed.

## Gate A: repository verification

- [NOT RUN] Install dependencies from the locked dependency graph.
- [NOT RUN] Run the complete automated test suite.
- [NOT RUN] Run lint.
- [NOT RUN] Build the production Cloudflare Worker bundle.
- [NOT RUN] Confirm the test branch is based on the intended current `main` commit.

## Gate B: authentication

Expected result:
- Google sign-in is the supported authentication route.
- Authorised user can enter the private Career OS application.
- Session restoration works after refresh.
- Sign-out ends the private session.

Tests:
- [NOT RUN] Automated authentication tests.
- [NOT RUN] Live Google OAuth sign-in.
- [NOT RUN] Refresh and session restoration.
- [NOT RUN] Sign-out.

## Gate C: job intake and analysis

Expected result:
- A job can be supplied by URL or manual JD paste.
- URL extraction does not silently overwrite manually entered JD text.
- Extraction quality and fallback behaviour are visible.
- Analyse Role stores and analyses the current JD.

Tests:
- [NOT RUN] Job URL extraction regression tests.
- [NOT RUN] Manual JD input regression tests.
- [NOT RUN] Analyse Role regression test.
- [NOT RUN] Live URL extraction using a real job advert.
- [NOT RUN] Live manual-paste fallback.

## Gate D: compatibility score and Evidence Map

Expected result:
- The role scan produces an explainable compatibility assessment.
- Requirement-level Evidence Map states include Covered, Partial, Gap and Blocked where applicable.
- Unsupported evidence is not presented as verified support.

Tests:
- [NOT RUN] Scoring and Evidence Map automated tests.
- [NOT RUN] Evidence-safety regression tests.
- [NOT RUN] Live inspection of one real role scan.

## Gate E: CV generation and versioning

Expected result:
- A tailored CV can be generated from verified Career OS evidence.
- Existing versions are preserved.
- Current version can be previewed and compared.
- Unsupported claims are not introduced.

Tests:
- [NOT RUN] CV generation automated tests.
- [NOT RUN] CV versioning workflow tests.
- [NOT RUN] Evidence and profile source tests.
- [NOT RUN] Live CV generation from the tested role.
- [NOT RUN] Live CV visual inspection.

## Gate F: CV export

Expected result:
- The selected CV can be exported through the implemented Word-compatible `.doc` route.
- Browser Print / Save as PDF route is available.
- Export controls act on the current selected version.

Tests:
- [NOT RUN] Automated export-control coverage.
- [NOT RUN] Live Word-compatible CV export.
- [NOT RUN] Live browser Print / Save as PDF path.
- [NOT RUN] Open exported output and inspect basic formatting.

## Gate G: cover letter

Expected result:
- A role-specific cover letter can be generated from verified evidence.
- Versions are preserved.
- The current version can be exported.

Tests:
- [NOT RUN] Cover-letter workflow tests.
- [NOT RUN] Cover-letter versioning tests.
- [NOT RUN] Live cover-letter generation.
- [NOT RUN] Live export.

## Gate H: final review and approval

Expected result:
- Final Review is bound to the current saved JD, role scan, CV version and cover-letter version.
- A material change invalidates an older review.
- Approval remains locked until the current review passes.
- READY TO APPLY requires a current passing review plus explicit approval of the current documents.

Tests:
- [NOT RUN] Review version-binding regression tests.
- [NOT RUN] Outdated-review invalidation tests.
- [NOT RUN] Approval-lock tests.
- [NOT RUN] READY TO APPLY regression tests.
- [NOT RUN] Live review and approval journey.

## Gate I: Supabase persistence

Expected result:
- Current Career OS state persists to Supabase.
- Browser refresh does not lose saved application state.
- A fresh browser or second device sees the expected saved state after authentication.
- Conflict and ordered-save behaviour do not corrupt newer data.

Tests:
- [NOT RUN] Repository persistence tests.
- [NOT RUN] Ordered-save and conflict tests.
- [NOT RUN] Live refresh persistence test.
- [NOT RUN] Fresh-browser or second-device persistence test.

## Gate J: Google Drive read-only integration

Expected result:
- Drive permission is explicitly granted by the user.
- Career OS can list permitted folders and register source references.
- The integration does not edit, move, delete or silently archive Drive files.

Tests:
- [NOT RUN] Drive integration code-level verification.
- [NOT RUN] Live permission grant.
- [NOT RUN] Live folder listing.
- [NOT RUN] Live source registration.
- [NOT RUN] Confirm no write behaviour is exposed.

## Gate K: desktop and mobile UX

Desktop checks:
- [NOT RUN] Navigation and back-navigation.
- [NOT RUN] Job Scan layout.
- [NOT RUN] Application workspace tabs/panels.
- [NOT RUN] CV preview usability.
- [NOT RUN] Download controls.
- [NOT RUN] Review and approval states.
- [NOT RUN] No page-level horizontal scrolling.
- [NOT RUN] Keyboard access to primary controls.

Mobile checks:
- [NOT RUN] 320px-class layout.
- [NOT RUN] Primary navigation.
- [NOT RUN] Job input and scan results.
- [NOT RUN] Application workspace stacking.
- [NOT RUN] Large enough touch targets.
- [NOT RUN] No horizontal page overflow.
- [NOT RUN] Export and approval controls remain usable.

## Gate L: deployment identity

Expected result:
- Tested deployment is the intended Career OS Cloudflare Worker.
- Worker configuration uses the expected staging identity during release verification.
- Final launch sign-off records the exact tested commit/deployment relationship.

Tests:
- [NOT RUN] Wrangler configuration regression test.
- [NOT RUN] Production build verification.
- [NOT RUN] Confirm live staging URL and deployment identity.
- [NOT RUN] Confirm exact commit represented by the tested live Worker.

## Release decision rule

Career OS is LAUNCH READY only when all launch-critical tests are PASS or an explicitly accepted non-blocking limitation is documented. A previous historical blocker must not be restored unless the failure is observed again in this QA run.

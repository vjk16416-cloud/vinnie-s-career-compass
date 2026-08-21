# CareerOS workflow clarity note

This bounded Sprint 7 slice keeps the existing Job -> Match -> Evidence -> CV -> Cover Letter -> Apply architecture unchanged.

The UX problem is that the six stages currently render as plain tabs. Users must infer what is complete, what is current and what should happen next.

The proposed change adds a compact application progress summary above the application workspace. It shows all six stages, completed-stage count and one explicit next action derived from the current saved job, scan, evidence map, CV, cover letter and final-review gate.

The progress guidance does not change evidence rules, reviewer outcomes, approval rules, data models or application state. It is presentation plus deterministic guidance over existing CareerOS state.

Verification note: repository GitHub Actions is configured to run the full test, lint and build suite on pushes to agent/** branches and pull requests targeting main. This integration cannot currently read push-triggered workflow runs, so the PR remains unmerged until a trustworthy verification result is visible.

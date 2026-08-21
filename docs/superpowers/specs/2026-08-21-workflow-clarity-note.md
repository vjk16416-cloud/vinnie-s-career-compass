# CareerOS workflow clarity note

This bounded Sprint 7 slice keeps the existing Job -> Match -> Evidence -> CV -> Cover Letter -> Apply architecture unchanged.

The UX problem is that the six stages currently render as plain tabs. Users must infer what is complete, what is current and what should happen next.

The change adds a compact application progress summary above the tabs. It will show all six stages, completed-stage count and one explicit next action. It does not alter evidence rules, review logic, approval logic, data models or application state.

# Agent Instructions

This repo follows the David OS working style:

- Work on `main` unless David explicitly asks for a feature branch or PR.
- Commit and push useful work promptly.
- Keep the deterministic rules engine separate from AI explanation code.
- Do not let model output decide admission periods, grace periods, filing deadlines, or source citations.
- Cite official sources for every rule-derived result.
- Treat F-1 as the first supported rules module. Leave J-1/M-1 expansion behind explicit scope flags.
- Do not paste or commit private corpus/API data, student records, API keys, or document scans.
- Keep document-assisted intake optional, transient by default, and user-confirmed before facts enter the calculator.
- Verify date logic with fixed-input tests before changing rule behavior.
- Maintain `docs/BUILD_WEEK_LOG.md` as the project moves: log research sources, product/legal decisions, and concrete ways Codex assisted. This is part of the Build Week/hackathon story, not just internal notes.

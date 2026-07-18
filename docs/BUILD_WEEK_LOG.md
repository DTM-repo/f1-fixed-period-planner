# Build Week Log

Purpose: keep a running record of research, decisions, implementation steps, and how Codex helped. This should support the final Build Week/hackathon narrative without reconstructing the work from memory.

## How to Use This Log

Add an entry after every meaningful session or decision point.

Each entry should capture:

- **Research:** short source notes and links, not pasted source dumps.
- **Decisions:** product, legal/rules-engine, privacy, UX, scope, and deployment choices.
- **Codex assistance:** what Codex actually did: source review, synthesis, code, tests, verification, repo hygiene, deployment prep, etc.
- **Open questions:** anything unresolved that should shape the next session.

## 2026-07-18

### Project Setup and Source Grounding

**Research**

- Reviewed DHS final rule published July 17, 2026: `Establishing a Fixed Time Period of Admission and an Extension of Stay Procedure for Nonimmigrant Academic Students, Exchange Visitors, and Representatives of Foreign Information Media`.
- Confirmed effective date: September 15, 2026.
- Pulled key F-1 transition concepts from the rule: D/S transition treatment, four-year transition cap, F-1 60-day departure period, fixed-period admission after effective date, OPT/STEM OPT transition filing treatment, and pending extension/travel complications.
- Official source: https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant
- Local rule copy: `/Users/davidmaxon/Documents/New project/D:S Rule app/New D:S Rules.pdf`.

**Decisions**

- Build F-1 first. J-1 and M-1 are not folded casually into the initial calculator.
- Include both current F-1 students and incoming/prospective F-1 students.
- Keep legal/date calculations deterministic. AI may explain, intake, summarize, and ask follow-ups, but it should not decide deadlines or citations.
- The app must still work if the AI explanation call fails.
- David's separate international-student regulatory/legal/best-practices API and corpus can support targeted research, but should not become the runtime source of legal conclusions.

**Codex Assistance**

- Located and copied David's prototype/source folder from Downloads into the working area despite Finder/path confusion.
- Read David OS from canonical GitHub context and followed the `main`-branch, commit-and-push working rule.
- Created private GitHub repo `DTM-repo/f1-fixed-period-planner`.
- Scaffolded Vite + React + TypeScript + Vitest + Netlify Functions app.
- Implemented first deterministic F-1 rules engine and 5 fixed-input tests.
- Built the first structured calculator UI, rough narrative/speech intake, source-backed findings/timeline, and OpenAI explanation endpoint.
- Ran `npm run test`, `npm run build`, and browser verification on desktop/mobile.
- Pushed initial commit `8a3df14` to `main`.

### UX Pivot: From Calculator to Student Story

**Research**

- Reviewed plain-language and internationalization guidance relevant to non-native English speakers:
  - Digital.gov plain-language principles: https://digital.gov/guides/plain-language/principles
  - Dumas and Redish, "Using Plain English in Designing the User Interface": https://journals.sagepub.com/doi/abs/10.1177/154193128603001216
  - Kukulska-Hulme, "Communication with users: insights from second language acquisition": https://oro.open.ac.uk/11625/
  - W3C Internationalization Quick Tips: https://www.w3.org/International/quicktips/index
  - WCAG language-of-page guidance: https://www.w3.org/WAI/WCAG22/Understanding/language-of-page

**Decisions**

- The first committed UI is useful but too dense and expert-facing.
- The student-facing app should not expose all inputs at once.
- Students should not be asked to self-identify with expert labels like "current D/S, long program."
- The intake should ask one plain-language question at a time only when direct confirmation is needed.
- Preferred opening direction: black screen, typed introductory copy, a blinking-light "click to start talking" path, and a smaller "Get interviewed instead" path.
- Refined intake model: story-first is the default, but it should not mean voice-only. Students should be able to tell their story by speaking or typing.
- The interview route should still be progressive, plain-language, and student-centered. It should default to text because students who avoid freeform speech are also unlikely to prefer a spoken interview, but voice can remain an optional accessibility/comfort layer.
- Internal rule-engine terms should stay behind the scenes unless surfaced as plain explanations in context.
- Results should be visual and personalized: the student's F-1 clock, safe dates, risk points, and scenario comparisons.

**Codex Assistance**

- Helped translate the critique into a product architecture shift: hidden deterministic machinery, narrative-first intake, confirmation cards, progressive interview fallback, and visual student-specific results.
- Identified research-backed UX principles for non-native English users: avoid jargon and idioms, provide verbal context around specialized terms, use concise text, support international date/name expectations, and expose technical detail only when useful.

**Open Questions**

- What exact opening copy should ship for the first Build Week demo?
- Should the first talking path use browser speech recognition, OpenAI audio transcription, or both?
- What is the best visual metaphor for the result: timeline, status clock, journey map, decision tree, or combination?
- How should the app handle translation or multilingual support in the first demo without overcommitting?

### Logic QA: No False Results

**Research**

- Rechecked the official Federal Register final rule text against the engine branches for fixed admission, D/S transition, OPT/STEM transition treatment, pending extension travel, and F-1 preparation-for-departure periods.
- Confirmed a key split that the first prototype blurred: D/S transition F-1 students use the transition 60-day F-1 departure period, while new/readmitted fixed-period F-1 admissions use the fixed-period 30-day departure/maintain-status period.
- Confirmed that transition OPT/STEM treatment depends on specific filing windows and, for STEM OPT, the current OPT EAD end date.

**Decisions**

- Adopted David's bright-line safety standard: the app must never give a confident false result. If confirmed facts or a fully modeled rule branch are missing, the result should show the safe partial answer, explain conditional branches, and ask for the missing fact.
- Known danger findings now outrank other status signals so concrete risks are not softened.
- Refined the safety standard after David's correction: no false result should mean "give every source-backed partial result and conditional branch available," not "stop early."
- Month-name student-entered dates are normalized; numeric slash/dot dates become targeted follow-up questions because date order varies by country. The app keeps any safe dates that do not depend on the ambiguous date.
- The rough structured calculator should also avoid compact numeric dates. Date controls now use explicit Month / Day / Year inputs instead of a single browser date box.
- Fixed-period OPT/STEM admission after the effective date surfaces the ordinary fixed-period context, then asks for the approved EAD, pending I-765, DSO recommendation, travel, and admission facts needed to sharpen the OPT/STEM branch.
- Approved OPT/STEM transition results show the I-20-based transition dates already available and explain how the EAD end date would change the result.

**Codex Assistance**

- Found and fixed the fixed-period F-1 departure-period bug: incoming/readmitted fixed-period F-1 now uses 30 days instead of the transition 60 days.
- Hardened the deterministic engine so questions and danger findings escalate top-level status.
- Revised the engine to normalize safe date formats, preserve partial results for ambiguous dates, and show conditional context for missing EAD facts.
- Replaced the prototype's compact date input with separate Month / Day / Year controls.
- Reworked travel findings to compare stay-put D/S transition outcomes with ordinary fixed-period return outcomes, including the 30-day fixed-period post-period.
- Added source ID coverage for 8 CFR 214.2(f)(5)(v).
- Expanded deterministic scenario tests around cap dates, EAD dates, normalized/ambiguous dates, STEM OPT timing, pending extension travel, AVR, and fixed-period OPT/STEM conditional context.
- Verified the rules module with a full TypeScript compile plus an isolated TypeScript compile and Node assertion run after Vite/Vitest CLI commands hung before reporting in this local Node v24.14.0 environment, including `--version` checks.

**Open Questions**

- Diagnose why the Vite/Vitest wrappers hung locally even though direct TypeScript compilation and isolated engine assertions passed.
- Build a dedicated approved OPT/STEM status-end branch only after source-backed data requirements are explicit.

### Local Preview Setup

**Decisions**

- Active development should use the local clone at `/Users/davidmaxon/Projects/f1-fixed-period-planner`, not the iCloud-backed Documents clone. GitHub remains canonical.
- Use local preview for rapid iteration. Netlify can wait until David needs an external share link or production-style deploy.

**Codex Assistance**

- Cloned the GitHub repo into `/Users/davidmaxon/Projects/f1-fixed-period-planner`.
- Ran `npm ci`, `npm run test`, and `npm run build` successfully from the local clone.
- Started Vite preview at `http://127.0.0.1:5177/`.
- Confirmed the page responds with HTTP 200 and captured a Chrome screenshot showing the calculator UI and explicit Month / Day / Year controls.

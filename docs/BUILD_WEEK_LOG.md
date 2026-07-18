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
- The interview route should still be progressive, plain-language, and student-centered.
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

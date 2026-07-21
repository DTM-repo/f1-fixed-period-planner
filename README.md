# F-1 Duration Mapper

F-1 Duration Mapper is an OpenAI Build Week app that turns DHS's July 17, 2026 duration-of-status final rule into a personal, source-linked planning experience for F-1 students.

**Live demo:** [durationofstatuschanges.netlify.app](https://durationofstatuschanges.netlify.app)

Students can tell their story by voice or text, or answer a progressive interview. The app shows what it understands, updates a personal impact map as facts arrive, draws controlling dates such as OPT filing windows and extension deadlines on visual timelines, and produces a complete advisor-style report.

## Safety Architecture

The legal/date engine is deterministic. The same confirmed facts always produce the same dates, warnings, follow-up questions, and source links without asking a model to calculate a legal result.

- GPT-5.6 Luna extracts candidate facts and separate case events at low reasoning effort.
- The student can review and change those facts through the same guided flow.
- One temporal case record keeps completed study, current training, travel, and later programs distinct instead of forcing them into one scalar scenario.
- The deterministic TypeScript engine calculates the result and cites the rule.
- The server recalculates the result before GPT-5.6 Sol turns the verified map into a complete advisor-style overview at medium reasoning effort.
- The report model may explain verified output; it may not alter a date, classification, or legal consequence.
- Rule-scoped follow-ups use GPT-5.6 Sol at medium reasoning effort. A completed advisement is a locked snapshot; exploration cannot silently change it, and recalculation requires the student to explicitly create a revised advisement.

The app gives every supported partial result it can, identifies contradictions before continuing, and asks for the exact missing fact that would change the answer. It never invents an exact day or converts ambiguous numeric dates such as `6/2/2029`; clear relative phrases such as “next spring” become visible estimates that the student must confirm.

## Advising Flow

The student experience is deliberately one question at a time:

1. Ask what brought the student here, in the student's own words. Voice and text intake use the same fact-and-concern extraction; students who choose the full interview begin with the September 15 question instead.
2. Let the student confirm or correct what the app understood, then confirm whether the student will be in the United States in valid F-1 status on September 15, 2026.
3. Confirm only the controlling dates or facts that remain unknown.
4. Address the student's concern first, while the deterministic impact map shows every other rule change that applies to the student's categories.
5. Create a complete advisor overview from the verified map and lock it to the answers used for that report.
6. Let the student open a separate rule explorer containing every additional issue that could apply to their categories, exact rule citations, and an open-ended follow-up. New facts never rewrite the finished report without an explicit revision.

Every explorer topic opens to student-specific guidance when the case supports it and concise, source-linked baseline guidance when another fact is still needed.

## Stack

- React, TypeScript, and Vite for the student experience.
- A deterministic TypeScript rule matrix for classifications, contradictions, dates, and timelines.
- Netlify Functions for the OpenAI-backed intake, advisor report, and rule-scoped follow-up endpoints.
- GPT-5.6 Luna for bounded temporal fact extraction and GPT-5.6 Sol for grounded explanation.

## Collaboration with Codex and GPT-5.6

The domain model came from fifteen years of international-student advising and current graduate study in immigration law. Codex served as the engineering collaborator that turned that expertise into a working product:

- Codex translated the final rule into a deterministic, source-indexed rule matrix and generated a regression suite for current students, incoming students, travel, OPT, CPT, extensions, school changes, dependents, and unusual endings.
- A real student case exposed a flat-data flaw: a completed program, approved OPT, planned travel, and a later program were being treated as one situation. Codex traced that failure across intake, routing, cards, and timelines, then refactored the app around connected temporal events without replacing the tested legal engine.
- Browser replays caught failures that unit tests alone would miss, including a program date being confused with an EAD date, a past return date entering a post-rule branch, a timeline that updated one answer late, and mobile controls that visually competed with the result.
- David made the substantive and product calls: which rules belong in scope, what language an international student can understand, when a question is unnecessary, which uncertainty requires a DSO, and how the six-step advising experience should feel.

GPT-5.6 has two deliberately bounded jobs. Luna converts a student's story into candidate facts and separate events that the student can verify. Sol receives a server-recalculated impact map and turns those verified facts, consequences, dates, and citations into a coherent advisor-style report. Neither model is allowed to invent a controlling date or legal outcome.

## Verification

The current suite contains 124 passing tests across nine files. It includes real-shaped multi-event cases, impossible-date contradictions, OPT transition deadlines, travel-triggered fixed admissions, academic-mobility limits, and timeline merging. TypeScript checking and the production Vite build run with `npm run build`.

## Local Setup

```bash
npm install
npm run dev:netlify
```

Netlify Dev serves the Vite app and `/api/intake`, `/api/explain`, and `/api/follow-up` at `http://localhost:8888`.

Create an ignored `.env.local` from `.env.example`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-sol
OPENAI_INTAKE_MODEL=gpt-5.6-luna
OPENAI_ADVISOR_MODEL=gpt-5.6-sol
OPENAI_INTAKE_REASONING_EFFORT=low
OPENAI_FOLLOW_UP_REASONING_EFFORT=medium
OPENAI_REPORT_REASONING_EFFORT=medium
```

Run the verification suite with:

```bash
npm test
npm run build
```

## Scope

- Current D/S F-1 students who are in the United States in valid F-1 status on September 15, 2026.
- Incoming F-1 students and people changing to F-1 status after the effective date.
- Travel and reentry comparisons, OPT and STEM OPT transition treatment, CPT timing, extensions of stay, school transfers, program changes, same/lower-level study, F-2 dependents, and unusual early-end cases.
- J-1 and M-1 are outside this app's first module.

Henry/Chatbase is a private research cross-check only. The submitted runtime is OpenAI plus the deterministic local engine and public-source rule registry.

## Sources

The primary authority is the [Federal Register final rule](https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant), published July 17, 2026 and effective September 15, 2026. The app also links to the public [NAFSA overview](https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status) and relevant USCIS material. Each rule citation opens a pronounced locator and the closest verified Federal Register paragraph anchor.

This is a planning and issue-spotting tool, not legal advice. Because implementation guidance, fees, and agency practice can change, public release still requires a final source and advisor review.

## License

Released under the [MIT License](LICENSE). The regulatory source material remains subject to its original terms.

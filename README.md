# F-1 Stay Map

F-1 Stay Map is an OpenAI Build Week app that turns DHS's July 17, 2026 duration-of-status final rule into a personal, source-linked planning experience for F-1 students.

Students can tell their story by voice or text, or answer a progressive interview. The app shows what it understands, updates a personal impact map as facts arrive, draws controlling dates such as OPT filing windows and extension deadlines on visual timelines, and produces a complete advisor-style report.

## Safety Architecture

The legal/date engine is deterministic. The same confirmed facts always produce the same dates, warnings, follow-up questions, and source links without asking a model to calculate a legal result.

- GPT-5.6 Luna extracts candidate facts and separate case events at low reasoning effort.
- The student can review and change those facts through the same guided flow.
- One temporal case record keeps completed study, current training, travel, and later programs distinct instead of forcing them into one scalar scenario.
- The deterministic TypeScript engine calculates the result and cites the rule.
- The server recalculates the result before GPT-5.6 Sol turns the verified map into a complete advisor-style overview at medium reasoning effort.
- The report model may explain verified output; it may not alter a date, classification, or legal consequence.
- Rule-scoped follow-ups use GPT-5.6 Sol at medium reasoning effort and can add confirmed facts back to the deterministic impact map.

The app gives every supported partial result it can, identifies contradictions before continuing, and asks for the exact missing fact that would change the answer. It does not invent dates or convert ambiguous numeric dates such as `6/2/2029`.

## Advising Flow

The student experience is deliberately one question at a time:

1. Confirm whether the student will be in the United States in valid F-1 status on September 15, 2026.
2. Ask what brought the student here, in the student's own words. Voice and text intake use the same fact-and-concern extraction.
3. Address the student's concern first, while the deterministic impact map shows every other rule change that applies to the student's categories.
4. Offer one additional area at a time for deeper exploration. The app leads with a concrete consequence; it never asks the student to choose from a wall of legal topics.
5. Ask only the controlling questions for an accepted area, one at a time, and preserve still-compatible answers when an earlier answer changes.
6. Create a complete AI advisor overview from the verified map, then accept open-ended follow-up questions that can add facts and refresh the map.

Every explored area ends with substantive guidance. A topic with no missing field cannot silently skip the student to the report.

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

The primary authority is the [Federal Register final rule](https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant), published July 17, 2026 and effective September 15, 2026. The app also links to the public [NAFSA overview](https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status) and relevant USCIS material. Each result card links to the closest available page in the official rule PDF.

This is a planning and issue-spotting tool, not legal advice. Because implementation guidance, fees, and agency practice can change, public release still requires a final source and advisor review.

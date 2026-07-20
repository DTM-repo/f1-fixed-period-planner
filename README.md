# F-1 Stay Map

F-1 Stay Map is an OpenAI Build Week app that turns DHS's July 17, 2026 duration-of-status final rule into a personal, source-linked planning experience for F-1 students.

Students can tell their story by voice or text, or answer a progressive interview. The app shows what it understands, updates a personal impact map as facts arrive, draws the relevant dates on visual timelines, and produces a complete advisor-style report.

## Safety Architecture

The legal/date engine is deterministic. The same confirmed facts always produce the same dates, warnings, follow-up questions, and source links without asking a model to calculate a legal result.

- GPT-5.6 Sol extracts candidate facts from a student's narrative at medium reasoning effort.
- The student can review and change those facts through the same guided flow.
- The deterministic TypeScript engine calculates the result and cites the rule.
- The server recalculates the result before GPT-5.6 Sol writes the final advisor report at max reasoning effort.
- The report model may explain verified output; it may not alter a date, classification, or legal consequence.
- Rule-scoped follow-ups use GPT-5.6 Sol at medium reasoning effort and can add confirmed facts back to the deterministic impact map.

The app gives every supported partial result it can, identifies contradictions before continuing, and asks for the exact missing fact that would change the answer. It does not invent dates or convert ambiguous numeric dates such as `6/2/2029`.

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
OPENAI_INTAKE_MODEL=gpt-5.6-sol
OPENAI_ADVISOR_MODEL=gpt-5.6-sol
OPENAI_INTAKE_REASONING_EFFORT=medium
OPENAI_FOLLOW_UP_REASONING_EFFORT=medium
OPENAI_REPORT_REASONING_EFFORT=max
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

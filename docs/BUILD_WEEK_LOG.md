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

### Intake Interaction Fixes

**Research**

- Rechecked date-entry handling against the earlier internationalization decision: the narrative parser should accept explicit month-name dates and ISO dates, but should not guess compact slash dates like `6/2/2029`.

**Decisions**

- Voice/story intake must show visible status at every step. A silent "Draft facts" button feels broken and is unsafe because the student cannot tell whether the app understood them.
- The local preview should not depend on a model-backed endpoint for basic usefulness. If the AI explanation call is unavailable, the app should fall back to a deterministic plain-language explanation built from the calculator result.
- Narrative drafting should update obvious facts from the student's story even when defaults already exist, while still refusing ambiguous numeric dates.

**Codex Assistance**

- Fixed the narrative draft flow so speaking or typing a story can change calculator facts and produce visible "Drafted facts" feedback.
- Added local voice-status messages for listening, unsupported speech recognition, microphone errors, and completed transcript capture.
- Added deterministic explanation fallback copy when `/api/explain` is not available in the local Vite preview.
- Added narrative parser tests for month-name dates, incoming/outside-U.S. stories, OPT filing dates, and ambiguous slash-date refusal.
- Verified with `npm run test` and `npm run build` in the local clone.

### Live OpenAI and Netlify Function Wiring

**Research**

- Confirmed the local Vite preview alone cannot serve the Netlify Function route at `/api/explain`; testing the real model-backed explanation requires Netlify Dev or a deployed Netlify site.
- Found that two existing local project env files contained OpenAI key entries, but one key was quota-blocked and the other was a placeholder/invalid value.
- Created a fresh OpenAI project key through the secure Codex/OpenAI Platform flow and wrote it to this repo's ignored `.env.local`.

**Decisions**

- Keep the deterministic fallback as resilience, but do not treat it as sufficient for end-to-end testing.
- Use Netlify Dev at `http://localhost:8888/` for local testing whenever the OpenAI-backed function needs to run.
- The narrative intake needs an AI extraction/chat layer. The regex parser is only a temporary helper and cannot safely infer meaning in sentences like "I want to do OPT because in December 2026 I graduate."
- Add a student-facing "what I understood" confirmation step so students can immediately correct extracted facts before the deterministic calculator treats them as confirmed.
- Keep the legal/date result engine deterministic: AI can extract candidate facts, ask follow-up questions, and explain results, but deterministic code must still calculate deadlines and cite sources.
- Netlify/GitHub sync is the right deployment path once the local function works with a quota-enabled key.

**Codex Assistance**

- Ran Netlify Dev with a fixed Vite target port so `/api/explain` routes through the local Netlify Function runtime.
- Verified that the function reaches OpenAI by observing real API errors through the local endpoint.
- Fixed the OpenAI Responses request by removing `temperature`, which the selected GPT-5.6 model rejects.
- Added a reusable `npm run dev:netlify` script for local function testing.
- Moved the Netlify env type declaration under `_shared` so Netlify Dev does not try to load it as a function.

**Open Questions**

- Resolved later on July 18, 2026: the OpenAI project key now has usable quota, and `/api/explain` returned a live `200 OK` response from `gpt-5.6-terra`.
- Link the GitHub repo to the intended Netlify site and set `OPENAI_API_KEY` as a secret Netlify environment variable before deployed testing.

### Henry/Chatbase Corpus Strategy

**Research**

- Reviewed the existing HenryKnows local repo at `/Users/davidmaxon/Projects/henryknows`.
- Confirmed Henry already has a server-side Netlify proxy that calls Chatbase at `https://www.chatbase.co/api/v1/chat` with `CHATBASE_API_KEY` and `CHATBASE_BOT_ID`.
- Confirmed the Chatbase API supports sending messages to a trained chatbot by `chatbotId`, with optional conversation IDs and model/temperature settings.

**Decisions**

- Use Henry/Chatbase as the domain-corpus layer where it helps: F-1 background, DSO best-practices context, and short knowledge-base answers.
- Do not treat Chatbase as the calculator or the fact extractor of record. It is knowledgeable but still an LLM-backed chatbot and may not provide machine-checkable structured facts.
- Update Henry's knowledge base with the July 17, 2026 final rule before relying on it for new duration-of-status explanations.
- Use OpenAI for structured narrative extraction into candidate facts and confidence/ambiguity flags, then show students "what I understood" before those facts reach the deterministic engine.
- Keep the deterministic F-1 planner engine as the source of date/deadline/status calculations and citations.

**Codex Assistance**

- Identified the existing Henry proxy implementation so this app can reuse a known secure server-side Chatbase pattern.
- Separated the app architecture into three layers: AI extraction, deterministic calculation, and Henry/Chatbase domain grounding.

**Open Questions**

- Decide whether to copy the Henry proxy pattern into this app or call Henry's deployed API through a narrowly scoped internal endpoint.
- Check Henry/Chatbase plan limits before relying on it for public hackathon traffic.

### NAFSA/AM360 Corpus Boundary

**Research**

- Reviewed NAFSA public terms, copyright language, AM360 licensing information, and Build Week submission requirements.
- Build Week requires a repository for judging/testing and requires entrants to be authorized to use third-party APIs/data included in the project.

**Decisions**

- Do not submit or connect the hackathon app to a Henry bot trained on NAFSA Adviser's Manual 360 text unless NAFSA grants permission.
- Use public legal/regulatory sources plus David's independent professional interpretation in his own words.
- Do not build a close paraphrase, substitute guide, or AM360-shaped corpus. Distill only what this app needs, grounded in public sources and David-reviewed judgment.
- The app README should eventually state that the submitted knowledge/corpus materials are public-source or author-created and that NAFSA does not sponsor or endorse the project.

**Codex Assistance**

- Helped separate copyright/licensing risk from product architecture: Henry/Chatbase can still be used, but the hackathon corpus should be clean, public, and author-created.

### Chatbase API Endpoint

**Research**

- Reviewed the existing Henry Netlify proxy and Chatbase API documentation for `POST https://www.chatbase.co/api/v1/chat`.
- Used the Chatbase `get-chatbots` endpoint with the existing API key to identify the trained clean bot candidate, without exposing the API key.

**Decisions**

- Superseded later the same day by the OpenAI-only runtime pivot below.
- Add `/api/henry` as a narrow domain-context endpoint, not a student-status calculator.
- Keep Chatbase credentials in `.env.local`/Netlify environment variables only.
- Do not persist conversations through this endpoint for the first hackathon build; send bounded, stateless questions to reduce student-data retention.
- Reject obvious direct identifiers such as SEVIS IDs, SSNs, and email addresses before calling Chatbase.

**Codex Assistance**

- Added a modern Netlify Function proxy for the clean Henry/Chatbase bot.
- Wrapped calls with app-specific guardrails: public-source framing, no proprietary subscription manuals, plain-English student language, and no individual deadline/status calculations.

### Hackathon Runtime Pivot: OpenAI Only

**Research**

- Rechecked Build Week judging criteria: projects are judged on technical implementation, design, potential impact, and quality of idea, and strong submissions should clearly demonstrate thoughtful use of GPT-5.6 and Codex.
- Confirmed third-party APIs are allowed only when authorized, but also add explanation and review surface.

**Decisions**

- Remove Chatbase/Henry from the submitted runtime path. Henry can remain a private research/support tool, but not a dependency for judging.
- Center the submission architecture on OpenAI API plus the deterministic F-1 rule engine.
- Replace the regex narrative parser with an OpenAI structured extraction endpoint so the app does not depend on brittle keyword/date proximity rules.
- Keep the student confirmation step: extracted facts are candidate facts until the student applies them.

**Codex Assistance**

- Removed `/api/henry` from runtime config.
- Added `/api/intake` for GPT-5.6 structured narrative extraction with a JSON schema and conservative ambiguity rules.
- Removed the temporary regex narrative parser and its tests from the active app path.
- Changed narrative-apply behavior to start from an unknown intake baseline, so old demo/default dates do not remain in the calculator as if the student confirmed them.
- Verified `/api/intake` live through Netlify Dev with a narrative where graduation, OPT intent, I-20 end date, and travel appeared together. The model treated the full I-20 date as the program end date, refused to convert "August 2027" into a reentry date, and did not treat graduation as an OPT filing/start/EAD date.
- Verified `/api/explain` live through Netlify Dev with `gpt-5.6-terra`.

### Intake Merge Behavior

**Decision**

- Reversed the blunt unknown-baseline apply behavior after David tested the app and found it erased fields he had already entered manually.
- Applying OpenAI-understood facts now merges only the supported extracted fields into the current scenario, preserving unrelated manually entered facts.
- The remaining product problem is funnel clarity: the app needs a single clear source-of-truth path and should distinguish confirmed manual facts, AI-understood candidate facts, and demo/sample facts.

**Codex Assistance**

- Updated the apply step so narrative intake does not undo prior student input.

### Blooming Flow Prototype

**Research**

- Reviewed David's attached single-file prototype for useful visual patterns, especially the side-by-side stay-put transition branch and travel/reentry branch timeline.
- Rechecked the local deterministic engine field meanings before relabeling: `programEndOnEffectiveDate` is the active I-20 end date on September 15, 2026; `currentProgramEndDate` is the I-20/program end being tested for fixed-period or later-plan branches.

**Decisions**

- Replace the expert worksheet UI with a staged, typed interview flow. The first split asks whether the student is already/will be F-1 before September 15, 2026 or will enter after that date.
- Treat current F-1 students as D/S by default, because that is the normal current-student I-94 posture, but make it easy to correct in a “what else could affect this?” card.
- Move unusual or less common facts out of the main funnel: non-D/S I-94 dates, pending extension travel, EAD active on the rule date, passport/unusual travel facts.
- Show impact cards as soon as the first answer is given, then update those cards as the student adds I-20, travel, OPT/STEM, transfer/change, and CPT facts.
- Show travel visually as a branch comparison: stay in the U.S. under the transition path versus leave and return under a fixed-period comparison.
- Add an explicit `i94AdmitUntilDate` fact so an unusual I-94 end date is not forced into an unrelated I-20/program field.

**Codex Assistance**

- Rebuilt the main scenario panel into a progressive “Build your scenario” flow while keeping the deterministic engine as the calculation source.
- Added live impact cards and a visual branch timeline surface above the detailed findings.
- Added `i94AdmitUntilDate` to the scenario model, date normalization, OpenAI intake schema, deterministic fixed-period branch, and tests.
- Hid demo scenarios in a testing drawer and renamed them with student-readable labels.

### Student-Language Flow Correction

**Research**

- Rechecked the current-student flow against David's live testing notes: date entry, D/S wording, early I-20 end dates, travel order, OPT/STEM question shape, transfer/program-change separation, and timeline readability.

**Decisions**

- Fix date controls so partial four-digit year entry does not rewrite or clear the field.
- Remove visible student-facing phrases like "grandfathered," "stay-put," "calculator treats," and markdown-style explanation output.
- Ask only "Will you be inside the United States on September 15, 2026?" instead of asking students whether they expect to follow F-1 rules.
- Split travel into two questions: leaving the U.S., then returning after September 15.
- Replace the OPT dropdown with plain questions: post-completion OPT/STEM intent, regular vs STEM, and filing/approval status. Pre-completion OPT stays out of the main path unless a specific rule impact is identified.
- Split transfer and academic program change into separate questions.
- Hide internal findings/timeline/source output in a closed calculation-details drawer. The main surface should be plain-language result and clearly labeled date events.

**Codex Assistance**

- Fixed the Month/Day/Year DateField bug by waiting for a complete valid four-digit year before committing the date.
- Added a deterministic guard for I-20/EAD dates ending before September 15, 2026, so the engine asks what F-1 basis exists on the rule date instead of showing a misleading old-rule result.
- Rebuilt progressive reveal logic so travel, OPT/STEM, and school/CPT questions appear only after earlier answers make them relevant.
- Replaced the branch-bar timeline with labeled event timelines showing dates and meanings directly.

### Current-Student Impact Language

**Research**

- Rechecked the Federal Register transition section against David's question about whether old-rule protection turns on F-1 status generally or physical presence in the United States on September 15, 2026.
- Confirmed the text says the F/J transition treatment generally applies to people present in the United States on the final rule's effective date, validly maintaining status, and admitted for D/S; it separately excludes people outside the United States when the rule takes effect.

**Decisions**

- Show a meaningful provisional result as soon as the student says they are a current F-1 student: they may be partly exempt from the fixed-date system if the September 15/D/S conditions are met.
- Treat D/S as the default current-student I-94 posture and move unusual fixed-date I-94 cases into a small correction path, not a main funnel gate.
- When the I-20/program/training date runs past September 15, 2030, say plainly that old-rule protection stops there and staying later likely needs an extension of stay.
- Highlight travel as a possible strategic branch when a later fixed-period return produces a longer timeline than staying in the United States, while warning that travel also creates visa/admission risk.
- Make source IDs clickable in the calculation drawer so legal support is accessible without forcing citations into the main student flow.

**Codex Assistance**

- Rewrote the deterministic engine's result copy from third-person expert language into second-person student language.
- Added linked citation chips for finding-level source IDs.
- Adjusted the OpenAI intake function so summaries, follow-ups, cautions, and fact notes address the student as "you" and do not strand broad follow-up questions with no way to answer them.

### Narrative Apply Fix

**Research**

- Live-tested narrative intake with a current F-1 student story. GPT extracted useful dates and travel facts, but the scenario could remain visually stuck at the first question if the starting-position/default-D/S facts were too conservative or if derived fields were hidden.

**Decisions**

- Treat current-in-the-U.S. F-1 narratives as the current-student path and default I-94 to D/S unless the narrative gives a fixed I-94 end date.
- Applying facts should update the same visible scenario fields the interview flow uses, including the current I-20 date and return-after-September-15 branch.
- Do not apply `unknown` facts. Leave them as follow-up questions instead of letting them overwrite useful scenario state.

**Codex Assistance**

- Rebuilt the apply step from raw field spreading into scenario-aware fact application.
- Verified in the live app that clicking Apply moves the scenario into the current-F-1 flow, populates the I-20 date, and surfaces the travel branch.

### Travel, Extension, and Program-Level Pass

**Research**

- Rechecked the final rule overview against David's travel question: travel does not extend D/S transition protection itself, but a post-effective-date F-1 return can create a separate fixed-period admission branch that may reach farther than the transition cap in some scenarios.
- Verified the official USCIS G-1055 fee schedule for Form I-539. As of the page last reviewed August 29, 2025, USCIS lists the general Form I-539 filing fee as $420 online or $470 by paper; it does not support hard-coding a separate $85 biometrics fee for this category.
- Verified premium-processing language against USCIS and the Federal Register: DHS says USCIS will announce any expansion for affected EOS populations through USCIS premium-processing guidance; the existing USCIS bulletin covers certain F/M/J change-of-status I-539 premium-processing requests and notes biometrics must be submitted before the premium clock starts.
- Rechecked final-rule program-level restrictions: undergraduate transfer/program changes depend on the one-academic-year rule; graduate transfers/program changes are much more restricted; same-level or lower-level next programs after completion are generally blocked for programs completed after September 15, 2026.

**Decisions**

- Phrase travel as a comparison branch, not as "travel extends exemption." The app should say that travel can create a new fixed-period admission that may avoid or delay an I-539 in the right fact pattern.
- Add a top "What happened" overview link and keep "Official rule" visible as the primary legal source.
- Add an advisement-style result layer above the technical findings so the post-calculation response gives scenario-specific interpretation instead of merely repeating cards.
- Include the 60-day to 30-day change as a core visible impact: D/S transition path can still have 60 days; new fixed-period admission has 30 days.
- Keep fee language current-source-based: list $420 online / $470 paper for I-539 and say biometrics may be required if USCIS notices the student for biometrics.
- Do not let uncertain travel dates stop the intake. OPT/STEM and school-change questions should continue even when the student does not know return timing yet.
- Ask education level and same/lower-level next-program questions in the structured flow because those facts materially change the advice.

**Codex Assistance**

- Added source-index entries for the USCIS I-539 fee schedule, USCIS premium-processing bulletin, and final-rule school/program-level limits.
- Added `educationLevel` and `nextProgramLevelPlan` to the deterministic scenario model, demo scenarios, OpenAI intake schema, and student-facing fact labels.
- Added deterministic findings for graduate program/transfer limits, undergraduate one-academic-year checks, and same/lower-level next-program risk.
- Added a source-linked "What happened" overview and a source-linked advisement panel that explains travel, extension, OPT/STEM, grace-period, and school-change consequences in direct student language.
- Changed progressive reveal logic so uncertain travel answers no longer block OPT/STEM and school-change questions.

### NAFSA Reference Hub Added

**Research**

- Reviewed NAFSA's public "DHS Final Rule Ending Duration of Status" page dated July 18, 2026. The page is useful both as an expert overview and as a link hub to the Federal Register final rule, SEVP quick facts, SEVP FAQ, SEVP webinar information, and the regulatory impact analysis.
- Noted that NAFSA's synopsis tracks several app-critical issues: fixed-date I-94s, 30-day grace period for fixed-period entries/reentries, transition provisions for D/S students in the United States on September 15, 2026, travel/reentry producing a date-specific I-94, I-539 extension requirements, program-level restrictions, and lateral/reverse matriculation limits.

**Decisions**

- Keep NAFSA as a reference and link hub rather than as the deterministic legal authority. Federal Register, USCIS, SEVP, and other government sources remain the primary sources for calculations.
- Add a visible "NAFSA overview" header link for demo/testing convenience because the page helps explain the overall rule and points to useful primary-source links.

**Codex Assistance**

- Added `NAFSA-DS-FINAL-RULE-HUB` to the source index.
- Added a top-level "NAFSA overview" link beside "What happened" and "Official rule."

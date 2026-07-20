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

### Effective-Date Question and Advisement Flow Pass

**Research**

- Rechecked final-rule and NAFSA language for graduate restrictions. The final rule prohibits graduate-level F-1 students from changing educational objectives during a program, and prohibits graduate transfers unless SEVP authorizes an exception for extenuating circumstances.
- Rechecked fixed-period admission language. For F-1 entries/reentries after September 15, 2026, the I-94/admission period is date-specific; this should not be hedged as merely "likely" when the rule branch is clear.
- Smoke-tested the local `/api/explain` endpoint through Netlify dev. It successfully called OpenAI and returned an advisement-style response. A prompt correction was added after the model mentioned the D/S transition cap in an incoming fixed-period scenario where that date was not relevant.

**Decisions**

- Replace the first structured question with: "Will you be a valid F-1 student in the United States on September 15, 2026?" That one fact decides whether the app starts with D/S transition treatment or the new fixed-period admission branch.
- Move the general "What happened" explanation off the planner screen into a separate article-style page with links to the DHS final rule and NAFSA overview.
- Collapse the overlapping live result sections into one "What this means for you" surface. The live cards should be student-specific, not generalized rule overview cards.
- Make future-student follow-up questions unfold one at a time after entry date and I-20 end date: program level, transfer, program change, same/lower next program, OPT/STEM, then CPT.
- Make "Calculate results" an explicit OpenAI advisement action, with loading state and a plain-prose deterministic fallback if OpenAI is unavailable.
- Add source chips to the student-specific live cards so source links are available without opening the technical details drawer.

**Codex Assistance**

- Reframed the scenario selection logic around valid F-1 presence in the United States on September 15, 2026 and removed the redundant September 15 question from the current-student flow.
- Added hash-addressable `#what-happened` overview page and simplified the header to a single What Happened/Back control.
- Reworked the future-student branch so it no longer dumps six questions at once.
- Rewired Calculate Results to call `/api/explain` with the base result and optional travel comparison result, and tightened the OpenAI prompt to produce direct, non-markdown advisement copy.
- Added deterministic source-backed graduate/undergraduate program-level findings so generated advisement has relevant rule support.
- Reworked the timeline cards into a more horizontal, visual layout on desktop while keeping mobile responsive.

### Contradiction Guardrails, CPT, and Advisor Voice Pass

**Research**

- Rechecked the Federal Register regulatory text for school/program changes. The final rule text says graduate-level F-1 students may not change educational objectives during the program and may not transfer unless SEVP authorizes an extenuating-circumstances exception.
- Rechecked Federal Register CPT discussion. DHS declined to eliminate Day One CPT or otherwise change substantive CPT eligibility in this rule. The important new app-facing issue is extension timing: a timely extension filed before the F-1 period ends can allow already-authorized CPT/employment to continue while the extension is pending for up to 240 days, while filing only during the departure period does not allow CPT/employment to continue or begin until approval.
- Rechecked source-link behavior. Federal Register does not expose clean subsection URLs for every CFR paragraph, so source chips now use browser text-fragment links that point as close as possible to the relevant public text.

**Decisions**

- Contradictory answers must stop calculation before the AI advisement layer. Example: answering that you will not be an F-1 student in the United States on September 15, 2026 but entering on August 20, 2026 cannot produce an incoming fixed-period report.
- No segmented question should look pre-selected. Default `unknown` values are internal only; the UI should show a pulsing prompt until the student or an applied AI fact actually answers the question.
- The future voice-first UI should eventually update the “How this affects you” cards live as the student speaks, then offer a “Make changes” path that opens the same structured controls. This session added underlying safety logic, not the final sparse voice interface.
- CPT should not be a dead switch. If the student is thinking about CPT, the app should surface the Day One CPT/non-elimination point and the pending extension timing issue.
- Use `gpt-5.6-sol` as the default model for the final narrative advisement report unless an environment variable explicitly overrides it. The report should read like a careful international student advisor, not like a rules-engine trace.

**Codex Assistance**

- Added a deterministic contradiction result for future-student answers that conflict with an entry date on or before September 15, 2026.
- Disabled “Calculate results” when the deterministic engine finds a contradiction, preventing OpenAI from writing a confident report on impossible facts.
- Added source-backed CPT findings and live impact cards, including the 240-day pending-extension point and the departure-period limitation.
- Added `answeredFields` handling to segmented/select controls so `unknown` is not visually selected unless the student actually chose it.
- Hid contradiction timelines and early unknown-date future timelines so visual results only appear when the facts support them.
- Tightened `/api/explain` instructions to require direct `you/your` advisor language, ban internal phrases like “tested entry,” and treat the internal `reentryDate` as an expected first entry date for incoming students.
- Added direct source-chip links for fixed admissions, D/S transition presence, 30-day F-1 period, graduate restrictions, and CPT using Federal Register text fragments.
- Verified with 23 Vitest engine tests, production build, browser interaction against the contradiction path, and a live Netlify Dev `/api/explain` smoke test returning `gpt-5.6-sol`.

**Open Questions**

- Decide how much source-chip linking belongs on the live cards versus the details drawer once the final UI package lands.
- Add a richer voice-first architecture where interim speech extraction updates understood facts/cards in real time without requiring a separate “Draft facts” button.
- Add a better CPT sub-flow if the user needs actual CPT start/end timing, employer authorization, or pending-extension status checked.

## 2026-07-19

### GPT-5.6 End-to-End Audit and Rebuild

**Research**

- Audited every modeled branch against the July 17, 2026 Federal Register rule, using exact Federal Register paragraph anchors wherever available.
- Cross-checked difficult questions with David's clean Henry F-1 corpus as a private research aid, while keeping the final rule and public agency sources authoritative.
- Identified a material timing issue in the earlier engine: the ordinary four-year maximum is calculated from the Form I-20 program start date, not the date of physical admission or return.
- Confirmed that a fixed-period I-94 admit-until date already includes the final 30 days; a calculator must not add another 30 days to an actual I-94 date.
- Rechecked extension timing, OPT/STEM transition deadlines, CPT work continuation, academic-mobility restrictions and possible delay authority, shorter program limits, F-2 treatment, and early-end periods.
- Rechecked current USCIS Form I-539 fees and premium-processing language. The supported current general fee is $420 online or $470 on paper; biometrics may be required, but a separate universal $85 fee is not supported.

**Decisions**

- Make the rule engine, not the language model, the sole calculator of dates and legal classifications.
- Recalculate the scenario inside `/api/explain` so browser-supplied result text cannot become the model's authority.
- Use GPT-5.6 Luna for conservative structured story extraction and GPT-5.6 Sol for the final advisor narrative.
- Remove the Draft Facts and Apply Understood Facts interaction. Story extraction now runs automatically, updates the personal impact cards, and leads into the same editable interview.
- Use deterministic labels in the visible "What I understand" stream so internal model phrasing cannot leak into the student experience.
- Keep one active guided question at a time, with no visible preselection and an explicit prompt that answering reveals the next question.
- Treat contradictions as requests for clarification. Preserve supported partial information but do not allow a final advisor report until the conflict is resolved.
- Restore timelines as a primary result surface: horizontal on desktop, vertical on mobile, and side-by-side alternatives for stay-versus-return comparisons.
- Keep each live impact card specific to the student's facts and link its source chip to the closest rule paragraph.
- Keep Henry/Chatbase out of the submitted runtime and use only public or David-authored material in the project.

**Codex Assistance**

- Performed the full source, code, test, copy, accessibility, API, and browser audit.
- Rewrote the deterministic engine around separate activity-end, I-94, extension-planning, and filing-deadline concepts.
- Expanded the regression matrix from 23 to 39 source-linked cases and corrected the travel, OPT/STEM, CPT, academic, fixed-period, and early-end branches.
- Rebuilt the React experience around the sparse welcome, story-first intake, progressive interview, live impact cards, overview article, uncommon-facts drawer, visual timelines, and complete advisor report.
- Hardened both Netlify functions with strict structured outputs, input limits, prompt-injection boundaries, server-side result recomputation, `store: false`, and direct student-language requirements.
- Verified the real APIs with GPT-5.6 Luna and GPT-5.6 Sol, including a long incoming graduate case.
- Tested the primary experience in the in-app browser on desktop and at 390 x 844 mobile dimensions, including the date-entry bug, contradiction path, visual timeline transformation, and no-horizontal-overflow check.
- Created `docs/AUDIT_2026-07-19.md` so the legal corrections, product decisions, Codex contribution, verification evidence, and release safeguards are preserved for Build Week judging.

**Verification**

- `tsc --noEmit`: passed.
- Vitest: 39/39 passed.
- Production Vite build: passed.
- `/api/intake`: live HTTP 200 from `gpt-5.6-luna`.
- `/api/explain`: live HTTP 200 from `gpt-5.6-sol`.
- Desktop and mobile browser checks: passed for the audited flows.

**Open Questions**

- Monitor whether DHS or SEVP delays the academic-mobility restrictions before September 15, 2026.
- Add public-demo rate and spending controls before broad distribution.
- Decide on production transcription, multilingual review, and document-assisted intake after the core calculator is advisor-reviewed.

### Voice Intake Request-Starvation Fix

**Research**

- David's live voice test showed that speech recognition and transcription worked, but the interface stayed in its understanding state and never displayed extracted facts.
- Netlify Dev logs showed many `/api/intake` requests completing successfully with HTTP 200 in roughly 5 to 10 seconds. The failure was therefore in client coordination, not speech capture, the OpenAI key, or the intake model.
- Each finalized speech chunk changed the narrative and triggered React effect cleanup, which aborted the browser request already in progress. OpenAI still completed server-side, but the browser discarded the response. Continuous natural speech could starve the UI indefinitely.
- David's immediate retest after request serialization still felt like no transfer. The calls again returned HTTP 200; code review showed that the live understanding and impact cards were rendered below a speaking panel that occupied the entire viewport. The data could exist without being visible.
- The browser can also hold the last spoken phrase as an interim result until recording stops. Clearing that interim display on `onend` could discard visible words before the final intake pass.

**Decisions**

- Keep only one intake request active at a time and retain only the latest queued transcript. This controls cost and guarantees forward progress without losing the student's newest words.
- Allow an initial understanding to appear while the student continues speaking, then run one follow-up pass for words added during that request.
- Replace the misleading loading-state button label "Keep talking" with an explicit "I am done talking" action while recording. After the student stops, show "Finishing what I understood" until the current transcript is ready.
- Do not let a loading-state button move the student into the interview with an empty or stale extraction.
- Keep the understood facts and changed impacts in the same viewport as the voice experience. Show an explicit count of details currently shaping the result.
- Preserve any final interim phrase when recording ends and include it in the final queued extraction.

**Codex Assistance**

- Diagnosed the mismatch between successful server responses and the permanently loading browser state from live function logs and React lifecycle code.
- Replaced abort-on-every-chunk behavior with a serialized active-plus-latest queue.
- Added explicit stop-and-finish behavior, current-transcript checks before review, stale-request cleanup on restart, and clearer live status copy.
- Rebuilt the story screen into a side-by-side live workspace on desktop, with a compact stacked result flow and automatic result focus after stopping on smaller screens.
- Added a visible "details are shaping these results" acknowledgment and preserved the last interim speech phrase through the stop event.
- Re-ran TypeScript, all 39 deterministic tests, and the production build successfully.

### Voice Relevance, Memory, and Travel Hierarchy

**Research**

- A live advisor-style test used this story: a third-year international student graduating in December 2026 wants OPT and is unsure whether or when to travel.
- The extraction service heard the words, but its visible output repeated too much of the narrative, stopped at the September 15 presence question, and did not reliably carry the travel concern into the guided interview.
- The result hierarchy also favored the stay-in-the-United-States D/S path even after the student confirmed a return after September 15. That made a technically conditional old-rule result look like the student's main answer.
- Plain-language review found that “protected study period,” “temporary no-I-539 rule,” and “Will an I-539 be pending?” require students to understand the answer before they can understand the question.

**Decisions**

- Give structured intake two distinct outputs: compact rule-relevant highlights and persistent student-raised topics. A fact drives the calculator; a topic guarantees that a question such as travel or OPT remains visible until it is addressed.
- For a student who identifies themself as a current international student and clearly describes study continuing beyond September 15, use current F-1, D/S, and presence on that date as correctable working assumptions. Never make that assumption when the story says the student will be outside the United States or out of status.
- Adapt the funnel to a question raised in the story. When travel is raised, ask its controlling questions immediately after the core I-20 date and keep a visible concern tracker above the interview.
- Ask whether any trip will bring the student back after September 15, rather than asking whether the student will return after that date. This avoids treating an earlier return as proof that every later trip is harmless.
- Once a post-September 15 return is confirmed, make the fixed-period return result primary. Keep the D/S result only as the “if you stay in the United States” comparison.
- Ask about a filed extension of stay only when an extension is actually relevant or the student already supplied that fact. Do not present Form I-539 as though it were the OPT application.

**Codex Assistance**

- Added deterministic topic preservation for travel, OPT/STEM OPT, CPT, extensions, transfers, program changes, and change of status, so a model omission cannot erase a concern explicitly stated in the narrative.
- Removed unused AI-written summaries, follow-up prose, evidence text, and caution text from each live intake call. The model now returns only highlights, topics, and calculator facts, reducing response size and repeated narration.
- Added guarded current-student assumptions with explicit counterexample handling and an immediate correction path in answer history.
- Replaced the voice fact-card transcript with a short bullet list such as “Current F-1 student,” “Graduating December 2026,” and “Has a travel question.”
- Added the persistent “Your questions are saved” tracker, adaptive travel-first questioning, student-specific question explanations, and an emphasized travel difference-maker in the result column.
- Rewrote OPT and extension findings to explain the DSO recommendation, Form I-765, Form I-539, March 18, 2027 transition deadline, and travel interaction without internal rule-engine language.
- Updated the GPT-5.6 Sol report prompt so a confirmed return is the primary narrative path and the stay-in-the-United-States result is clearly presented as an alternative.

**Verification**

- Added four intake-semantics regression tests, including the exact third-year/December 2026/OPT/travel story and an explicit-outside-the-U.S. counterexample.
- Vitest: 43/43 passed.
- `tsc --noEmit`: passed.
- Production Vite build: passed.

### Presence Gate, Reentry Logic, and Test-Case Sharing

**Research**

- Rechecked the final rule's transition and readmission language after David asked whether a student could keep D/S for years, travel near the end, and receive four fresh years without Form I-539.
- Confirmed that transition D/S protection cannot run six years after the effective date: it ends at the I-20 or EAD date in place on September 15, 2026, capped at September 15, 2030, plus the legacy 60-day departure period.
- Confirmed that the four-year maximum is not an aggregate lifetime cap. A later eligible admission can create another fixed period, but that period is measured from the program start date on the controlling I-20, not from the day of return, and is limited by the I-20 program end date.
- Confirmed that departure and readmission with an updated I-20 can be an alternative to a Form I-539 for additional time. It is not an automatic extension: CBP decides admission and the issued I-94 controls.
- Reconfirmed that STEM OPT is a 24-month extension after regular post-completion OPT, not an alternative first OPT choice.

**Decisions**

- Ask every user one mandatory question before voice, typing, or interview intake: whether they will be physically in the United States in valid F-1 status on September 15, 2026.
- Lock that confirmed answer so narrative extraction cannot overwrite it. The no branch can still distinguish entry from an in-country change of status.
- Require a narrative topic to be supported by the student's own words. A model-only travel label can no longer create a travel card or travel questions.
- For travel, first ask whether the return uses the same I-20. Reuse the program end date already supplied for the same I-20; request separate start and end dates only for a new or updated I-20.
- Preserve still-compatible answers when one earlier response changes. New conditional questions appear when needed, but previously completed answers are not discarded.
- Treat future OPT interest as planning only. Do not ask incoming or far-from-filing students about a DSO recommendation, Form I-765, or application status.
- Reduce the current-student result to one direct statement: old-rule protection continues through the displayed date if the student does not travel. Hide the duplicate transition card.
- Add print/save-PDF, share, and a privacy-conscious "Copy test case" action that excludes the original voice or typed narrative and produces a structured package for review in Codex.

**Codex Assistance**

- Traced the false travel card to two independent code paths: an overly broad render condition and acceptance of an unsupported model topic. Corrected both and added the exact no-travel graduate narrative as a regression case.
- Added a tested reentry-scenario transformation shared by the browser and server-side advisor report so same-I-20 and updated-I-20 returns cannot silently use different dates.
- Added guardrails for impossible returns after the supporting I-20 period, explicit extension-versus-readmission guidance, future OPT sequencing, and undergraduate-scoped transfer language.
- Verified the progressive interview in the browser on current and incoming paths, confirmed internationalized date entry, confirmed later answers survive an earlier date edit, and confirmed the copied test package excludes the narrative.
- Checked the opening flow at 1280 by 720 and 390 by 844, corrected medium-width hero clipping, and verified no horizontal overflow.

**Verification**

- Vitest: 51/51 passed across the rule engine, intake semantics, and confirmed-presence lock.
- `tsc --noEmit`: passed.
- Production Vite build: passed.
- Browser checks passed for the initial gate, current-student path, incoming undergraduate OPT path, date editing, concise result, source anchors, timelines, and test-case export.

### CPT Relevance and Filing-Deadline Correction

**Research**

- David identified an impossible interview question: a student whose I-20 ends May 22, 2028 was asked whether CPT might continue after May 22, 2028.
- Rechecked the final regulatory text at 8 CFR 214.2(f)(5)(viii). The automatic continuation applies to current, already-authorized CPT while a timely extension is pending, for no more than 240 days and never beyond the CPT end date authorized by the DSO.
- The old flow incorrectly used the student's supposed CPT timing as a proxy for the date an extension would be filed. Those are separate facts and could produce a false warning.

**Decisions**

- Never ask whether CPT will continue past the I-20 program end date.
- Ask about CPT only when the student raises it or when a fixed/transition activity deadline arrives before the I-20 program end and could interrupt otherwise-valid work.
- Do not ask the student to predict a CPT-versus-admission timing category. Use the verified I-20 and admission dates to calculate whether an earlier filing deadline exists.
- When an earlier deadline exists, give a conditional instruction: if CPT is authorized beyond that date, USCIS must receive the complete Form I-539 before the date to preserve automatic continuation. Filing afterward does not automatically preserve CPT.

**Codex Assistance**

- Traced the issue through the interview, scenario type, AI extraction schema, and deterministic findings and found that the same overloaded enum was controlling both CPT intent and extension timing.
- Replaced it with a simple CPT plan, removed the impossible follow-up, and made the rule engine derive relevance from the verified dates.
- Added regression coverage for the exact May 22, 2028 case, the earlier-admission-deadline case, and student-raised CPT questions.

**Verification**

- Vitest: 55/55 passed.
- `tsc --noEmit` and the production Vite build passed.
- Browser walkthrough of a current graduate student with a May 22, 2028 I-20 confirmed that the interview ends without asking about CPT when CPT was not raised and no earlier admission deadline exists.

### Literal Result Copy for Covered Programs

**Research and Decision**

- David flagged “adding later training” as unclear in a result for a student who had already said no to OPT. The phrase was intended to cover later post-completion OPT or STEM OPT, but it introduced an unconfirmed hypothetical instead of answering the student's facts.
- Removed the umbrella phrase and the entire speculative sentence. The result now gives the actual I-20 end date and says directly that Form I-539 is not needed to finish that program.
- Added a regression assertion for the complete visible sentence so internal shorthand cannot quietly return to this card.

### Student Guidance Without Process Commentary

**Research**

- A future-OPT card correctly explained that regular post-completion OPT comes before a possible STEM OPT extension, then diluted that guidance by explaining why later filing questions were omitted.
- Similar phrases elsewhere narrated the questionnaire or calculation process instead of addressing the student's immigration situation directly.

**Decisions**

- Result cards and the final advisement may state only a legal consequence, controlling date, necessary condition, or practical action.
- Do not mention questions asked or skipped, answers or inputs, the app or calculator, the model, or how a result was generated.
- Keep short operational messages only where they are necessary to use the interface, such as recording status or the prompt to answer before the next question appears.
- Keep true contradiction and uncertainty notices, but describe the conflicting facts directly and give the student an immediate correction path.

**Codex Assistance**

- Audited deterministic findings, travel guidance, contradiction copy, timeline descriptions, the local report fallback, and the GPT-5.6 Sol advisement prompt.
- Removed process narration and rewrote remaining passages as direct, second-person advisement.
- Added a cross-scenario regression guard that rejects common questionnaire and calculation-process language in visible results.

**Verification**

- Vitest: 56/56 passed.
- TypeScript and the production Vite build passed.
- Browser verification of the incoming undergraduate OPT path showed only the substantive regular-OPT/STEM-OPT sequence, with no skipped-question commentary and no console errors.

### Concern-First Impact Map and Rule Advisor

**Research**

- Reframed the product from a long funnel into overlapping impact categories. The September 15 question still selects the legal starting point, but the student's own concern now controls order and emphasis.
- Rechecked the final rule's regulatory text for transition D/S, fixed admissions, OPT, CPT, school and program changes, departure periods, and extensions. Deep links now open the relevant PDF page instead of the top of the same rule every time.
- Confirmed that the final rule PDF has 156 pages. F-1 extension biometrics and interviews are discussed on PDF page 135; premium processing is discussed on PDF page 48. A prior `#page=165` link was invalid and was removed.
- A live browser scenario exposed a false OPT recommendation: a May 2028 graduate was told to file before an October 2026 return to preserve an exception that closes before the student's normal OPT window opens. The rule requires the normal filing window to open in time, and filing before departure controls the eligible travel case.
- Live report generation exposed two model-quality failures that a successful JSON response alone did not catch: internal composition debris and a paragraph ending mid-date. Both became deterministic rejection conditions.

**Decisions**

- Flow: September 15 gate; student's concern; concise concern-first effects; all other applicable effects; optional deeper areas; one controlling question at a time; AI advisor report; rule-scoped follow-up.
- Use one concise main conclusion and atomic impact claims. Never repeat the headline as a card. Keep card titles to 14 words and details to 48 words in regression tests.
- Show every applicable category, but place student-raised travel, OPT, extension, CPT, transfer, program, family, or early-ending concerns first.
- Keep the deterministic engine as the source of dates and classifications. GPT-5.6 Sol may synthesize priorities and interactions, but it cannot recalculate or contradict those facts.
- For current students with an eligible one-time OPT window and post-rule travel, ask the controlling question directly: whether USCIS will receive Form I-765 before departure.
- Split extension fee, biometrics/interview, and premium-processing facts into separate source-linked claims so each link supports exactly what the card says.
- Use OpenAI Responses background mode for the full report. Netlify can return a response ID quickly, and the browser polls until the report completes instead of losing a high-quality generation to a local function timeout.
- The open-ended rule advisor can extract newly stated facts, update the deterministic impact map, and refresh the full report. Its answer remains visible throughout the refresh.

**Codex Assistance**

- Built the typed impact-map layer and concern catalog, replaced the all-topics questionnaire, and preserved still-valid answers when an earlier answer changes.
- Added the rule-scoped follow-up function and full report background polling, including structured outputs, source IDs, prompt-injection boundaries, plain-prose checks, and one automatic regeneration after a failed quality check.
- Found and corrected the impossible OPT-before-travel recommendation during browser testing, then added the filing-before-departure fact across the scenario type, AI extraction schema, interview, follow-up updates, impact map, and tests.
- Rewrote deterministic cards and timelines in literal student language: old rules, dated I-94, program end, 30-day period, 60-day period, and direct form names.
- Added exact source-page mappings, extension process details, print/save-PDF, sharing, privacy-safe test-case export, and responsive timeline verification.
- Tested current, future, contradictory, story, travel, OPT, edit-preservation, report, follow-up, overview, and mobile paths in the browser and checked browser logs.

**Verification**

- Vitest: 80/80 passing after the concern-first rebuild and Applesauce Rule regressions.
- TypeScript and production Vite build: passing.
- Live GPT-5.6 Sol report: background start, polling, quality validation, and display passed.
- Live follow-up: answered the travel-before-OPT question, stayed visible, and refreshed the complete report without returning to the form.
- Story intake: extracted current student, third year, December 2026 graduation, OPT, and travel as compact bullets; duplicate concern bullets are now rejected by regression coverage.
- 390-pixel browser checks: no horizontal overflow on the welcome, overview, or planner; no console warnings or errors.

**Final quality-first model and route audit**

- OpenAI's live GPT-5.6 guidance says omitted reasoning defaults to medium and recommends reserving `max` for the hardest quality-first work. We made the choice explicit instead of silently inheriting a default: Sol at medium for narrative extraction and interactive follow-ups, and max for the final advisor synthesis. Each level remains configurable through a Netlify environment variable.
- A live `high`-effort follow-up exhausted its original reasoning budget at the edge of the synchronous function window. Medium returned the tested travel-and-OPT answer reliably, while the final report can safely use max because it runs in background mode.
- Split extension consequences by route. A known travel return can no longer inherit an extension warning that belongs only to the student's stay-in-the-United-States timeline.
- Added a deterministic check before saying that a return may avoid Form I-539: the projected admission must actually reach the current program end date. Otherwise the app describes travel only as a separate way to request more time, with CBP making the admission decision.
- Added regression coverage for both the helpful travel case and the case where the projected returned admission still ends too early.

### The Applesauce Rule: AI Adds Value, It Does Not Rebuild the Answer

**Research and diagnosis**

- David's Applesauce Rule: use the level of model work the actual question needs. If the useful answer is "apples," do not produce the molecular composition and manufacturing process.
- The deterministic impact map already contains the verified dates, consequences, source links, and category coverage. Asking Sol to cover every category again made the final note slower and invited repetition.
- The incorrect OPT-before-travel recommendation came from a deterministic predicate, not model improvisation. The branch checked current D/S, travel, and OPT, but originally failed to require that the student's normal 90-day filing window open by March 18, 2027. Tests covered an eligible December 2026 graduate but not a May 2028 graduate with travel.

**Decisions and Codex assistance**

- The advisor note now augments the visible map with only the student's priority, important category interactions, and up to three next actions. It no longer inventories every rule card.
- Rule follow-ups begin with the direct answer, add only necessary background, and stay under 180 words.
- Sol remains the runtime model, but medium reasoning is the explicit default for all three writing/extraction tasks. The deterministic engine performs the difficult legal and date work; more hidden reasoning did not improve this bounded writing task and created avoidable latency and token-limit failures.
- Rephrased the OPT travel question as "Will you submit your Form I-765 before you leave the United States?" Online submission is the controlling action students understand.
- The OPT predicate now checks the actual filing-window opening date, and exact regression cases cover both eligible and ineligible travel timing.
- Live verification produced a two-paragraph, 76-word advisor note and a direct 50-word travel answer in under nine seconds. Both used the verified dates without repeating the impact-card inventory.

### Six-Step, One-Question Advising Remodel

**Research and diagnosis**

- The previous build had strong rule logic but did not implement the agreed experience. It reused a ten-checkbox topic picker in two places, so the student had to predict which legal categories mattered before receiving advice.
- Pressing “Ask me useful follow-ups” could jump directly to the report when a selected category had no unanswered field. The interface therefore showed “Create my advisement” without ever giving the promised deeper guidance.
- The 80-test suite verified engines and components but had no explicit state-machine test for the six-step journey. Passing tests gave false confidence about the product flow.
- Report failures were reduced to “The advisement did not finish,” hiding whether the live model, polling route, or prose-quality check had failed.
- Browser review also exposed a fact-boundary problem: an internal default of “no transfer plan” could be written as though the student had actually said it.

**Decisions**

- Encode exploration as an explicit state machine: `offer`, `question`, `insight`, or `complete`. Every active category must occupy exactly one of those states.
- Ask one open concern question after the September 15 gate. When the student is unsure, begin with length of stay and lead them through the applicable map instead of demanding subject-matter knowledge.
- Automatically explore student-raised concerns first. Then offer every other applicable category individually with a short statement of why it matters.
- After the controlling facts for a category are known, always show a substantive result before continuing. A category with no missing question receives an insight, not a silent transition.
- Keep the live impact map visible throughout. The concern sets order and emphasis; it does not suppress other applicable rules.
- Give Sol the server-verified map as prepared evidence and ask for a complete four-to-eight-paragraph advisor overview: concern first, every applicable category, important interactions, unresolved facts, and practical next steps. The model synthesizes rather than recalculates.
- Separate confirmed answers from internal scenario defaults in the AI payload. Unknown or untouched defaults may not become student facts.
- Preserve the actual report error in the interface and retain all deterministic guidance while a report is retried.

**Codex assistance**

- Traced the old UI state transitions from the checkbox picker through question generation and report generation, then replaced them with a small tested flow controller.
- Built concern-first text intake, automatic focus ordering, one-question category exploration, substantive category insights, and system-led offers without removing the deterministic engine, timelines, voice intake, sharing, or follow-up advisor.
- Restored the full advisor assignment after an over-literal interpretation of the Applesauce Rule had compressed it into two paragraphs. Sol now assembles the complete answer from facts already established instead of rediscovering them.
- Used browser scenarios to find issues unit tests missed: the silent category skip, duplicate I-20 labels, and the unconfirmed transfer default.

**Verification**

- Vitest: 87/87 passed across six test files, including new acceptance tests for concern priority, one-category offers, one-question steps, mandatory insights, and completion.
- TypeScript and the production Vite build passed.
- Browser journeys passed for a current student with travel and OPT concerns, a current student who did not know what to ask, and a future graduate student with unknown dates.
- Two live GPT-5.6 Sol reports completed with full multi-paragraph advisement, explicit uncertainty when dates were missing, no invented transfer answer, and no internal “duration-of-status status” wording.
- Mobile checks at 390 by 844 found no horizontal overflow on the welcome or concern-intake screens; browser console warnings and errors were empty.

### OPT Deadlines on the Visual Timeline

**Research and diagnosis**

- David tested a current student graduating in spring 2027 who plans post-completion OPT. The impact card correctly identified the temporary path that can avoid Form I-539, but the visual timeline omitted the dates that made the advice useful.
- The impact map calculated the normal 90-day OPT filing-window opening and the March 18, 2027 transition cutoff. The deterministic timeline builder received only the rule date, I-20/EAD end, and 60-day end, so the two surfaces used the same scenario without sharing the same date set.
- Code review found a related safety gap: a planned I-765 date before the normal filing window could pass the transition-deadline checks because the engine checked only whether it was too late.

**Decisions and Codex assistance**

- Make every controlling date behind an OPT recommendation visible on the timeline. For a known post-completion OPT plan, add the ordinary 90-day filing-window opening, the student-specific deadline to avoid Form I-539 solely because the rule changed, and any planned or completed Form I-765 filing date.
- Use the earlier of March 18, 2027 and the student's old-rule/EAD deadline. If the normal filing window opens later, show the March 18 date first as “Form I-539 exception closes” so the timeline explains why the exception is unavailable.
- Share one deterministic helper between the impact card and timeline for the post-completion OPT filing-window date.
- Reject a planned filing before the normal filing window and mark that date as a risk on the timeline.
- Use literal labels, including “Deadline to avoid Form I-539 for OPT,” instead of internal transition-path shorthand.

**Verification**

- Vitest: 90/90 passed; TypeScript and the production Vite build passed.
- Exact browser case: current undergraduate, I-20 end May 20, 2027, post-completion OPT not yet filed. The timeline rendered September 15, 2026; February 19, 2027 filing-window opening; March 18, 2027 Form I-539 exception deadline; May 20 program end; and July 19 end of the 60-day period.
- A May 2028 program-end regression shows the March 18, 2027 exception closing before the February 20, 2028 normal filing window.
- Desktop and 390-pixel screenshots passed. The mobile timeline remained vertical and the page had no horizontal overflow.

### Impossible Program-End Date Becomes a Required Correction

**Research and diagnosis**

- David's live test combined valid F-1 status in the United States on September 15, 2026 with a stated May 2026 program end. The engine already refused to calculate a full past I-20 date, but the interview treated that finding as background and could continue showing a provisional old-rules conclusion.
- Replayed the exact narrative against the live GPT-5.6 Sol intake. Sol recognized “May 2026,” but the old prompt required a day before returning any date fact. In another run it preserved the date with low confidence because it conflicted with “next spring.” Either path could keep the safety issue out of the deterministic scenario.
- Rechecked NAFSA's July 20 analysis: transition treatment depends on valid F-1 status in the United States on September 15 and the I-20 or approved OPT/STEM OPT EAD then in effect. A pre-September I-20 end therefore requires a later I-20, qualifying approved EAD, or correction of the September 15 answer before a transition result is established.

**Decisions and Codex assistance**

- Treat incomplete dates such as `2026-05` as clarification clues only. They can stop an inconsistent result but can never become calculation dates or timeline deadlines.
- Put the conflict ahead of all ordinary questions and results. The student receives one resolving question: correct the I-20 date, identify approved regular OPT, identify approved STEM OPT, or correct the September 15 answer.
- If approved OPT or STEM OPT is selected, require an exact EAD expiration date that covers September 15 before continuing. A date before September 15 remains on the same question with a direct explanation.
- Do not discard low-confidence date clues when checking for contradictions. They remain excluded from calculations and are used only to request confirmation.
- Replace the provisional “You are under the old rules” conclusion with “These dates do not fit yet” until the conflict is resolved.
- Hide downstream old-rule cards while the contradiction is unresolved; all personalized cards return as soon as the controlling date is corrected.

**Verification**

- Vitest: 95/95 passed; TypeScript and the production Vite build passed.
- Live Sol intake preserved “May 2026” as a partial date without inventing a day.
- Exact browser replay showed the conflict on the story screen, then opened the single correction question. Changing the I-20 end to May 20, 2027 cleared the warning and restored the February 19 OPT-window date and March 18 Form I-539 exception deadline on the timeline.
- Desktop and 390-pixel checks passed with no horizontal overflow or browser-console errors.

### Student-Controlled Impact Map and Full Interview

**Research and diagnosis**

- David's six-step advising model is categorization, not a funnel: establish the September 15 branch, learn what brought the student in, address that concern, show every other potential impact briefly, let the student choose which areas to deepen, and then synthesize the whole record.
- The prior state machine still controlled the journey. It offered one category after another, asked whether the student wanted to explore a topic the student had never mentioned, and hid the final advisement behind generic “Continue” and completion states.
- Full cards for every category recreated the original information overload. The useful distinction is prominence: student-raised and student-selected topics receive full guidance; every other potential impact remains visible as one short, personalized line.
- A browser review caught a responsive defect that page-level overflow measurements missed. A bottom-sticky advisement panel overlapped the final answer choice on a 390-pixel screen.

**Decisions**

- Keep the student's initial concerns permanently prominent. Selecting another issue appends it to the priority set; it never replaces or demotes an earlier concern.
- Replace system-led topic offers with a deterministic ten-area impact index: length of stay, travel, extension, OPT, transfer, program change, later programs, CPT, F-2 family, and early end or withdrawal.
- Give each index row a short outcome produced from the verified impact map. When a detailed claim is not yet available, use a reviewed category-specific fallback rather than model-generated interface copy.
- Clicking an impact opens only the controlling questions for that topic, one at a time. When the answers are sufficient, its full guidance joins the existing priority cards.
- Rename the no-story route “Take the full interview” and skip the duplicate open-ended concern question. That route asks every relevant controlling question one at a time and progressively marks each category covered.
- Keep “I'm ready for my advisement” available after the core facts are established, including in the middle of the full interview. Move it above the active question so it remains prominent without covering answer controls.
- Preserve later answers and topic priorities when an earlier answer changes. The calculation and wording update, but a previously selected concern remains selected unless the student changes that concern directly.

**Codex and OpenAI assistance**

- Codex traced the old offer/question/insight/complete state machine, removed the system-led queue, and rebuilt the UI around persistent priorities plus direct topic selection while leaving the deterministic legal engine intact.
- Codex converted the verified rule matrix into compact personalized impact lines, added regression tests for ordering and literal graduate/undergraduate language, and caught the false “You mentioned travel” statement during browser testing.
- GPT-5.6 Sol continues to extract a student's story and compose the final advisor narrative from deterministic facts. It does not choose the impact list, calculate dates, or invent the category outcomes.
- A live early-exit report was generated while the I-20 date remained unknown and the travel question was still unanswered. Sol kept the uncertainty explicit, covered the established rule categories, and ended with prioritized actions.

**Verification**

- Vitest: 94/94 passed across six test files; TypeScript and the production Vite build passed; `git diff --check` passed.
- Focused-story browser path: OPT and Form I-539 stayed prominent; selecting school transfer added it without removing either initial priority; after the transfer answer, the unfinished OPT path resumed.
- Full-interview browser path: no duplicate concern prompt, no checkboxes, one question at a time, all ten compact impacts visible, no claim that the student mentioned travel, and advisement available before completion.
- Live GPT-5.6 Sol advisement completed successfully from the early-exit state. Deterministic cards and timelines remained available throughout generation.
- Desktop at 1440 by 1000 and mobile at 390 by 844 had no horizontal overflow, no internal text overflow, no control overlap after the sticky-panel correction, and no browser warnings or errors.

### Narrative Facts Now Reach the Actual Advising Record

**Research and diagnosis**

- A de-identified replay of a real advising case exposed a boundary the earlier calculator tests did not cover. GPT-5.6 Sol correctly recognized completed graduate study, approved OPT, a later same-level program, school-transfer concerns, a pending employment-based immigrant petition, and questions about school support. Those details appeared as confirmation labels, but several never entered the deterministic scenario used by the results page.
- The intake response had effectively become two records: human-readable highlights and a narrower structured fact object. Partial month-and-year dates were also discarded because they were not exact enough for calculations, even though they were useful for choosing the next question and drawing an honest provisional timeline.
- Results and the complete impact index were still gated behind an exact controlling date. That left a well-understood case looking almost empty and asked the student to repeat dates already supplied.
- The final rule's same- or lower-level restriction applies to a program completed after the rule takes effect. A degree completed before September 15, 2026 does not itself block a later program at the same level. The active graduate-program restriction, the transfer-from-OPT timing rule, F-1 temporary-purpose review, and who actually files Form I-539 are separate issues and must remain separate in the advice.

**Decisions**

- Use one normalized fact record for confirmations, scenario state, questions, impact cards, timeline events, follow-up conversation, and the final advisor report. Keep every supported structured fact even when it is not one of the short visible confirmation labels.
- Preserve incomplete dates as labeled hints. They cannot drive a legal calculation, but they can prevent duplicate questions, identify which exact day is still needed, and appear on a timeline as an explicitly approximate milestone.
- Use a ten-area impact taxonomy, then show each student every area that applies or could apply to that student's case. Omit categorically irrelevant areas. Every visible line is short, personalized, clickable, and explorable one question at a time. A missing exact date cannot hide the rest of the applicable rule.
- Keep the student's stated concerns as full priority cards. Selecting another line adds a priority without removing any earlier focus.
- Distinguish an earlier completed program from the I-20 or approved EAD in effect on September 15. For approved OPT, ask for the exact EAD expiration day instead of asking again for the completed program's I-20 date.
- Give later-program, immigrant-petition, and school-filing-support questions their own verified guidance. Do not imply that a pre-rule master's degree requires a same-level SEVP exception, that a pending I-140 automatically decides an F-1 extension, or that the school files Form I-539 for the student.
- Link rule citations to the relevant Federal Register text fragment instead of repeatedly opening the top of the same document.

**Codex and OpenAI assistance**

- Codex traced the split from the Netlify intake function through normalization, scenario merging, question selection, impact generation, and timeline rendering. It repaired the handoff rather than adding case-specific UI exceptions.
- GPT-5.6 Sol continues to perform bounded story extraction and final narrative synthesis. Deterministic code decides dates, applicable rule categories, compact impact lines, and the claims supplied to the model.
- The real student message and identifying details were not added to source control. Regression coverage uses synthetic, de-identified facts with the same legal shape.

**Verification**

- Vitest: 99/99 passed across six test files; TypeScript and the production Vite build passed; `git diff --check` passed.
- A live synthetic intake preserved all eight material facts, including partial dates, the later program, the pending petition, and the school-support question. A simpler undergraduate case preserved undergraduate status, OPT, and a later-program plan together.
- In the browser, the first results screen showed the student's priority cards, all ten clickable impact lines, and a useful partial timeline while asking only for the missing EAD day. Selecting travel added it as a priority and opened one travel question without erasing the earlier concerns.
- After exact dates were supplied, the timeline showed the prior program, rule date, EAD end, next-program start, 60-day end, and next-program end. The resulting extension and transfer guidance used those dates consistently.
- A live final advisor report completed successfully and covered the full established record without replacing or contradicting the deterministic cards.

### One Student, Several Connected Events

**Research and diagnosis**

- The remaining failures were not primarily missing AI intelligence. The data model still treated one student as one flat calculation. A completed program, active OPT, a future program, travel, and a pending petition could all be recognized correctly and still compete for the same scalar fields.
- The topic router compounded that problem by finishing one category and then resuming another category's private queue. A student who raised travel and OPT could answer a travel question and then appear to be dropped into an unrelated OPT interview with no shared context.
- A dense synthetic case also showed a runtime problem: GPT-5.6 Sol at medium and low effort could exceed Netlify's 30-second synchronous intake limit. The same bounded extraction completed with GPT-5.6 Luna at low effort in about 9.2 seconds while preserving the full event structure.

**Decisions**

- Keep the agreed six-step student experience fixed. The internal architecture changes; the student still answers the September 15 question, tells the story, sees the main concern first, sees every other applicable impact, chooses any deeper areas, and receives one complete advisement plus follow-up chat.
- Represent the student as one temporal case containing separate events: completed program, active or incoming program, approved or planned OPT, return from travel, future program, and pending immigrant petition.
- Evaluate rule-area applicability from that case. Show areas that apply, could apply, or need one fact; omit areas that are categorically irrelevant. A student's concern controls order and prominence, not whether other applicable rules disappear.
- Select one controlling question across all current priorities. A question can resolve several connected topics, such as travel and OPT. Completing or adding one topic does not erase compatible answers or demote earlier priorities.
- Keep exact legal dates and outcomes deterministic. AI creates the structured temporal brief and later explains the verified case; it does not calculate the rule.
- Use GPT-5.6 Luna at low effort for bounded intake extraction and GPT-5.6 Sol at medium effort for the complete advisor report and rule-scoped follow-ups. This follows the Applesauce Rule: use the reasoning strength the assignment actually needs.

**Codex and OpenAI assistance**

- Codex traced the failure across intake extraction, fact normalization, the flat scenario, topic routing, impact applicability, and timeline merging, then introduced the temporal case layer without replacing the tested rule engine.
- OpenAI structured output now returns both normalized facts and distinct case events. Partial month dates remain visible and editable; confirming an exact day replaces the partial milestone instead of duplicating it.
- The final Sol report receives the event timeline and applicable-rule evaluation in addition to deterministic findings, so it can assemble the whole case without rediscovering or collapsing the student's history.

**Verification**

- Vitest: 105/105 passed across seven test files; TypeScript and the production Vite build passed; `git diff --check` passed.
- Exact focused acceptance case: a current undergraduate graduating May 2027 with OPT and travel concerns preserved all four facts, prefilled May and 2027, asked only for the missing day and one integrated travel question, and stopped without an unnecessary DSO or filing-status interview.
- That case's timeline showed February 19, 2027 for the OPT filing-window opening, March 18 for the one-time Form I-539 exception deadline, May 20 for program end, and July 19 for the 60-day end. Confirming the day replaced the month-only milestone rather than adding a duplicate.
- Dense synthetic acceptance case: a May 2026 completed master's, approved OPT through June 2027, later same-level master's, school transfer, and pending employment petition stayed separate. Adding the later program produced one ordered timeline with the completed program, rule date, EAD end, next-program start, 60-day end, and next-program end.
- The complete Sol advisement finished successfully and covered stay, travel, OPT, extension routes, undergraduate school and program rules, later programs, CPT, F-2 family, and early completion from the verified case.
- A 390 by 844 browser check had no horizontal overflow or overlapping controls, and the browser console contained no warnings or errors.

### Exact Rule Citations That Preserve the Student's Work

**Research and diagnosis**

- Federal Register text-fragment links opened the rule but did not consistently scroll to or highlight the requested language. New-tab citation links were also ignored by the one-tab in-app preview.
- The published Federal Register HTML gives each rule paragraph a stable `p-####` anchor and visually brackets the targeted paragraph when that anchor is opened.

**Decisions**

- Point every rule citation to its verified Federal Register paragraph anchor rather than searching for a free-text excerpt or opening a broad PDF page.
- Open citations in the current tab and save the working case in session storage. Back returns the student to the same question, answers, priorities, and completed advisement; Start over clears the saved session.
- Reserve “Open the highlighted rule passage” for anchored Federal Register citations. General rule links say “Open the official rule,” and USCIS or other supporting citations say “Open the cited source.”

**Codex assistance and verification**

- Codex mapped all 18 rule citations to the live published HTML, confirmed that every target exists, and visually verified transition, OPT, and graduate-program paragraphs.
- Vitest: 107/107 passed across eight test files; TypeScript and the production Vite build passed; `git diff --check` passed.
- Browser verification confirmed exact highlighted landing, preserved state after Back, and no console warnings or errors.

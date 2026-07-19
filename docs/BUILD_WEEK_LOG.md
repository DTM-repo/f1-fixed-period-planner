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

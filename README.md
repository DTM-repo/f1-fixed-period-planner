# F-1 Fixed-Period Planner

Build Week prototype for turning DHS's July 17, 2026 fixed-period admission rule into a student-facing scenario planner.

The core calculator is deterministic: the same confirmed inputs produce the same dates, warnings, source citations, and follow-up questions without calling an AI model. OpenAI is used only for optional plain-language explanation and follow-up drafting.

## Local Setup

```bash
npm install
npm run dev
```

For the optional AI explanation endpoint, set:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-terra
```

## Scope

- F-1 first, including current D/S students and prospective students entering under fixed-period admission.
- J-1 and M-1 are intentionally outside the first calculator module.
- CPT, transfers, program changes, OPT, STEM OPT, travel, and pending extension scenarios are modeled as timing flags where the first-pass rule engine has enough source support.
- Legal conclusions are never delegated to the model. AI output must explain the deterministic result or request missing facts.

## Source Base

- Federal Register final rule, published July 17, 2026, effective September 15, 2026.
- Local source copy used during setup: `/Users/davidmaxon/Documents/New project/D:S Rule app/New D:S Rules.pdf`.

This is not legal advice. It is a planning and issue-spotting tool that should surface uncertainty instead of hiding it.

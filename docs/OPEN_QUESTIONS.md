# Open Questions

These are release risks or product choices, not silent holes in the deterministic calculations.

- Recheck whether DHS or SEVP has delayed or suspended the academic-mobility restrictions under 8 CFR 214.2(f)(5)(ii)(E) before every public deployment.
- Validate mid-program reentry examples against issued post-rule I-94 records when they begin to exist. The app currently uses the I-20 start date for projection and makes the actual CBP I-94 controlling.
- Keep automatic visa revalidation in the caution path until common Canada/Mexico fact patterns and agency implementation are reviewed in more depth.
- Decide whether production voice intake should use OpenAI transcription, browser speech recognition, or a privacy-preserving combination. The prototype currently uses browser speech recognition and GPT-5.6 fact extraction from the resulting text.
- Design multilingual output and translation review. Plain English is implemented, but translated legal copy needs its own verification process.
- Decide whether document-assisted intake belongs in the public app. Any I-20 or I-94 workflow needs explicit consent, redaction, retention limits, and a clear reason to upload.
- Add public-demo abuse controls and spending limits before sharing the Netlify URL broadly. Student stories should remain transient and OpenAI requests use `store: false`.
- Schedule automated freshness checks for USCIS fees, premium-processing availability, and implementation guidance.
- Keep M-1 and J-1 outside this module until each has a separate source-reviewed engine and test matrix.

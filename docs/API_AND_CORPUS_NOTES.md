# API and Corpus Notes

David has access to a separate regulatory/legal/best-practices API and a larger international-student corpus. Do not dump that material into the chat or the repo.

David also has Henry/Chatbase infrastructure:

- Public entry points: `https://aihenry.carrd.co/` and `https://henryknows.info/`.
- Existing local integration: `/Users/davidmaxon/Projects/henryknows/netlify/functions/chat-proxy.js`.
- Henry calls Chatbase server-side with `CHATBASE_API_KEY` and `CHATBASE_BOT_ID`, keeping secrets out of the browser.
- Chatbase API reference: `https://www.chatbase.co/docs/api-reference/chat/chat-with-a-chatbot`.

Efficient integration path:

- Start with source IDs and short excerpts or page anchors, not whole documents.
- Use the external API as research support for unresolved rule questions, DSO practice questions, and source verification.
- Use Henry/Chatbase as a domain-corpus answer service for background F-1/DSO practice context, especially when the app needs a short source-grounded explanation without injecting a massive corpus into the OpenAI prompt.
- Keep production app decisions tied to the local deterministic rule registry.
- Store only distilled, source-linked rule facts in this repo.
- Treat any student narrative, document scan, or API result as transient unless the user explicitly chooses to save it.
- Before relying on Henry for the duration-of-status rule, update Henry's Chatbase knowledge base with the July 17, 2026 final rule and any David-reviewed interpretation notes.
- Do not use Henry/Chatbase to compute deadlines or classify a student's legal result. It can provide contextual explanation and candidate research, while the F-1 planner's deterministic engine remains the calculator of record.
- Do not connect the hackathon app to a Henry/Chatbase bot trained on NAFSA Adviser's Manual 360 text unless NAFSA grants permission for that use.
- For hackathon-safe corpus material, use public source text plus David's own professional interpretation, written independently in his own words. Avoid copying AM360 text, close paraphrases, proprietary organization/selection, or a structure that functions as a substitute for the subscription guide.

Useful future shape:

```ts
interface RegulatoryResearchHit {
  id: string;
  sourceTitle: string;
  citation: string;
  url?: string;
  excerpt: string;
  confidence: "source_text" | "practice_guidance" | "needs_review";
  retrievedAt: string;
}
```

The app should consume that data for explanations, issue spotting, and source-review queues. It should not outsource status-date calculations to it.

Recommended app shape:

- OpenAI: structured extraction from student narrative into candidate facts, confidence, ambiguity flags, and follow-up questions.
- Student confirmation UI: show "what I understood" before applying extracted facts.
- Deterministic engine: calculate dates, warnings, citations, and scenario comparisons from confirmed facts.
- Henry/Chatbase: keep as a private research aid only. The submitted hackathon runtime should be OpenAI-only plus the deterministic engine so the project story stays clean and squarely tied to GPT-5.6/Codex.

Audit note, July 19, 2026: the clean Henry corpus was used to cross-check difficult regulatory questions during the end-to-end audit. No Henry response was copied into runtime logic, and the public final rule and agency sources remained authoritative. The production functions do not call Chatbase.

Hackathon-safe source priority:

- Federal Register final rule, eCFR, DHS, ICE, SEVP, USCIS, DOS, and other public government materials.
- David-authored summaries, examples, decision notes, and practice cautions grounded in those public sources.
- Short citation pointers to paid/proprietary references only if needed for David's private research workflow, not as chatbot training data or submitted app content.

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
- Henry/Chatbase: answer domain background questions and supply concise F-1/DSO context when the app needs broader explanation or source-review help.

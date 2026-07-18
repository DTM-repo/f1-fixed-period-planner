# API and Corpus Notes

David has access to a separate regulatory/legal/best-practices API and a larger international-student corpus. Do not dump that material into the chat or the repo.

Efficient integration path:

- Start with source IDs and short excerpts or page anchors, not whole documents.
- Use the external API as research support for unresolved rule questions, DSO practice questions, and source verification.
- Keep production app decisions tied to the local deterministic rule registry.
- Store only distilled, source-linked rule facts in this repo.
- Treat any student narrative, document scan, or API result as transient unless the user explicitly chooses to save it.

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

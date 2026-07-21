import { describe, expect, it } from "vitest";
import { hasInvalidAdvisorProse, hasInvalidReportContent } from "./explanationPayload";

describe("advisor report quality gate", () => {
  it("accepts ordinary advisor prose", () => {
    expect(hasInvalidReportContent({
      title: "Travel is the decision to plan first",
      sections: [{ heading: "If you stay", body: "Your D/S continues through May 22, 2028 if you remain in the United States." }]
    })).toBe(false);
  });

  it("rejects internal composition notes even when they are inside valid JSON", () => {
    expect(hasInvalidReportContent({
      title: "Your current program is covered",
      sections: [{ heading: "Before you travel", body: "Before traveling, speak with your DSO. Oops malformed JSON. Need correct final." }]
    })).toBe(true);
  });

  it("rejects Markdown and repeated sections", () => {
    expect(hasInvalidReportContent({
      title: "Your next step",
      sections: [{ heading: "Travel", body: "**Travel matters.** Speak with your DSO before leaving." }]
    })).toBe(true);
    expect(hasInvalidReportContent({
      title: "Your next step",
      sections: [
        { heading: "Travel first", body: "Speak with your DSO before leaving." },
        { heading: "Travel again", body: "Speak with your DSO before leaving." }
      ]
    })).toBe(true);
  });

  it("rejects an overlong advisor answer", () => {
    expect(hasInvalidAdvisorProse(Array.from({ length: 251 }, () => "word").join(" "), 250)).toBe(true);
  });

  it("does not reject a complete thought solely for missing final punctuation", () => {
    expect(hasInvalidReportContent({
      title: "Your travel plan",
      sections: [{ heading: "Current rule status", body: "No delay had been announced as of July 19" }]
    })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { hasInvalidAdvisorProse, hasInvalidReportContent } from "./explanationPayload";

describe("advisor report quality gate", () => {
  it("accepts ordinary advisor prose", () => {
    expect(hasInvalidReportContent({
      title: "Travel is the decision to plan first",
      paragraphs: ["Your D/S continues through May 22, 2028 if you remain in the United States."]
    })).toBe(false);
  });

  it("rejects internal composition notes even when they are inside valid JSON", () => {
    expect(hasInvalidReportContent({
      title: "Your current program is covered",
      paragraphs: ["Before traveling, speak with your DSO. Oops malformed JSON. Need correct final."]
    })).toBe(true);
  });

  it("rejects Markdown and repeated paragraphs", () => {
    expect(hasInvalidReportContent({
      title: "Your next step",
      paragraphs: ["**Travel matters.** Speak with your DSO before leaving.", "Your OPT timing is important."]
    })).toBe(true);
    expect(hasInvalidReportContent({
      title: "Your next step",
      paragraphs: ["Speak with your DSO before leaving.", "Speak with your DSO before leaving."]
    })).toBe(true);
  });

  it("rejects an overlong advisor answer", () => {
    expect(hasInvalidAdvisorProse(Array.from({ length: 251 }, () => "word").join(" "), 250)).toBe(true);
  });

  it("rejects a paragraph that ends mid-sentence", () => {
    expect(hasInvalidReportContent({
      title: "Your travel plan",
      paragraphs: ["No delay had been announced as of July 19"]
    })).toBe(true);
  });
});

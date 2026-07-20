import { describe, expect, it } from "vitest";
import { addCurrentStudentAssumptions, buildIntakeHighlights, deriveNarrativeTopics } from "./intakeSemantics";

const story = "I am a third-year international student graduating in December 2026. I want to do OPT, and I do not know if I can travel or when I should travel.";

describe("voice intake semantics", () => {
  it("keeps every rule-relevant concern raised in the story", () => {
    expect(deriveNarrativeTopics(story, [])).toEqual(expect.arrayContaining(["travel", "opt"]));
  });

  it("recognizes ordinary ways students describe personal travel", () => {
    expect(deriveNarrativeTopics("Can I visit home before I file for OPT?", [])).toEqual(expect.arrayContaining(["travel", "opt"]));
  });

  it("does not invent a travel concern from an unsupported model topic", () => {
    const narrative = "I am a current F-1 student in the last year of a graduate program. I will graduate next spring.";
    expect(deriveNarrativeTopics(narrative, ["travel"])).not.toContain("travel");
    expect(buildIntakeHighlights(narrative, [], ["Has a travel question"], [])).not.toContain("Has a travel question");
  });

  it("uses a correctable current-student assumption when study continues past the effective date", () => {
    const facts = addCurrentStudentAssumptions(story, []);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "startingPosition", value: "current_ds_inside_us", needsConfirmation: true }),
      expect.objectContaining({ field: "admissionBasis", value: "duration_of_status", needsConfirmation: true }),
      expect.objectContaining({ field: "inUsOnEffectiveDate", value: "yes", needsConfirmation: true }),
      expect.objectContaining({ field: "maintainingStatusOnEffectiveDate", value: "yes", needsConfirmation: true })
    ]));
  });

  it("does not assume presence when the story says the student will be outside the United States", () => {
    const facts = addCurrentStudentAssumptions(
      "I am a third-year international student graduating in December 2026, but I will be outside the United States on September 15.",
      []
    );
    expect(facts.some((fact) => fact.field === "inUsOnEffectiveDate")).toBe(false);
  });

  it("produces compact facts instead of retelling the story", () => {
    const facts = addCurrentStudentAssumptions(story, []);
    const topics = deriveNarrativeTopics(story, []);
    const highlights = buildIntakeHighlights(story, facts, [], topics);
    expect(highlights).toEqual(expect.arrayContaining([
      "Current F-1 student",
      "Third-year student",
      "Graduating December 2026",
      "Has an OPT question",
      "Has a travel question"
    ]));
    expect(highlights.every((highlight) => highlight.length <= 80)).toBe(true);
  });

  it("shows each concern only once when the model and deterministic summary use different words", () => {
    const highlights = buildIntakeHighlights(
      "I want to do OPT and visit home.",
      [
        { field: "optIntent", value: "yes", confidence: "high", needsConfirmation: false },
        { field: "travelPosture", value: "planned", confidence: "high", needsConfirmation: false }
      ],
      ["Plans OPT", "Travel question"],
      ["opt", "travel"]
    );
    expect(highlights.filter((highlight) => /\bOPT\b/i.test(highlight))).toHaveLength(1);
    expect(highlights.filter((highlight) => /\b(?:travel|trip)\b/i.test(highlight))).toHaveLength(1);
  });
});

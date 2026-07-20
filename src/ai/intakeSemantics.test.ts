import { describe, expect, it } from "vitest";
import { addCurrentStudentAssumptions, addExplicitNarrativeFacts, buildIntakeHighlights, deriveNarrativeTopics } from "./intakeSemantics";

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

  it("keeps every part of a completed-program, approved-OPT, later-program case", () => {
    const narrative = "I graduated from my university in May 2026 and am currently doing post-completion OPT, which expires in June 2027. I plan a second master's at another university and need to transfer my SEVIS record. Will the university support Form I-539? My employer filed an EB-3 petition.";
    const explicit = addExplicitNarrativeFacts(narrative, []);
    const facts = addCurrentStudentAssumptions(narrative, explicit);
    const topics = deriveNarrativeTopics(narrative, ["opt", "later_program"], facts);

    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "currentProgramEndDate", value: "2026-05" }),
      expect.objectContaining({ field: "currentEadEndDate", value: "2027-06" }),
      expect.objectContaining({ field: "optStage", value: "post_completion_approved" }),
      expect.objectContaining({ field: "educationLevel", value: "graduate" }),
      expect.objectContaining({ field: "nextProgramLevelPlan", value: "same_or_lower" }),
      expect.objectContaining({ field: "pendingEmploymentImmigrantPetition", value: "yes" })
    ]));
    expect(topics).toEqual(expect.arrayContaining([
      "opt",
      "extension",
      "school_transfer",
      "later_program",
      "immigrant_intent",
      "school_filing_support"
    ]));
    expect(buildIntakeHighlights(narrative, facts, [], topics)).toEqual(expect.arrayContaining([
      "Current F-1 student",
      "Graduate student",
      "Program completed May 2026",
      "Approved OPT through June 2027",
      "Plans a second master's degree",
      "Pending employment-based immigrant petition"
    ]));
  });

  it("does not drop undergraduate status or a new-program concern when OPT is also mentioned", () => {
    const narrative = "I am a UG student on OPT and I want to start a new program.";
    const facts = addExplicitNarrativeFacts(narrative, []);
    const topics = deriveNarrativeTopics(narrative, ["opt", "later_program"], facts);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "educationLevel", value: "undergraduate" })
    ]));
    expect(topics).toEqual(expect.arrayContaining(["opt", "later_program"]));
  });

  it("keeps a month-year graduation event when the student says May of 2027", () => {
    const narrative = "I am an undergraduate and I plan to graduate in May of 2027, then do OPT. I am worried about how these rules might affect me, especially travel.";
    const facts = addExplicitNarrativeFacts(narrative, [
      { field: "optIntent", value: "yes", confidence: "high", needsConfirmation: false },
      { field: "optStage", value: "none", confidence: "high", needsConfirmation: false }
    ]);
    const topics = deriveNarrativeTopics(narrative, ["travel", "opt"], facts);
    const highlights = buildIntakeHighlights(narrative, facts, [], topics);

    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "currentProgramEndDate", value: "2027-05" }),
      expect.objectContaining({ field: "educationLevel", value: "undergraduate" }),
      expect.objectContaining({ field: "programType", value: "college_or_university" })
    ]));
    expect(highlights).toContain("Graduating May 2027");
  });
});

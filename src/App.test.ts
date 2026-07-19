import { describe, expect, it } from "vitest";
import { buildQuestions, mergeFacts } from "./App";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import type { IntakeCandidateFact } from "./ai/intakePayload";
import type { StudentScenario } from "./engine/types";

function fact(field: IntakeCandidateFact["field"], value: string): IntakeCandidateFact {
  return { field, value, confidence: "high", needsConfirmation: false };
}

describe("confirmed September 15 answer", () => {
  it("cannot be overwritten by a conflicting narrative extraction", () => {
    const current = {
      ...DEFAULT_SCENARIO,
      inUsOnEffectiveDate: "yes" as const,
      maintainingStatusOnEffectiveDate: "yes" as const,
      admissionBasis: "duration_of_status" as const,
      startingPosition: "current_ds_inside_us" as const
    };
    const merged = mergeFacts(current, [
      fact("inUsOnEffectiveDate", "no"),
      fact("maintainingStatusOnEffectiveDate", "no"),
      fact("startingPosition", "prospective_outside_us")
    ], true);
    expect(merged.inUsOnEffectiveDate).toBe("yes");
    expect(merged.maintainingStatusOnEffectiveDate).toBe("yes");
    expect(merged.startingPosition).toBe("current_ds_inside_us");
    expect(merged.admissionBasis).toBe("duration_of_status");
  });

  it("keeps a no answer but can still recognize an in-country change of status", () => {
    const current = {
      ...DEFAULT_SCENARIO,
      inUsOnEffectiveDate: "no" as const,
      startingPosition: "prospective_outside_us" as const,
      admissionBasis: "fixed_period" as const
    };
    const merged = mergeFacts(current, [
      fact("inUsOnEffectiveDate", "yes"),
      fact("startingPosition", "change_status_inside_us")
    ], true);
    expect(merged.inUsOnEffectiveDate).toBe("no");
    expect(merged.startingPosition).toBe("change_status_inside_us");
    expect(merged.admissionBasis).toBe("fixed_period");
  });
});

const completedCoreAnswers = new Set([
  "presence",
  "programEnd",
  "educationLevel",
  "optIntent",
  "travelIntent",
  "schoolTransfer",
  "programChange",
  "nextProgram"
]);

function currentStudent(programEnd: string): StudentScenario {
  return {
    ...DEFAULT_SCENARIO,
    startingPosition: "current_ds_inside_us",
    admissionBasis: "duration_of_status",
    inUsOnEffectiveDate: "yes",
    maintainingStatusOnEffectiveDate: "yes",
    programEndOnEffectiveDate: programEnd,
    currentProgramEndDate: programEnd,
    educationLevel: "graduate",
    optIntent: "no",
    travelPosture: "none",
    schoolTransferPlan: "no",
    academicProgramChangePlan: "no",
    nextProgramLevelPlan: "not_planning",
    cptPlan: "none"
  };
}

describe("CPT interview relevance", () => {
  it("does not ask about CPT after an I-20 end date when no earlier deadline exists", () => {
    const questions = buildQuestions(currentStudent("2028-05-22"), completedCoreAnswers, [], "2028-05-22");
    expect(questions.map((question) => question.id)).not.toContain("cptIntent");
    expect(questions.map((question) => question.id)).not.toContain("cptTiming");
  });

  it("asks only whether CPT is planned when an earlier admission deadline matters", () => {
    const questions = buildQuestions(currentStudent("2031-05-22"), completedCoreAnswers, [], "2030-09-15");
    expect(questions.map((question) => question.id)).toContain("cptIntent");
    expect(questions.map((question) => question.id)).not.toContain("cptTiming");
  });

  it("keeps a student-raised CPT question visible without inventing impossible timing", () => {
    const questions = buildQuestions(currentStudent("2028-05-22"), completedCoreAnswers, ["cpt"], "2028-05-22");
    expect(questions.map((question) => question.id)).toContain("cptIntent");
    expect(questions.map((question) => question.id)).not.toContain("cptTiming");
  });
});

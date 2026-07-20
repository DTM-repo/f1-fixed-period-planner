import { describe, expect, it } from "vitest";
import type { IntakeCandidateFact } from "../ai/intakePayload";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import type { StudentScenario } from "../engine/types";
import { applicableCaseTopics, buildStudentCase } from "./studentCase";

function currentScenario(overrides: Partial<StudentScenario> = {}): StudentScenario {
  return {
    ...DEFAULT_SCENARIO,
    startingPosition: "current_ds_inside_us",
    admissionBasis: "duration_of_status",
    inUsOnEffectiveDate: "yes",
    maintainingStatusOnEffectiveDate: "yes",
    ...overrides
  };
}

function fact(field: IntakeCandidateFact["field"], value: string): IntakeCandidateFact {
  return { field, value, confidence: "high", needsConfirmation: true };
}

describe("student temporal case", () => {
  it("replaces a month-only program date with the confirmed exact date", () => {
    const studentCase = buildStudentCase(currentScenario({
      currentProgramEndDate: "2027-05-20",
      programEndOnEffectiveDate: "2027-05-20"
    }), [], [], [{
      kind: "program",
      role: "active_program",
      label: "Current undergraduate program",
      startDate: "",
      endDate: "2027-05",
      educationLevel: "undergraduate",
      confidence: "high",
      needsConfirmation: true
    }]);

    const activePrograms = studentCase.events.filter((event) => event.role === "active_program");
    expect(activePrograms).toHaveLength(1);
    expect(activePrograms[0]?.end?.value).toBe("2027-05-20");
  });

  it("keeps a partial program end, planned OPT, and travel concern as one coordinated case", () => {
    const studentCase = buildStudentCase(currentScenario({
      currentProgramEndDateHint: "2027-05",
      educationLevel: "undergraduate",
      programType: "college_or_university",
      optIntent: "yes",
      optStage: "none"
    }), [
      fact("currentProgramEndDate", "2027-05")
    ], ["opt", "travel"]);

    expect(studentCase.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "active_program", end: { value: "2027-05", precision: "month" } }),
      expect.objectContaining({ role: "planned_opt" })
    ]));
    expect(studentCase.concerns).toEqual(["opt", "travel"]);
    expect(applicableCaseTopics(studentCase)).toEqual(expect.arrayContaining([
      "stay_length",
      "travel",
      "extension",
      "opt",
      "school_transfer",
      "program_change",
      "later_program",
      "cpt"
    ]));
  });

  it("separates a completed program, approved OPT, and a later program", () => {
    const studentCase = buildStudentCase(currentScenario({
      currentProgramEndDateHint: "2026-05",
      currentEadEndDateHint: "2027-06",
      educationLevel: "graduate",
      programType: "college_or_university",
      optIntent: "yes",
      optStage: "post_completion_approved",
      nextProgramLevelPlan: "same_or_lower",
      pendingEmploymentImmigrantPetition: "yes"
    }), [], ["later_program", "school_transfer", "immigrant_intent"]);

    expect(studentCase.events.map((event) => event.role)).toEqual(expect.arrayContaining([
      "completed_program",
      "approved_opt",
      "future_program",
      "pending_petition"
    ]));
    expect(studentCase.events.find((event) => event.role === "completed_program")?.end).toEqual({
      value: "2026-05",
      precision: "month"
    });
  });

  it("removes categories that cannot apply to a completed-program-only case", () => {
    const studentCase = buildStudentCase(currentScenario({
      currentProgramEndDate: "2026-05-20",
      educationLevel: "graduate",
      programType: "college_or_university",
      optIntent: "yes",
      optStage: "post_completion_approved",
      currentEadEndDate: "2027-06-30",
      hasF2Dependents: "no",
      nextProgramLevelPlan: "not_planning"
    }), [], ["opt"]);

    const topics = applicableCaseTopics(studentCase);
    expect(topics).not.toContain("program_change");
    expect(topics).not.toContain("cpt");
    expect(topics).not.toContain("dependents");
    expect(topics).not.toContain("early_end");
    expect(topics).not.toContain("later_program");
    expect(topics).toContain("opt");
    expect(topics).toContain("travel");
  });
});

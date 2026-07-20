import { describe, expect, it } from "vitest";
import { buildCoreQuestions, buildDisplayTimeline, buildQuestions, hasEffectiveDateCoverageConflict, mergeFacts } from "./App";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import type { IntakeCandidateFact } from "./ai/intakePayload";
import type { StudentScenario } from "./engine/types";
import { allImpactTopics } from "./flow/advisingFlow";

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

describe("September 15 document conflicts", () => {
  const presenceOnly = new Set(["presence"]);

  it("stops on a full I-20 date that ends before the student says valid F-1 status continues", () => {
    const scenario = currentStudent("2026-05-20");
    const questions = buildCoreQuestions(scenario, new Set([...presenceOnly, "programEnd"]));
    expect(hasEffectiveDateCoverageConflict(scenario)).toBe(true);
    expect(questions.find((question) => question.id === "effectiveDateCoverage")?.prompt).toBe(
      "What will keep your F-1 status active on September 15, 2026?"
    );
    expect(questions.map((question) => question.id)).not.toContain("educationLevel");
  });

  it("uses a month-and-year clue to request clarification without treating it as a calculation date", () => {
    const scenario: StudentScenario = {
      ...DEFAULT_SCENARIO,
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes"
    };
    const partialDate = fact("currentProgramEndDate", "2026-05");
    partialDate.confidence = "low";
    partialDate.needsConfirmation = true;
    const questions = buildCoreQuestions(scenario, presenceOnly, [partialDate]);
    const conflict = questions.find((question) => question.id === "effectiveDateCoverage");
    expect(conflict?.help).toContain("May 2026");
    expect(questions.map((question) => question.id)).not.toContain("programEnd");
  });

  it("asks for the approved EAD date before continuing", () => {
    const scenario = currentStudent("2026-05-20");
    scenario.optIntent = "yes";
    scenario.optStage = "post_completion_approved";
    const questions = buildCoreQuestions(scenario, new Set([...presenceOnly, "programEnd", "effectiveDateCoverage"]));
    expect(questions.at(-1)?.id).toBe("effectiveEadEnd");
    expect(questions.map((question) => question.id)).not.toContain("educationLevel");
  });

  it("continues only after an approved EAD covers September 15", () => {
    const scenario = currentStudent("2026-05-20");
    scenario.optIntent = "yes";
    scenario.optStage = "post_completion_approved";
    scenario.eadEndOnEffectiveDate = "2027-05-19";
    scenario.currentEadEndDate = "2027-05-19";
    const questions = buildCoreQuestions(scenario, new Set([...presenceOnly, "programEnd", "effectiveEadEnd"]));
    expect(hasEffectiveDateCoverageConflict(scenario)).toBe(false);
    expect(questions.map((question) => question.id)).toContain("effectiveEadEnd");
    expect(questions.map((question) => question.id)).toContain("educationLevel");
  });

  it("preserves partial completion and EAD dates while carrying every structured fact forward", () => {
    const merged = mergeFacts({
      ...DEFAULT_SCENARIO,
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes"
    }, [
      { ...fact("currentProgramEndDate", "2026-05"), needsConfirmation: true },
      { ...fact("currentEadEndDate", "2027-06"), needsConfirmation: true },
      fact("optStage", "post_completion_approved"),
      fact("educationLevel", "undergraduate"),
      fact("nextProgramLevelPlan", "same_or_lower")
    ], true);

    expect(merged.currentProgramEndDateHint).toBe("2026-05");
    expect(merged.currentEadEndDateHint).toBe("2027-06");
    expect(merged.optStage).toBe("post_completion_approved");
    expect(merged.optIntent).toBe("yes");
    expect(merged.educationLevel).toBe("undergraduate");
    expect(merged.nextProgramLevelPlan).toBe("same_or_lower");
    expect(buildCoreQuestions(merged, new Set(["presence"]), []).at(-1)?.id).toBe("effectiveEadEnd");
  });

  it("shows known month-and-year milestones before the exact EAD day is confirmed", () => {
    const scenario: StudentScenario = {
      ...DEFAULT_SCENARIO,
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      optIntent: "yes",
      optStage: "post_completion_approved",
      currentProgramEndDateHint: "2026-05",
      currentEadEndDateHint: "2027-06"
    };
    const events = buildDisplayTimeline(scenario, [{
      date: "2026-09-15",
      title: "The new rule begins",
      detail: "The effective date.",
      tone: "warning"
    }]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ dateLabel: "May 2026", title: "Your previous program ended" }),
      expect.objectContaining({ dateLabel: "Sep 15, 2026", title: "The new rule begins" }),
      expect.objectContaining({ dateLabel: "June 2027", title: "Your approved OPT ends" }),
      expect.objectContaining({ dateLabel: "60 days later", title: "Your old-rule period ends" })
    ]));
  });
});

const completedCoreAnswers = new Set([
  "presence",
  "programEnd",
  "educationLevel",
  "programType",
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
    programType: "college_or_university",
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

  it("does not ask about CPT merely because an earlier admission deadline exists", () => {
    const questions = buildQuestions(currentStudent("2031-05-22"), completedCoreAnswers, [], "2030-09-15");
    expect(questions.map((question) => question.id)).not.toContain("cptIntent");
    expect(questions.map((question) => question.id)).not.toContain("cptTiming");
  });

  it("asks about CPT when the student chooses to explore it", () => {
    const questions = buildQuestions(currentStudent("2031-05-22"), completedCoreAnswers, ["cpt"], "2030-09-15");
    expect(questions.map((question) => question.id)).toContain("cptIntent");
  });

  it("keeps a student-raised CPT question visible without inventing impossible timing", () => {
    const questions = buildQuestions(currentStudent("2028-05-22"), completedCoreAnswers, ["cpt"], "2028-05-22");
    expect(questions.map((question) => question.id)).toContain("cptIntent");
    expect(questions.map((question) => question.id)).not.toContain("cptTiming");
  });
});

describe("OPT and travel order", () => {
  const travelAndOptAnswers = new Set([
    "presence",
    "programEnd",
    "educationLevel",
    "programType",
    "travelIntent",
    "returnAfterRule",
    "returnDate",
    "travelI20",
    "travelProgramStart",
    "optIntent",
    "optStatus",
    "dsoRecommendation",
    "optFilingDate"
  ]);

  it("asks an eligible student whether they will submit Form I-765 before travel", () => {
    const scenario: StudentScenario = {
      ...currentStudent("2026-12-20"),
      programStartDate: "2023-08-28",
      optIntent: "yes",
      optStage: "post_completion_not_filed",
      dsoRecommendedOpt: "no",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2026-10-30",
      reentryBasis: "same_i20_balance"
    };
    const questions = buildQuestions(scenario, travelAndOptAnswers, ["travel", "opt"], "2026-12-20");
    expect(questions.find((question) => question.id === "optBeforeTravel")?.prompt).toBe(
      "Will you submit your Form I-765 before you leave the United States?"
    );
  });

  it("does not ask the filing-before-travel question when the OPT window opens after the one-time deadline", () => {
    const scenario: StudentScenario = {
      ...currentStudent("2028-05-22"),
      programStartDate: "2024-08-26",
      optIntent: "yes",
      optStage: "post_completion_not_filed",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2026-10-30",
      reentryBasis: "same_i20_balance"
    };
    const questions = buildQuestions(scenario, travelAndOptAnswers, ["travel", "opt"], "2028-05-22");
    expect(questions.map((question) => question.id)).not.toContain("optBeforeTravel");
  });
});

describe("full interview wording", () => {
  it("asks about travel without claiming the student mentioned it", () => {
    const questions = buildQuestions(
      currentStudent("2028-05-22"),
      new Set(["presence", "programEnd", "educationLevel", "programType"]),
      allImpactTopics(),
      "2028-05-22"
    );
    const travelQuestion = questions.find((question) => question.id === "travelIntent");
    expect(travelQuestion?.prompt).toBe("Are you planning to travel outside the United States?");
    expect(travelQuestion?.prompt).not.toContain("mentioned");
  });
});

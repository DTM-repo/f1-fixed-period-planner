import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import { draftScenarioFromNarrative } from "./narrativeDraft";

describe("draftScenarioFromNarrative", () => {
  it("updates default facts from an explicit month-name student story", () => {
    const scenario = draftScenarioFromNarrative(
      "I am in the U.S. on F-1 D/S. My I-20 ends May 20, 2029 and I want to travel in August 2027.",
      DEFAULT_SCENARIO
    );

    expect(scenario.startingPosition).toBe("current_ds_inside_us");
    expect(scenario.admissionBasis).toBe("duration_of_status");
    expect(scenario.programEndOnEffectiveDate).toBe("2029-05-20");
    expect(scenario.currentProgramEndDate).toBe("2029-05-20");
    expect(scenario.travelPosture).toBe("planned");
  });

  it("does not guess numeric slash date order from narrative text", () => {
    const scenario = draftScenarioFromNarrative(
      "My I-20 ends 6/2/2029 and I am not sure what that means.",
      {
        ...DEFAULT_SCENARIO,
        programEndOnEffectiveDate: undefined,
        currentProgramEndDate: undefined
      }
    );

    expect(scenario.programEndOnEffectiveDate).toBeUndefined();
    expect(scenario.currentProgramEndDate).toBeUndefined();
  });

  it("drafts incoming and OPT facts from plain-language story text", () => {
    const scenario = draftScenarioFromNarrative(
      "I am incoming and outside the U.S. My program ends 15 May 2030. I will file OPT on February 10, 2027.",
      DEFAULT_SCENARIO
    );

    expect(scenario.startingPosition).toBe("prospective_outside_us");
    expect(scenario.admissionBasis).toBe("fixed_period");
    expect(scenario.inUsOnEffectiveDate).toBe("no");
    expect(scenario.currentProgramEndDate).toBe("2030-05-15");
    expect(scenario.optStage).toBe("post_completion_not_filed");
    expect(scenario.optFilingDate).toBe("2027-02-10");
  });
});

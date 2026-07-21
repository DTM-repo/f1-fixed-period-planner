import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import { reportTopicsFor } from "./reportScope";

describe("advisor report scope", () => {
  it("keeps confirmed travel and OPT without adding unrelated hypotheticals", () => {
    const topics = reportTopicsFor({
      ...DEFAULT_SCENARIO,
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      optIntent: "yes"
    });

    expect(topics).toContain("stay_length");
    expect(topics).toContain("travel");
    expect(topics).toContain("opt");
    expect(topics).not.toContain("cpt");
    expect(topics).not.toContain("dependents");
    expect(topics).not.toContain("early_end");
  });

  it("includes an issue once the student chooses to explore it", () => {
    const topics = reportTopicsFor(DEFAULT_SCENARIO, ["opt"], ["school_transfer"]);

    expect(topics).toEqual(expect.arrayContaining(["stay_length", "opt", "school_transfer"]));
  });

  it("includes confirmed uncommon circumstances", () => {
    const topics = reportTopicsFor({
      ...DEFAULT_SCENARIO,
      hasF2Dependents: "yes",
      cptPlan: "planned",
      earlyEndSituation: "authorized_withdrawal"
    });

    expect(topics).toEqual(expect.arrayContaining(["dependents", "cpt", "early_end"]));
  });
});

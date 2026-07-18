import { describe, expect, it } from "vitest";
import { calculateScenario } from "./calculateScenario";
import type { StudentScenario } from "./types";

const baseTransitionScenario: StudentScenario = {
  startingPosition: "current_ds_inside_us",
  admissionBasis: "duration_of_status",
  inUsOnEffectiveDate: "yes",
  maintainingStatusOnEffectiveDate: "yes",
  programEndOnEffectiveDate: "2031-05-15",
  currentProgramEndDate: "2031-05-15",
  optStage: "none",
  travelPosture: "none",
  reentryBasis: "unknown",
  pendingExtensionOnDeparture: "no",
  transferOrProgramChange: "no",
  cptPlan: "none"
};

describe("calculateScenario", () => {
  it("caps a qualifying D/S transition student at four years plus the F-1 departure period", () => {
    const result = calculateScenario(baseTransitionScenario);

    expect(result.classification).toBe("transition_ds");
    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-11-14");
    expect(result.extensionNeededBy).toBe("2030-09-15");
    expect(result.appliedRules.map((rule) => rule.id)).toContain("transition-ds-cap");
  });

  it("uses the shorter of program length or four years for incoming fixed-period students", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      currentProgramEndDate: "2030-05-20"
    });

    expect(result.classification).toBe("incoming_fixed_period");
    expect(result.coverageEnd).toBe("2030-05-20");
    expect(result.latestDepartureDate).toBe("2030-07-19");
    expect(result.extensionNeededBy).toBeUndefined();
  });

  it("models a post-effective-date regular reentry as a new fixed-period clock", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      travelPosture: "planned",
      reentryDate: "2027-08-20",
      reentryBasis: "new_f1_admission"
    });

    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.findings.map((finding) => finding.id)).toContain("travel-may-reset-clock");
  });

  it("surfaces manual review when transition eligibility facts are unknown", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      inUsOnEffectiveDate: "unknown",
      maintainingStatusOnEffectiveDate: "unknown"
    });

    expect(result.status).toBe("manual");
    expect(result.classification).toBe("manual_review");
    expect(result.followUpQuestions.length).toBeGreaterThan(0);
  });

  it("flags transition OPT filings inside the March 18, 2027 window", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "post_completion_not_filed",
      optFilingDate: "2027-02-10"
    });

    expect(result.i765TransitionDeadline).toBe("2027-03-18");
    expect(result.findings.map((finding) => finding.id)).toContain("opt-filing-in-window");
  });
});

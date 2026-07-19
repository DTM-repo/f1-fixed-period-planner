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

function findingIds(result: ReturnType<typeof calculateScenario>) {
  return result.findings.map((finding) => finding.id);
}

describe("calculateScenario", () => {
  it("caps a qualifying D/S transition student at four years plus the F-1 departure period", () => {
    const result = calculateScenario(baseTransitionScenario);

    expect(result.classification).toBe("transition_ds");
    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-11-14");
    expect(result.departurePeriodDays).toBe(60);
    expect(result.extensionNeededBy).toBe("2030-09-15");
    expect(result.appliedRules.map((rule) => rule.id)).toContain("transition-ds-cap");
  });

  it("uses the shorter of program length or four years plus 30 days for incoming fixed-period students", () => {
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
    expect(result.latestDepartureDate).toBe("2030-06-19");
    expect(result.departurePeriodDays).toBe(30);
    expect(result.extensionNeededBy).toBeUndefined();
  });

  it("caps incoming fixed-period students at four years from admission plus 30 days", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      currentProgramEndDate: "2032-05-20"
    });

    expect(result.status).toBe("caution");
    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-10-15");
    expect(result.departurePeriodDays).toBe(30);
    expect(result.extensionNeededBy).toBe("2030-09-15");
    expect(findingIds(result)).toContain("fixed-extension-needed");
  });

  it("stops when a future-student answer contradicts an entry date before the rule starts", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      reentryDate: "2026-08-20",
      currentProgramEndDate: "2032-05-20"
    });

    expect(result.status).toBe("manual");
    expect(result.classification).toBe("manual_review");
    expect(result.coverageEnd).toBeUndefined();
    expect(findingIds(result)).toContain("future-entry-before-effective-date-contradiction");
  });

  it("uses an entered I-94 admit-until date for a fixed-period branch", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      reentryDate: "2027-01-10",
      currentProgramEndDate: "2032-05-20",
      i94AdmitUntilDate: "2029-12-31"
    });

    expect(result.classification).toBe("incoming_fixed_period");
    expect(result.coverageEnd).toBe("2029-12-31");
    expect(result.latestDepartureDate).toBe("2030-01-30");
    expect(result.extensionNeededBy).toBe("2029-12-31");
    expect(findingIds(result)).toContain("fixed-i94-date-provided");
  });

  it("uses an effective-date EAD end when it is later than the I-20 but before the transition cap", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2028-05-15",
      currentProgramEndDate: "2028-05-15",
      eadEndOnEffectiveDate: "2029-06-30"
    });

    expect(result.status).toBe("ok");
    expect(result.coverageEnd).toBe("2029-06-30");
    expect(result.latestDepartureDate).toBe("2029-08-29");
    expect(result.departurePeriodDays).toBe(60);
    expect(result.extensionNeededBy).toBeUndefined();
  });

  it("flags effective-date EAD coverage that runs beyond the four-year transition cap", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2028-05-15",
      currentProgramEndDate: "2028-05-15",
      eadEndOnEffectiveDate: "2032-01-15"
    });

    expect(result.status).toBe("caution");
    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-11-14");
    expect(result.extensionNeededBy).toBe("2030-09-15");
    expect(findingIds(result)).toContain("transition-extension-needed");
  });

  it("models a post-effective-date regular reentry as a new fixed-period clock", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      travelPosture: "planned",
      reentryDate: "2027-08-20",
      reentryBasis: "new_f1_admission"
    });

    expect(result.coverageEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-11-14");
    expect(findingIds(result)).toContain("travel-fixed-period-branch");
    expect(result.findings.find((finding) => finding.id === "travel-fixed-period-branch")?.detail).toContain("2031");
    expect(result.findings.find((finding) => finding.id === "travel-fixed-period-branch")?.detail).toContain("30-day");
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

  it("does not apply the old D/S transition path when the I-20/EAD date ends before the rule starts", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-05-31",
      currentProgramEndDate: "2026-05-31"
    });

    expect(result.status).toBe("manual");
    expect(result.classification).toBe("manual_review");
    expect(result.coverageEnd).toBeUndefined();
    expect(findingIds(result)).toContain("document-ends-before-effective-date");
    expect(result.followUpQuestions[0]).toContain("September 15, 2026");
  });

  it("normalizes month-name date input before calculating", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      currentProgramEndDate: "May 20, 2030"
    });

    expect(result.status).toBe("ok");
    expect(result.classification).toBe("incoming_fixed_period");
    expect(result.coverageEnd).toBe("2030-05-20");
    expect(result.latestDepartureDate).toBe("2030-06-19");
    expect(findingIds(result)).toContain("date-input-normalized");
  });

  it("keeps safe transition dates while asking about numeric date input", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2029-05-20",
      currentProgramEndDate: "03/04/2030"
    });

    expect(result.status).toBe("manual");
    expect(result.classification).toBe("transition_ds");
    expect(result.coverageEnd).toBe("2029-05-20");
    expect(result.latestDepartureDate).toBe("2029-07-19");
    expect(findingIds(result)).toContain("date-confirmation-needed");
    expect(findingIds(result)).toContain("target-program-end-needed");
    expect(result.followUpQuestions[0]).toContain("program end date");
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
    expect(findingIds(result)).toContain("opt-filing-in-window");
  });

  it("routes STEM OPT to manual review when the current OPT EAD end date is missing", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "stem_not_filed",
      optFilingDate: "2027-02-01"
    });

    expect(result.status).toBe("manual");
    expect(findingIds(result)).toContain("stem-current-ead-needed");
    expect(findingIds(result)).not.toContain("stem-filing-in-window");
  });

  it("flags STEM OPT filings after the current OPT EAD end date as risk", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "stem_not_filed",
      optFilingDate: "2027-02-01",
      currentEadEndDate: "2027-01-31"
    });

    expect(result.status).toBe("risk");
    expect(findingIds(result)).toContain("stem-filing-after-current-ead");
  });

  it("accepts STEM OPT transition timing only when both statutory dates fit", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "stem_not_filed",
      optFilingDate: "2027-02-01",
      currentEadEndDate: "2027-04-30"
    });

    expect(result.status).toBe("ok");
    expect(findingIds(result)).toContain("stem-filing-in-window");
  });

  it("does not treat approved OPT/STEM as calculable without an EAD end date", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "post_completion_approved"
    });

    expect(result.status).toBe("manual");
    expect(result.coverageEnd).toBe("2026-12-20");
    expect(result.latestDepartureDate).toBe("2027-02-18");
    expect(findingIds(result)).toContain("approved-opt-ead-needed");
    expect(result.findings.find((finding) => finding.id === "approved-opt-ead-needed")?.detail).toContain("If an approved OPT/STEM EAD expires after");
  });

  it("flags pending extension travel when return seeks a longer I-20 period", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      pendingExtensionOnDeparture: "yes",
      travelPosture: "planned",
      reentryDate: "2028-01-10",
      reentryBasis: "longer_program_i20"
    });

    expect(result.status).toBe("risk");
    expect(findingIds(result)).toContain("pending-extension-travel");
  });

  it("routes automatic visa revalidation to manual review", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      travelPosture: "automatic_visa_revalidation",
      reentryBasis: "automatic_visa_revalidation"
    });

    expect(result.status).toBe("manual");
    expect(findingIds(result)).toContain("automatic-visa-revalidation");
  });

  it("flags graduate school transfers and program changes", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      educationLevel: "graduate",
      schoolTransferPlan: "yes",
      academicProgramChangePlan: "yes",
      transferOrProgramChange: "yes"
    });

    expect(result.status).toBe("risk");
    expect(findingIds(result)).toContain("graduate-program-change-limit");
    expect(findingIds(result)).toContain("graduate-transfer-limit");
  });

  it("flags same-level or lower-level next programs", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      nextProgramLevelPlan: "same_or_lower"
    });

    expect(result.status).toBe("risk");
    expect(findingIds(result)).toContain("same-or-lower-next-program");
  });

  it("explains CPT extension timing instead of treating the CPT button as a no-op", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      cptPlan: "unknown"
    });

    expect(result.status).toBe("manual");
    expect(findingIds(result)).toContain("cpt-timing-needed");
    expect(result.findings.find((finding) => finding.id === "cpt-timing-needed")?.detail).toContain("Day One CPT");
  });

  it("gives fixed-period context while asking for OPT/STEM return facts", () => {
    const result = calculateScenario({
      ...baseTransitionScenario,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      currentProgramEndDate: "2027-08-20",
      optStage: "post_completion_pending",
      optFilingDate: "2027-02-01"
    });

    expect(result.status).toBe("manual");
    expect(result.classification).toBe("incoming_fixed_period");
    expect(result.coverageEnd).toBe("2027-08-20");
    expect(result.latestDepartureDate).toBe("2027-09-19");
    expect(findingIds(result)).toContain("fixed-opt-admission-needs-review");
    expect(result.findings.find((finding) => finding.id === "fixed-opt-admission-needs-review")?.detail).toContain("ordinary post-effective-date F-1 admission");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import { calculateScenario, scenarioForFixedReentry } from "../engine/calculateScenario";
import type { StudentScenario } from "../engine/types";
import { buildImpactMap } from "./impactMap";

function current(overrides: Partial<StudentScenario> = {}): StudentScenario {
  return {
    ...DEFAULT_SCENARIO,
    startingPosition: "current_ds_inside_us",
    admissionBasis: "duration_of_status",
    inUsOnEffectiveDate: "yes",
    maintainingStatusOnEffectiveDate: "yes",
    programStartDate: "2024-08-26",
    programEndOnEffectiveDate: "2028-05-22",
    currentProgramEndDate: "2028-05-22",
    educationLevel: "undergraduate",
    programType: "college_or_university",
    optIntent: "no",
    travelPosture: "none",
    schoolTransferPlan: "no",
    academicProgramChangePlan: "no",
    nextProgramLevelPlan: "not_planning",
    ...overrides
  };
}

function allText(scenario: StudentScenario, topics: Parameters<typeof buildImpactMap>[3] = []) {
  const stay = calculateScenario(scenario);
  const map = buildImpactMap(scenario, stay, null, topics);
  return { map, claims: [...map.focusClaims, ...map.otherClaims] };
}

describe("concise impact map", () => {
  it("states the main D/S result once and still includes every category that applies", () => {
    const { map, claims } = allText(current());
    expect(map.headline).toBe("You are under the old rules");
    expect(claims.map((claim) => claim.id)).toEqual(expect.arrayContaining([
      "travel-can-end-ds",
      "no-extension-for-current-program",
      "transition-departure-period",
      "undergraduate-transfer",
      "undergraduate-program-change",
      "later-program-level"
    ]));
    expect(claims.some((claim) => claim.title === map.headline)).toBe(false);
  });

  it("keeps ordinary claims within a tight word budget and removes duplicate IDs", () => {
    const { claims } = allText(current({ optIntent: "yes" }), ["opt"]);
    expect(new Set(claims.map((claim) => claim.id)).size).toBe(claims.length);
    for (const claim of claims) {
      expect(claim.title.trim().split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(claim.detail.trim().split(/\s+/).length).toBeLessThanOrEqual(48);
    }
    const copy = claims.map((claim) => `${claim.title} ${claim.detail}`).join(" ").toLowerCase();
    expect(copy).not.toMatch(/based on (?:your answers|the inputs)|the app|question(?:naire)?|close to filing|do not need to answer/);
  });

  it("flags the one-time OPT path only when the normal filing window opens in time", () => {
    const eligible = allText(current({
      programStartDate: "2023-08-28",
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optIntent: "yes"
    }), ["opt"]);
    expect(eligible.claims.map((claim) => claim.id)).toContain("opt-transition-window");

    const later = allText(current({ optIntent: "yes" }), ["opt"]);
    expect(later.claims.map((claim) => claim.id)).toContain("opt-window-after-exception");
  });

  it("does not tell a later graduate to preserve an OPT option that has already closed", () => {
    const scenario = current({
      optIntent: "yes",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2026-10-30",
      reentryBasis: "same_i20_balance",
      programStartDate: "2024-08-26"
    });
    const stay = calculateScenario(scenario);
    const travel = calculateScenario(scenarioForFixedReentry(scenario));
    const map = buildImpactMap(scenario, stay, travel, ["travel", "opt"]);
    const opt = [...map.focusClaims, ...map.otherClaims].find((claim) => claim.category === "opt");
    expect(opt?.id).toBe("opt-window-after-exception");
    expect(opt?.title).not.toMatch(/preserve/i);
  });

  it("makes the filing-before-travel fact control an eligible OPT travel result", () => {
    const base = current({
      programStartDate: "2023-08-28",
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optIntent: "yes",
      optStage: "post_completion_not_filed",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2026-10-30",
      reentryBasis: "same_i20_balance"
    });
    const optClaimId = (scenario: StudentScenario) => {
      const stay = calculateScenario(scenario);
      const travel = calculateScenario(scenarioForFixedReentry(scenario));
      const map = buildImpactMap(scenario, stay, travel, ["travel", "opt"]);
      return [...map.focusClaims, ...map.otherClaims].find((claim) => claim.category === "opt")?.id;
    };
    expect(optClaimId({ ...base, optFiledBeforeDeparture: "unknown" })).toBe("opt-order-before-travel");
    expect(optClaimId({ ...base, optFiledBeforeDeparture: "yes" })).toBe("opt-filed-before-travel");
    expect(optClaimId({ ...base, optFiledBeforeDeparture: "no" })).toBe("opt-travel-before-filing");
  });

  it("keeps a confirmed current D/S student on the transition path while the I-20 date is still missing", () => {
    const scenario = current({
      programStartDate: undefined,
      programEndOnEffectiveDate: undefined,
      currentProgramEndDate: undefined,
      optIntent: "yes"
    });
    const { map, claims } = allText(scenario, ["opt"]);
    expect(map.headline).toBe("You are under the old rules");
    expect(claims.map((claim) => claim.id)).toContain("opt-transition-general");
    expect(claims.map((claim) => claim.id)).not.toContain("opt-fixed-period");
  });

  it("puts an I-20 date conflict ahead of the provisional old-rules message", () => {
    const { map, claims } = allText(current({
      programEndOnEffectiveDate: "2026-05-20",
      currentProgramEndDate: "2026-05-20"
    }));
    expect(map.headline).toBe("These dates do not fit yet");
    expect(map.summary).toContain("approved OPT or STEM OPT EAD");
    expect(map.summary).not.toContain("under the old rules");
    expect(claims).toEqual([]);
  });

  it("shows both effects of travel when a longer program needs more time", () => {
    const scenario = current({
      programEndOnEffectiveDate: "2032-05-22",
      currentProgramEndDate: "2032-05-22",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2029-08-20",
      reentryBasis: "longer_program_i20",
      returnProgramStartDate: "2029-08-25",
      returnProgramEndDate: "2032-05-22"
    });
    const stay = calculateScenario(scenario);
    const travel = calculateScenario(scenarioForFixedReentry(scenario));
    const map = buildImpactMap(scenario, stay, travel, ["travel", "extension"]);
    const ids = [...map.focusClaims, ...map.otherClaims].map((claim) => claim.id);
    expect(map.headline).toBe("Travel triggers the new rules");
    expect(ids).toContain("travel-stay-alternative");
    expect(ids).toContain("travel-may-avoid-i539");
    expect(ids).toContain("stay-route-needs-extension");
    expect(ids).not.toContain("more-time-needed");
  });

  it("shows the travel trigger before the return I-20 is known", () => {
    const scenario = current({
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryBasis: "unknown"
    });
    const stay = calculateScenario(scenario);
    const map = buildImpactMap(scenario, stay, null, ["travel"]);
    const claims = [...map.focusClaims, ...map.otherClaims];

    expect(map.headline).toBe("Travel triggers the new rules");
    expect(claims.map((claim) => claim.id)).toContain("travel-trigger-confirmed");
  });

  it("does not claim that a return avoids Form I-539 when the projected admission still ends early", () => {
    const scenario = current({
      programEndOnEffectiveDate: "2032-05-22",
      currentProgramEndDate: "2032-05-22",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2027-01-10",
      reentryBasis: "same_i20_balance"
    });
    const stay = calculateScenario(scenario);
    const travel = calculateScenario(scenarioForFixedReentry(scenario));
    const map = buildImpactMap(scenario, stay, travel, ["travel", "extension"]);
    const ids = [...map.focusClaims, ...map.otherClaims].map((claim) => claim.id);
    expect(ids).not.toContain("travel-may-avoid-i539");
    expect(ids).toContain("travel-is-extension-alternative");
    expect(ids).toContain("more-time-needed");
  });

  it("states the graduate restrictions directly for a fixed-period student", () => {
    const scenario: StudentScenario = {
      ...DEFAULT_SCENARIO,
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      programStartDate: "2026-12-31",
      currentProgramEndDate: "2032-05-31",
      educationLevel: "graduate",
      programType: "college_or_university"
    };
    const result = calculateScenario(scenario);
    const map = buildImpactMap(scenario, result, null, []);
    const claims = [...map.focusClaims, ...map.otherClaims];
    expect(claims.find((claim) => claim.id === "graduate-transfer")?.title).toContain("requires an SEVP exception");
    expect(claims.find((claim) => claim.id === "graduate-program-change")?.title).toContain("cannot change");
  });

  it("does not claim that the new rule eliminates Day 1 CPT", () => {
    const { claims } = allText(current({ cptPlan: "planned" }), ["cpt"]);
    expect(claims.find((claim) => claim.category === "cpt")?.title).toBe("This rule does not eliminate Day 1 CPT");
  });

  it("does not introduce CPT when a long program alone creates an extension issue", () => {
    const { claims } = allText(current({
      programEndOnEffectiveDate: "2032-05-22",
      currentProgramEndDate: "2032-05-22",
      cptPlan: "none"
    }));
    expect(claims.some((claim) => claim.category === "cpt")).toBe(false);
  });

  it("describes CPT without telling a student to file early unless CPT is planned", () => {
    const { claims } = allText(current({
      programEndOnEffectiveDate: "2032-05-22",
      currentProgramEndDate: "2032-05-22",
      cptPlan: "none"
    }), ["cpt"]);
    const cpt = claims.find((claim) => claim.category === "cpt");
    expect(cpt?.title).toBe("This rule does not eliminate Day 1 CPT");
    expect(cpt?.detail).not.toMatch(/file early/i);
  });

  it("personalizes first-year limits after an undergraduate has completed that year", () => {
    const { claims } = allText(current({ firstAcademicYearCompleted: "yes" }));
    expect(claims.find((claim) => claim.id === "undergraduate-transfer")?.title).toBe(
      "The new first-year transfer limit is behind you"
    );
    expect(claims.find((claim) => claim.id === "undergraduate-program-change")?.title).toBe(
      "The new first-year program limit is behind you"
    );
  });

  it("links each extension-process fact to its own supporting source", () => {
    const { claims } = allText(current({
      programEndOnEffectiveDate: "2032-05-22",
      currentProgramEndDate: "2032-05-22"
    }), ["extension"]);
    expect(claims.find((claim) => claim.id === "extension-fee")?.sourceIds).toEqual(["USCIS-G1055-I539"]);
    expect(claims.find((claim) => claim.id === "extension-biometrics")?.sourceIds).toEqual(["FR-F1-EXTENSION-PROCESS"]);
    expect(claims.find((claim) => claim.id === "extension-premium")?.sourceIds).toEqual(["FR-I539-PREMIUM"]);
  });

  it("uses every concern in a completed-program, approved-OPT, later-program case", () => {
    const scenario: StudentScenario = {
      ...DEFAULT_SCENARIO,
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      optIntent: "yes",
      optStage: "post_completion_approved",
      currentProgramEndDateHint: "2026-05",
      currentEadEndDateHint: "2027-06",
      educationLevel: "graduate",
      programType: "college_or_university",
      nextProgramLevelPlan: "same_or_lower",
      pendingEmploymentImmigrantPetition: "yes"
    };
    const result = calculateScenario(scenario);
    const map = buildImpactMap(scenario, result, null, [
      "opt",
      "extension",
      "school_transfer",
      "program_change",
      "later_program",
      "immigrant_intent",
      "school_filing_support"
    ]);
    const claims = [...map.focusClaims, ...map.otherClaims];
    const ids = claims.map((claim) => claim.id);

    expect(map.headline).toBe("You are under the old rules");
    expect(map.summary).toContain("June 2027");
    expect(ids).toEqual(expect.arrayContaining([
      "opt-approved-partial-date",
      "later-program-extension-date-needed",
      "completed-graduate-transfer",
      "completed-graduate-change",
      "later-program-pre-rule-completion",
      "opt-to-later-program-timing",
      "pending-immigrant-petition",
      "school-i539-support"
    ]));
    expect(ids).not.toContain("graduate-transfer");
    expect(ids).not.toContain("graduate-program-change");
    expect(claims.find((claim) => claim.id === "later-program-pre-rule-completion")?.detail).toContain("do not need an SEVP exception");
  });
});

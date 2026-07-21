import { describe, expect, it } from "vitest";
import { calculateScenario, scenarioForFixedReentry } from "./calculateScenario";
import type { StudentScenario } from "./types";

const transition: StudentScenario = {
  startingPosition: "current_ds_inside_us",
  admissionBasis: "duration_of_status",
  inUsOnEffectiveDate: "yes",
  maintainingStatusOnEffectiveDate: "yes",
  programEndOnEffectiveDate: "2031-05-15",
  currentProgramEndDate: "2031-05-15",
  optIntent: "no",
  optStage: "none",
  travelPosture: "none",
  reentryBasis: "unknown",
  pendingExtensionOnDeparture: "no",
  transferOrProgramChange: "no",
  schoolTransferPlan: "no",
  academicProgramChangePlan: "no",
  educationLevel: "other",
  programType: "college_or_university",
  nextProgramLevelPlan: "not_planning",
  cptPlan: "none"
};

const incoming: StudentScenario = {
  ...transition,
  startingPosition: "prospective_outside_us",
  admissionBasis: "fixed_period",
  inUsOnEffectiveDate: "no",
  maintainingStatusOnEffectiveDate: "unknown",
  reentryDate: "2026-12-31",
  programStartDate: "2026-09-01",
  currentProgramEndDate: "2032-05-31",
  programEndOnEffectiveDate: undefined
};

function ids(result: ReturnType<typeof calculateScenario>) {
  return result.findings.map((item) => item.id);
}

function studentFacingCopy(result: ReturnType<typeof calculateScenario>) {
  return [
    result.headline,
    result.summary,
    ...result.findings.flatMap((item) => [item.title, item.detail]),
    ...result.timeline.flatMap((item) => [item.title, item.detail])
  ].join(" ");
}

describe("D/S transition", () => {
  it("caps current-student protection at September 15, 2030 plus 60 days", () => {
    const result = calculateScenario(transition);
    expect(result.classification).toBe("transition_ds");
    expect(result.activityEnd).toBe("2030-09-15");
    expect(result.latestDepartureDate).toBe("2030-11-14");
    expect(result.departurePeriodDays).toBe(60);
    expect(result.extensionPlanningDate).toBe("2030-09-15");
    expect(result.findings.find((item) => item.id === "transition-extension-needed")?.detail).toContain("departure and readmission");
    expect(result.findings.find((item) => item.id === "transition-extension-needed")?.detail).toContain("does not automatically add four years");
  });

  it("uses an earlier active I-20 end date and then adds 60 days", () => {
    const result = calculateScenario({ ...transition, programEndOnEffectiveDate: "2028-05-20", currentProgramEndDate: "2028-05-20" });
    expect(result.activityEnd).toBe("2028-05-20");
    expect(result.latestDepartureDate).toBe("2028-07-19");
    expect(result.status).toBe("ok");
    expect(result.headline).toBe("You are under the old rules");
    expect(result.summary).toContain("60 days after your program ends");
    expect(result.findings.find((item) => item.id === "transition-covers-current-plan")?.detail).toBe(
      "Your I-20 program ends on May 20, 2028, within your old-rule protection. You do not need Form I-539 just to finish this program."
    );
  });

  it("immediately tells a qualifying current student that the old rules continue even before a document date is entered", () => {
    const result = calculateScenario({ ...transition, programEndOnEffectiveDate: undefined, currentProgramEndDate: undefined });
    expect(result.classification).toBe("manual_review");
    expect(result.headline).toContain("remain under the old rules");
    expect(result.followUpQuestions.join(" ")).toContain("program end date");
  });

  it("uses the later effective-date EAD and caps it at four years", () => {
    const result = calculateScenario({
      ...transition,
      programEndOnEffectiveDate: "2028-05-20",
      currentProgramEndDate: "2028-05-20",
      eadEndOnEffectiveDate: "2032-01-15"
    });
    expect(result.activityEnd).toBe("2030-09-15");
    expect(result.status).toBe("caution");
    expect(ids(result)).toContain("transition-extension-needed");
  });

  it("keeps a safe transition result while asking the user to clarify an ambiguous numeric date", () => {
    const result = calculateScenario({ ...transition, programEndOnEffectiveDate: "2029-05-20", currentProgramEndDate: "03/04/2030" });
    expect(result.activityEnd).toBe("2029-05-20");
    expect(result.latestDepartureDate).toBe("2029-07-19");
    expect(result.status).toBe("manual");
    expect(ids(result)).toContain("date-confirmation-needed");
  });
});

describe("fixed-period dates", () => {
  it("measures the normal four-year maximum from the I-20 program start date, not entry", () => {
    const result = calculateScenario(incoming);
    expect(result.classification).toBe("incoming_fixed_period");
    expect(result.activityEnd).toBe("2030-09-01");
    expect(result.i94AdmitUntilDate).toBe("2030-10-01");
    expect(result.latestDepartureDate).toBe("2030-10-01");
    expect(result.activityEnd).not.toBe("2030-12-31");
  });

  it("uses the program end when it is earlier than the four-year maximum", () => {
    const result = calculateScenario({ ...incoming, currentProgramEndDate: "2029-05-20" });
    expect(result.activityEnd).toBe("2029-05-20");
    expect(result.i94AdmitUntilDate).toBe("2029-06-19");
    expect(result.extensionFilingDeadline).toBeUndefined();
  });

  it("does not add another 30 days to an actual I-94 date", () => {
    const result = calculateScenario({ ...incoming, i94AdmitUntilDate: "2029-12-31" });
    expect(result.activityEnd).toBe("2029-12-01");
    expect(result.i94AdmitUntilDate).toBe("2029-12-31");
    expect(result.latestDepartureDate).toBe("2029-12-31");
    expect(result.extensionFilingDeadline).toBe("2029-12-31");
    expect(ids(result)).toContain("actual-i94-controls");
  });

  it("separates the recommended planning date from the last timely I-539 receipt date", () => {
    const result = calculateScenario(incoming);
    expect(result.extensionPlanningDate).toBe("2030-09-01");
    expect(result.extensionFilingDeadline).toBe("2030-10-01");
    expect(result.findings.find((item) => item.id === "fixed-extension-needed")?.detail).toContain("USCIS must receive");
    expect(result.findings.find((item) => item.id === "fixed-extension-needed")?.detail).toContain("departure and readmission");
  });

  it("asks for the program start date instead of inventing a four-year date", () => {
    const result = calculateScenario({ ...incoming, programStartDate: undefined });
    expect(result.activityEnd).toBeUndefined();
    expect(result.i94AdmitUntilDate).toBeUndefined();
    expect(result.status).toBe("manual");
    expect(result.followUpQuestions.join(" ")).toContain("program start date");
  });

  it("normalizes a month-name program start date", () => {
    const result = calculateScenario({ ...incoming, programStartDate: "September 1, 2026" });
    expect(result.activityEnd).toBe("2030-09-01");
    expect(ids(result)).toContain("date-input-normalized");
  });

  it("flags entry more than 30 days before the I-20 start date", () => {
    const result = calculateScenario({ ...incoming, reentryDate: "2026-09-16", programStartDate: "2026-11-01" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("entry-more-than-thirty-days-early");
  });

  it("uses a 24-month maximum for English-language training", () => {
    const result = calculateScenario({ ...incoming, programType: "english_language_training" });
    expect(result.activityEnd).toBe("2028-09-01");
    expect(result.i94AdmitUntilDate).toBe("2028-10-01");
    expect(ids(result)).toContain("elt-two-year-limit");
  });

  it("uses a 12-month aggregate maximum for public high school", () => {
    const result = calculateScenario({ ...incoming, programType: "public_high_school" });
    expect(result.activityEnd).toBe("2027-09-01");
    expect(result.i94AdmitUntilDate).toBe("2027-10-01");
    expect(ids(result)).toContain("public-high-school-limit");
  });

  it("classifies an in-country change to F-1 as fixed period", () => {
    const result = calculateScenario({ ...incoming, startingPosition: "change_status_inside_us", reentryDate: undefined });
    expect(result.classification).toBe("change_of_status_fixed_period");
    expect(result.i94AdmitUntilDate).toBe("2030-10-01");
  });
});

describe("contradictions and travel", () => {
  it("stops for clarification when a no-on-September-15 answer conflicts with an earlier entry date", () => {
    const result = calculateScenario({ ...incoming, reentryDate: "2026-08-20", departBeforeEffectiveDate: "unknown" });
    expect(result.classification).toBe("manual_review");
    expect(result.activityEnd).toBeUndefined();
    expect(ids(result)).toContain("future-entry-before-effective-date-contradiction");
  });

  it("asks for the later return after the user confirms a pre-rule departure", () => {
    const result = calculateScenario({ ...incoming, reentryDate: "2026-08-20", departBeforeEffectiveDate: "yes" });
    expect(result.classification).toBe("manual_review");
    expect(ids(result)).toContain("post-rule-return-date-needed");
  });

  it("stops when a current student labels a pre-rule date as a post-rule return", () => {
    const result = calculateScenario({
      ...transition,
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2026-01-10"
    });
    expect(result.classification).toBe("manual_review");
    expect(ids(result)).toContain("return-date-before-effective-date-contradiction");
    expect(result.headline).toBe("Correct the return date");
  });

  it("does not claim that a return creates a new four-year clock from the return date", () => {
    const result = calculateScenario({
      ...transition,
      programStartDate: "2025-08-25",
      travelPosture: "planned",
      returningAfterEffectiveDate: "yes",
      reentryDate: "2027-08-20"
    });
    const travelFinding = result.findings.find((item) => item.id === "travel-ends-ds-branch");
    expect(travelFinding?.detail).toContain("I-20 program dates");
    expect(travelFinding?.detail).not.toContain("four years from");
  });

  it("reuses the existing I-20 end date for a same-I-20 return", () => {
    const reentry = scenarioForFixedReentry({
      ...transition,
      programStartDate: "2025-08-25",
      currentProgramEndDate: "2028-05-20",
      reentryBasis: "same_i20_balance",
      reentryDate: "2027-08-20"
    });
    expect(reentry.programStartDate).toBe("2025-08-25");
    expect(reentry.currentProgramEndDate).toBe("2028-05-20");
  });

  it("uses a new I-20's dates for a different-I-20 return", () => {
    const reentry = scenarioForFixedReentry({
      ...transition,
      programStartDate: "2023-08-25",
      currentProgramEndDate: "2027-05-20",
      reentryBasis: "longer_program_i20",
      returnProgramStartDate: "2027-08-25",
      returnProgramEndDate: "2032-05-20"
    });
    expect(reentry.programStartDate).toBe("2027-08-25");
    expect(reentry.currentProgramEndDate).toBe("2032-05-20");
  });

  it("flags a return after the I-20 can support admission", () => {
    const result = calculateScenario({
      ...incoming,
      startingPosition: "readmitted_fixed_period",
      reentryDate: "2032-01-15",
      programStartDate: "2025-08-25",
      currentProgramEndDate: "2032-05-20"
    });
    expect(ids(result)).toContain("entry-after-authorized-study-end");
    expect(result.status).toBe("risk");
  });

  it("flags a pending I-539 return that seeks a longer period", () => {
    const result = calculateScenario({ ...transition, travelPosture: "planned", pendingExtensionOnDeparture: "yes", reentryBasis: "longer_program_i20" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("pending-extension-travel");
  });

  it("routes automatic visa revalidation to confirmation rather than an ordinary projection", () => {
    const result = calculateScenario({ ...transition, travelPosture: "automatic_visa_revalidation", reentryBasis: "automatic_visa_revalidation" });
    expect(result.status).toBe("manual");
    expect(ids(result)).toContain("automatic-visa-revalidation");
  });

  it("flags travel while a change-of-status application is pending", () => {
    const result = calculateScenario({ ...incoming, startingPosition: "change_status_inside_us", travelPosture: "planned" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("pending-change-status-travel");
  });
});

describe("OPT and STEM OPT transition", () => {
  const optBase: StudentScenario = {
    ...transition,
    programEndOnEffectiveDate: "2026-12-20",
    currentProgramEndDate: "2026-12-20",
    optIntent: "yes",
    dsoRecommendedOpt: "yes"
  };

  it("explains a future OPT plan without pretending STEM OPT is the first choice", () => {
    const result = calculateScenario({ ...incoming, optIntent: "yes", optStage: "none" });
    const finding = result.findings.find((item) => item.id === "future-opt-plan");
    expect(finding?.title).toContain("regular post-completion OPT");
    expect(finding?.detail).toBe("STEM OPT, if you qualify later, is a 24-month extension after regular post-completion OPT.");
    expect(finding?.detail).not.toMatch(/question|answer|DSO recommendation|Form I-765/i);
    expect(ids(result)).not.toContain("opt-dso-recommendation-needed");
  });

  it("accepts a qualifying post-completion OPT filing inside both deadlines", () => {
    const result = calculateScenario({ ...optBase, optStage: "post_completion_not_filed", optFilingDate: "2027-02-10" });
    expect(result.status).toBe("ok");
    expect(ids(result)).toContain("opt-filing-in-window");
  });

  it("puts a spring graduate's key OPT dates on the visual timeline", () => {
    const result = calculateScenario({
      ...optBase,
      programEndOnEffectiveDate: "2027-05-20",
      currentProgramEndDate: "2027-05-20",
      optStage: "post_completion_not_filed",
      optFilingDate: undefined
    });
    expect(result.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-02-19", title: "Post-completion OPT filing window opens" }),
      expect.objectContaining({ date: "2027-03-18", title: "Deadline to avoid Form I-539 for OPT" }),
      expect.objectContaining({ date: "2027-05-20", title: "Your old-rule study period ends" }),
      expect.objectContaining({ date: "2027-07-19", title: "Your 60-day period ends" })
    ]));
  });

  it("shows when the one-time deadline closes before a later OPT window opens", () => {
    const result = calculateScenario({
      ...optBase,
      programEndOnEffectiveDate: "2028-05-20",
      currentProgramEndDate: "2028-05-20",
      optStage: "post_completion_not_filed",
      optFilingDate: undefined
    });
    expect(result.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: "2027-03-18", title: "Form I-539 exception closes", tone: "warning" }),
      expect.objectContaining({ date: "2028-02-20", title: "Post-completion OPT filing window opens" })
    ]));
  });

  it("rejects a planned filing before the normal OPT window opens", () => {
    const result = calculateScenario({
      ...optBase,
      programEndOnEffectiveDate: "2027-05-20",
      currentProgramEndDate: "2027-05-20",
      optStage: "post_completion_not_filed",
      optFilingDate: "2027-02-01"
    });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("opt-before-normal-window");
    expect(result.timeline).toContainEqual(expect.objectContaining({
      date: "2027-02-01",
      title: "Planned Form I-765 filing",
      tone: "danger"
    }));
  });

  it("rejects the temporary rule after March 18, 2027", () => {
    const result = calculateScenario({ ...optBase, optStage: "post_completion_not_filed", optFilingDate: "2027-03-19" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("opt-after-march-deadline");
  });

  it("rejects post-completion OPT filed after the transition departure period", () => {
    const result = calculateScenario({ ...optBase, programEndOnEffectiveDate: "2026-09-16", currentProgramEndDate: "2026-09-16", optStage: "post_completion_not_filed", optFilingDate: "2026-12-01" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("opt-after-status-deadline");
  });

  it("requires the current EAD end date for STEM OPT", () => {
    const result = calculateScenario({ ...optBase, optStage: "stem_not_filed", optFilingDate: "2027-02-01" });
    expect(result.status).toBe("manual");
    expect(ids(result)).toContain("stem-current-ead-needed");
  });

  it("rejects STEM OPT filed after the current EAD ends", () => {
    const result = calculateScenario({ ...optBase, optStage: "stem_not_filed", optFilingDate: "2027-02-01", currentEadEndDate: "2027-01-31" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("stem-after-ead");
  });

  it("uses an approved transition EAD end plus 60 days", () => {
    const result = calculateScenario({ ...optBase, optStage: "post_completion_approved", currentEadEndDate: "2027-12-31" });
    expect(result.activityEnd).toBe("2027-12-31");
    expect(result.latestDepartureDate).toBe("2028-02-29");
    expect(ids(result)).toContain("approved-opt-through-ead");
  });

  it("keeps the known I-20 timeline and asks for a missing approved EAD end", () => {
    const result = calculateScenario({ ...optBase, optStage: "post_completion_approved" });
    expect(result.activityEnd).toBe("2026-12-20");
    expect(result.latestDepartureDate).toBe("2027-02-18");
    expect(result.status).toBe("manual");
    expect(ids(result)).toContain("approved-opt-ead-needed");
  });
});

describe("school, work, and unusual facts", () => {
  it("states the graduate program-change ban and transfer exception separately", () => {
    const result = calculateScenario({ ...transition, educationLevel: "graduate", schoolTransferPlan: "yes", academicProgramChangePlan: "yes", transferOrProgramChange: "yes" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("graduate-objective-limit");
    expect(ids(result)).toContain("graduate-transfer-limit");
  });

  it("blocks an undergraduate change during the first academic year", () => {
    const result = calculateScenario({ ...transition, educationLevel: "undergraduate", schoolTransferPlan: "yes", firstAcademicYearCompleted: "no", transferOrProgramChange: "yes" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("undergraduate-first-year-block");
  });

  it("scopes the general first-year rule to undergraduate students", () => {
    const result = calculateScenario({ ...incoming, educationLevel: "undergraduate", schoolTransferPlan: "no", academicProgramChangePlan: "no" });
    expect(result.findings.find((item) => item.id === "undergraduate-first-year-rule")?.detail).toContain("As an undergraduate student");
  });

  it("does not apply the first-year block after one academic year", () => {
    const result = calculateScenario({ ...transition, educationLevel: "undergraduate", schoolTransferPlan: "yes", firstAcademicYearCompleted: "yes", transferOrProgramChange: "yes" });
    expect(ids(result)).toContain("undergraduate-first-year-complete");
    expect(ids(result)).not.toContain("undergraduate-first-year-block");
  });

  it("blocks a later same-level program after a post-rule completion", () => {
    const result = calculateScenario({ ...transition, nextProgramLevelPlan: "same_or_lower" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("same-or-lower-next-program");
  });

  it("gives the early filing deadline when an I-94 limit can interrupt CPT", () => {
    const result = calculateScenario({ ...incoming, cptPlan: "planned" });
    expect(ids(result)).toContain("cpt-extension-filing-deadline");
    expect(result.findings.find((item) => item.id === "cpt-extension-filing-deadline")?.title).toContain("Sep 1, 2030");
    expect(result.findings.find((item) => item.id === "cpt-extension-filing-deadline")?.detail).toContain("240 days");
  });

  it("does not suggest that CPT can continue after the I-20 program ends", () => {
    const result = calculateScenario({
      ...transition,
      programEndOnEffectiveDate: "2028-05-22",
      currentProgramEndDate: "2028-05-22",
      cptPlan: "planned"
    });
    expect(ids(result)).toContain("cpt-within-program");
    expect(ids(result)).not.toContain("cpt-extension-filing-deadline");
    expect(result.findings.find((item) => item.id === "cpt-within-program")?.detail).toContain("cannot continue past your I-20 program end date");
  });

  it("keeps unknown CPT conditional instead of inventing a filing plan", () => {
    const result = calculateScenario({ ...incoming, cptPlan: "unknown" });
    expect(ids(result)).toContain("cpt-plan-needed");
    expect(ids(result)).not.toContain("cpt-extension-filing-deadline");
  });

  it("includes F-2 dependents in an extension strategy", () => {
    const result = calculateScenario({ ...incoming, hasF2Dependents: "yes" });
    expect(ids(result)).toContain("f2-dependent-period");
  });

  it("uses 30 days after actual early completion", () => {
    const result = calculateScenario({ ...incoming, earlyEndSituation: "completed_early", earlyEndDate: "2028-05-01" });
    expect(ids(result)).toContain("completed-early");
    expect(result.timeline.some((item) => item.date === "2028-05-31")).toBe(true);
  });

  it("uses 15 days after an authorized withdrawal", () => {
    const result = calculateScenario({ ...incoming, earlyEndSituation: "authorized_withdrawal", earlyEndDate: "2028-05-01" });
    expect(ids(result)).toContain("authorized-withdrawal");
    expect(result.timeline.some((item) => item.date === "2028-05-16")).toBe(true);
  });

  it("gives no departure period after a status violation", () => {
    const result = calculateScenario({ ...incoming, earlyEndSituation: "status_violation", earlyEndDate: "2028-05-01" });
    expect(result.status).toBe("risk");
    expect(ids(result)).toContain("status-violation");
  });

  it("includes extension process details and current fee sources only when an extension is shown", () => {
    const result = calculateScenario(incoming);
    expect(ids(result)).toContain("extension-process-details");
    expect(result.citations.map((item) => item.id)).toContain("USCIS-G1055-I539");

    const short = calculateScenario({ ...incoming, currentProgramEndDate: "2029-05-20" });
    expect(ids(short)).not.toContain("extension-process-details");
  });
});

describe("student-facing language", () => {
  it("does not narrate the questionnaire or calculation process", () => {
    const results = [
      calculateScenario(transition),
      calculateScenario(incoming),
      calculateScenario({ ...incoming, optIntent: "yes", optStage: "none" }),
      calculateScenario({ ...transition, optIntent: "yes", optStage: "post_completion_approved" }),
      calculateScenario({ ...incoming, i94AdmitUntilDate: "2029-12-31" }),
      calculateScenario({
        ...incoming,
        reentryDate: "2026-08-20",
        departBeforeEffectiveDate: "unknown"
      })
    ];
    const metaLanguage = /\b(?:(?:the|this) (?:app|calculator)|based on (?:your )?(?:answers|inputs)|your (?:answers|inputs)|you (?:said|entered)|questions? (?:asked|skipped)|do not need to answer|facts already provided|timeline shown|result (?:below|will|shows))\b/i;

    for (const result of results) {
      expect(studentFacingCopy(result)).not.toMatch(metaLanguage);
    }
  });
});

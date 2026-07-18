import { SOURCE_INDEX, source } from "../sources/sourceIndex";
import { addDays, addYears, formatDate, isAfter, isOnOrBefore, maxDate, minDate } from "./dateMath";
import type { AppliedRule, Finding, PlannerResult, StudentScenario, TimelineItem } from "./types";

export const DEFAULT_EFFECTIVE_DATE = "2026-09-15";
export const F1_DEPARTURE_PERIOD_DAYS = 60;
export const OPT_TRANSITION_I765_DEADLINE = "2027-03-18";

const TRANSITION_RULE: AppliedRule = {
  id: "transition-ds-cap",
  label: "D/S transition cap",
  summary:
    "A qualifying F-1 student admitted for duration of status on the effective date keeps the later of the I-20 program end or EAD end date, capped at four years from the effective date, plus the F-1 departure period.",
  sourceIds: ["8CFR-214-1-M1"]
};

const FIXED_ADMISSION_RULE: AppliedRule = {
  id: "fixed-admission-period",
  label: "Fixed F-1 admission period",
  summary:
    "A new or returning F-1 admission after the effective date is limited to the program length shown on the Form I-20 or four years, whichever is shorter, plus the F-1 departure period.",
  sourceIds: ["8CFR-214-1-A4"]
};

const OPT_TRANSITION_RULE: AppliedRule = {
  id: "transition-opt-filing",
  label: "Transition OPT filing treatment",
  summary:
    "Certain transition-cohort post-completion OPT and STEM OPT I-765 filings made on or before March 18, 2027 are not paired with an I-539 solely because the D/S rule changed.",
  sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
};

const PENDING_EOS_TRAVEL_RULE: AppliedRule = {
  id: "pending-eos-travel",
  label: "Pending extension and travel",
  summary:
    "Travel while an extension request is pending turns on whether the student seeks the balance of the prior admission period or a longer admission on return.",
  sourceIds: ["8CFR-214-1-C8"]
};

function uniqueSources(rules: AppliedRule[], findings: Finding[]) {
  const ids = new Set<string>(["FR-2026-FINAL-RULE"]);
  for (const rule of rules) {
    rule.sourceIds.forEach((id) => ids.add(id));
  }
  for (const finding of findings) {
    finding.sourceIds.forEach((id) => ids.add(id));
  }
  return [...ids].map((id) => SOURCE_INDEX[id]).filter(Boolean);
}

function findMissingTransitionFacts(scenario: StudentScenario): string[] {
  const missing: string[] = [];
  if (scenario.inUsOnEffectiveDate === "unknown") {
    missing.push("Will the student be in the United States on September 15, 2026?");
  }
  if (scenario.maintainingStatusOnEffectiveDate === "unknown") {
    missing.push("Will the student be properly maintaining F-1 status on September 15, 2026?");
  }
  if (scenario.admissionBasis === "unknown") {
    missing.push("Will the student's I-94 still show D/S, or will they already have a fixed admit-until date?");
  }
  if (!scenario.programEndOnEffectiveDate && scenario.startingPosition !== "prospective_outside_us") {
    missing.push("What program end date will be on the active I-20 on September 15, 2026?");
  }
  if (!scenario.currentProgramEndDate) {
    missing.push("What is the longest program end date the student wants to test?");
  }
  return missing;
}

function finding(
  id: string,
  tone: Finding["tone"],
  title: string,
  detail: string,
  sourceIds: string[]
): Finding {
  return { id, tone, title, detail, sourceIds };
}

function timeline(
  date: string,
  title: string,
  detail: string,
  tone: TimelineItem["tone"] = "neutral"
): TimelineItem {
  return { date, title, detail, tone };
}

function baseResult(
  scenario: StudentScenario,
  status: PlannerResult["status"],
  classification: PlannerResult["classification"],
  headline: string,
  summary: string,
  appliedRules: AppliedRule[],
  findings: Finding[],
  timelineItems: TimelineItem[],
  followUpQuestions: string[],
  nextActions: string[]
): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  return {
    deterministic: true,
    classification,
    status,
    headline,
    summary,
    effectiveDate,
    transitionCapDate: addYears(effectiveDate, 4),
    appliedRules,
    findings,
    timeline: timelineItems,
    followUpQuestions,
    nextActions,
    citations: uniqueSources(appliedRules, findings)
  };
}

function computeTransitionCoverage(scenario: StudentScenario) {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  const cap = addYears(effectiveDate, 4);
  const documentEnd = maxDate(scenario.programEndOnEffectiveDate, scenario.eadEndOnEffectiveDate);
  if (!documentEnd) {
    return undefined;
  }
  return minDate(documentEnd, cap);
}

function addOptFindings(scenario: StudentScenario, findings: Finding[], nextActions: string[]) {
  const optTransitionStages = new Set([
    "post_completion_not_filed",
    "post_completion_pending",
    "post_completion_approved",
    "stem_not_filed",
    "stem_pending",
    "stem_approved"
  ]);

  if (!optTransitionStages.has(scenario.optStage)) {
    return;
  }

  if (scenario.optFilingDate && isOnOrBefore(scenario.optFilingDate, OPT_TRANSITION_I765_DEADLINE)) {
    findings.push(
      finding(
        "opt-filing-in-window",
        "good",
        "OPT filing date falls inside the transition window",
        `The tested I-765 filing date (${formatDate(
          scenario.optFilingDate
        )}) is on or before ${formatDate(OPT_TRANSITION_I765_DEADLINE)}.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
  } else if (scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-filing-needed",
        "warning",
        "OPT timing needs its own check",
        `For transition-cohort post-completion OPT/STEM OPT, the rule creates a special I-765 path through ${formatDate(
          OPT_TRANSITION_I765_DEADLINE
        )}. A later or post-travel filing may require a different extension strategy.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Confirm the planned I-765 filing date before relying on the transition OPT treatment.");
  }

  if (scenario.travelPosture !== "none" && scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-travel-before-filing",
        "danger",
        "Travel before filing OPT changes the analysis",
        "The transition rule distinguishes students who depart before filing OPT/STEM OPT and then return under fixed-period admission. That branch should be reviewed before travel.",
        ["8CFR-214-1-M1-OPT"]
      )
    );
  }
}

function addTransferAndCptFindings(scenario: StudentScenario, coverageEnd: string | undefined, findings: Finding[], nextActions: string[]) {
  if (scenario.transferOrProgramChange === "yes") {
    findings.push(
      finding(
        "program-change-anchor",
        "warning",
        "Program changes may outgrow the grandfathered period",
        "The transition calculation is anchored to the program/EAD end in place on the effective date. A later transfer, education-level change, or longer program date may require extension-of-stay planning.",
        ["8CFR-214-1-M1"]
      )
    );
    nextActions.push("Compare the I-20 end date on September 15, 2026 against the later transfer or new-program end date.");
  }

  if (scenario.cptPlan === "after_admission_end") {
    findings.push(
      finding(
        "cpt-after-admission-end",
        "warning",
        "CPT depends on the student still being in F-1 status",
        "This MVP flags CPT as a timing dependency. If practical training would occur after the calculated admission or transition end, the student likely needs an extension strategy before the CPT period.",
        ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      )
    );
  } else if (scenario.cptPlan === "before_admission_end" && coverageEnd) {
    findings.push(
      finding(
        "cpt-before-admission-end",
        "info",
        "CPT is inside the tested admission window",
        `The CPT timing selected is before the calculated status end of ${formatDate(
          coverageEnd
        )}. The app still needs a separate CPT eligibility checklist before giving training-specific guidance.`,
        ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      )
    );
  }
}

function addTravelFindings(scenario: StudentScenario, findings: Finding[], nextActions: string[]) {
  if (scenario.pendingExtensionOnDeparture === "yes" && scenario.travelPosture !== "none") {
    findings.push(
      finding(
        "pending-extension-travel",
        scenario.reentryBasis === "longer_program_i20" ? "danger" : "warning",
        "Pending I-539 plus travel needs careful routing",
        "The final rule separates travel for the balance of a prior admission from travel seeking a longer admission period. That distinction can decide whether the extension request is treated as abandoned.",
        PENDING_EOS_TRAVEL_RULE.sourceIds
      )
    );
    nextActions.push("Check the I-797C, travel date, I-20 end date used for return, and requested admission period together.");
  }

  if (scenario.travelPosture === "automatic_visa_revalidation" || scenario.reentryBasis === "automatic_visa_revalidation") {
    findings.push(
      finding(
        "automatic-visa-revalidation",
        "question",
        "Automatic visa revalidation should not be treated as a simple clock reset",
        "This prototype does not assume AVR creates the same new fixed-period admission result as an ordinary F-1 return. Route this case for DSO or attorney review.",
        ["8CFR-214-1-A4", "8CFR-214-1-C8"]
      )
    );
  }
}

function buildFixedAdmissionResult(scenario: StudentScenario, isReentry: boolean): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  const startDate = scenario.reentryDate ?? effectiveDate;
  const fourYearEnd = addYears(startDate, 4);
  const targetProgramEnd = scenario.currentProgramEndDate ?? scenario.programEndOnEffectiveDate;
  const coverageEnd = targetProgramEnd ? minDate(targetProgramEnd, fourYearEnd) : undefined;
  const latestDepartureDate = coverageEnd ? addDays(coverageEnd, F1_DEPARTURE_PERIOD_DAYS) : undefined;
  const extensionNeeded = coverageEnd && targetProgramEnd ? isAfter(targetProgramEnd, coverageEnd) : false;
  const appliedRules = [FIXED_ADMISSION_RULE];
  const findings: Finding[] = [];
  const nextActions: string[] = [];
  const followUpQuestions = targetProgramEnd ? [] : ["What program end date will be on the Form I-20 used for admission?"];
  const timelineItems: TimelineItem[] = [
    timeline(effectiveDate, "Rule effective date", "Fixed-period admission framework begins.")
  ];

  if (coverageEnd) {
    timelineItems.push(
      timeline(startDate, isReentry ? "Tested re-entry" : "Tested initial entry", "Admission clock starts from the inspected admission date."),
      timeline(coverageEnd, "Admit-until date to test", "Earlier of program end or four years from admission.", extensionNeeded ? "warning" : "good"),
      timeline(latestDepartureDate!, "F-1 departure period ends", "Sixty days after the tested admit-until date.")
    );
  }

  if (extensionNeeded && coverageEnd && targetProgramEnd) {
    findings.push(
      finding(
        "fixed-extension-needed",
        "warning",
        "Program runs past the fixed admission period",
        `The tested program end (${formatDate(targetProgramEnd)}) is after the four-year admission cap (${formatDate(
          coverageEnd
        )}). The student should plan an extension-of-stay filing before the admission period expires.`,
        ["8CFR-214-1-A4"]
      )
    );
    nextActions.push("Work backward from the fixed admit-until date to plan the I-539 extension window.");
  }

  addTransferAndCptFindings(scenario, coverageEnd, findings, nextActions);
  addTravelFindings(scenario, findings, nextActions);
  addOptFindings(scenario, findings, nextActions);

  const result = baseResult(
    scenario,
    followUpQuestions.length ? "manual" : extensionNeeded ? "caution" : "ok",
    isReentry ? "fixed_period_reentry" : "incoming_fixed_period",
    coverageEnd
      ? `Fixed-period admission through ${formatDate(coverageEnd)}`
      : "Fixed-period admission needs the I-20 program end",
    coverageEnd
      ? `The tested admission period ends on ${formatDate(coverageEnd)}, with departure period through ${formatDate(
          latestDepartureDate
        )}.`
      : "A fixed-period admission cannot be calculated until the I-20 program end date is known.",
    appliedRules,
    findings,
    timelineItems,
    followUpQuestions,
    nextActions
  );

  return {
    ...result,
    coverageEnd,
    departurePeriodDays: coverageEnd ? F1_DEPARTURE_PERIOD_DAYS : undefined,
    latestDepartureDate,
    extensionNeededBy: extensionNeeded ? coverageEnd : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE
  };
}

export function calculateScenario(scenario: StudentScenario): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  const transitionCapDate = addYears(effectiveDate, 4);
  const missingFacts = findMissingTransitionFacts(scenario);
  const isProspective = scenario.startingPosition === "prospective_outside_us";
  const isFixedAlready =
    scenario.admissionBasis === "fixed_period" || scenario.startingPosition === "readmitted_fixed_period";

  if (isProspective || isFixedAlready) {
    return buildFixedAdmissionResult(
      {
        ...scenario,
        effectiveDate
      },
      scenario.startingPosition === "readmitted_fixed_period"
    );
  }

  if (
    missingFacts.length ||
    scenario.admissionBasis !== "duration_of_status" ||
    scenario.inUsOnEffectiveDate !== "yes" ||
    scenario.maintainingStatusOnEffectiveDate !== "yes"
  ) {
    const findings = [
      finding(
        "transition-eligibility-unconfirmed",
        "question",
        "Grandfathering cannot be confirmed yet",
        "The transition treatment depends on being in the United States, properly maintaining F-1 status, and admitted for D/S on the rule's effective date.",
        ["8CFR-214-1-M1"]
      )
    ];

    return baseResult(
      { ...scenario, effectiveDate },
      "manual",
      "manual_review",
      "More facts needed before calculating the transition period",
      "The app should ask follow-up questions instead of guessing at D/S transition eligibility.",
      [TRANSITION_RULE],
      findings,
      [timeline(effectiveDate, "Rule effective date", "Transition eligibility is tested on this date.", "warning")],
      missingFacts.length ? missingFacts : ["Confirm the student's I-94 admission notation and status on September 15, 2026."],
      ["Collect the I-94, active I-20, status-maintenance facts, and any EAD dates before relying on a result."]
    );
  }

  const coverageEnd = computeTransitionCoverage({ ...scenario, effectiveDate });
  const latestDepartureDate = coverageEnd ? addDays(coverageEnd, F1_DEPARTURE_PERIOD_DAYS) : undefined;
  const targetProgramEnd = scenario.currentProgramEndDate ?? scenario.programEndOnEffectiveDate;
  const extensionNeeded = Boolean(coverageEnd && targetProgramEnd && isAfter(targetProgramEnd, coverageEnd));
  const appliedRules = [TRANSITION_RULE];
  const findings: Finding[] = [
    finding(
      "transition-cohort",
      "good",
      "Student fits the tested D/S transition cohort",
      "Based on the inputs, the student is treated as a D/S transition student rather than a new fixed-period admission case.",
      ["8CFR-214-1-M1"]
    )
  ];
  const nextActions: string[] = [];

  if (extensionNeeded && coverageEnd && targetProgramEnd) {
    findings.push(
      finding(
        "transition-extension-needed",
        "warning",
        "Program runs past the grandfathered period",
        `The tested program end (${formatDate(targetProgramEnd)}) is later than the calculated transition end (${formatDate(
          coverageEnd
        )}). Staying in the United States past that date likely requires an extension-of-stay strategy.`,
        ["8CFR-214-1-M1"]
      )
    );
    nextActions.push("Map an extension-of-stay plan before the calculated transition period expires.");
  } else if (coverageEnd) {
    findings.push(
      finding(
        "transition-covers-program",
        "good",
        "Grandfathered period covers the tested program end",
        `The later of the effective-date I-20/EAD end is not beyond the four-year transition cap, so this scenario does not show a program-level extension need before ${formatDate(
          coverageEnd
        )}.`,
        ["8CFR-214-1-M1"]
      )
    );
  }

  if (scenario.travelPosture === "planned" || scenario.travelPosture === "completed") {
    const fixedAfterTravel = scenario.reentryDate
      ? buildFixedAdmissionResult(
          {
            ...scenario,
            startingPosition: "readmitted_fixed_period",
            admissionBasis: "fixed_period",
            effectiveDate
          },
          true
        )
      : undefined;

    if (fixedAfterTravel?.coverageEnd && coverageEnd && isAfter(fixedAfterTravel.coverageEnd, coverageEnd)) {
      findings.push(
        finding(
          "travel-may-reset-clock",
          "info",
          "A regular F-1 return may create a longer fixed period",
          `Using the tested re-entry date, the fixed-period calculation runs through ${formatDate(
            fixedAfterTravel.coverageEnd
          )}, compared with the transition end of ${formatDate(coverageEnd)}.`,
          ["8CFR-214-1-A4"]
        )
      );
    } else {
      findings.push(
        finding(
          "travel-needs-admission-review",
          "warning",
          "Travel changes the framework",
          "After the effective date, an ordinary return may be treated as a fixed-period admission. The exact result depends on the return date, I-20 end date, visa validity, and I-94 issued by CBP.",
          ["8CFR-214-1-A4"]
        )
      );
    }
  }

  addTransferAndCptFindings(scenario, coverageEnd, findings, nextActions);
  addTravelFindings(scenario, findings, nextActions);
  addOptFindings(scenario, findings, nextActions);

  const timelineItems = [
    timeline(effectiveDate, "Rule effective date", "Transition eligibility is tested on this date."),
    timeline(transitionCapDate, "Four-year transition cap", "Grandfathered D/S period cannot run past this date.", extensionNeeded ? "warning" : "neutral")
  ];

  if (scenario.programEndOnEffectiveDate) {
    timelineItems.push(
      timeline(
        scenario.programEndOnEffectiveDate,
        "I-20 end on effective date",
        "Program end shown on the active I-20 used for the transition calculation."
      )
    );
  }

  if (scenario.eadEndOnEffectiveDate) {
    timelineItems.push(
      timeline(
        scenario.eadEndOnEffectiveDate,
        "EAD end on effective date",
        "EAD end can be the later transition date if it extends beyond the program date."
      )
    );
  }

  if (coverageEnd && latestDepartureDate) {
    timelineItems.push(
      timeline(coverageEnd, "Calculated F-1 status end", "Later effective-date document end, capped at four years.", extensionNeeded ? "warning" : "good"),
      timeline(latestDepartureDate, "F-1 departure period ends", "Sixty days after the calculated transition end.")
    );
  }

  if (scenario.optStage !== "none" && scenario.optStage !== "pre_completion") {
    appliedRules.push(OPT_TRANSITION_RULE);
    timelineItems.push(
      timeline(
        OPT_TRANSITION_I765_DEADLINE,
        "Transition OPT I-765 checkpoint",
        "Special transition treatment is keyed to this filing deadline.",
        "warning"
      )
    );
  }

  if (scenario.pendingExtensionOnDeparture === "yes") {
    appliedRules.push(PENDING_EOS_TRAVEL_RULE);
  }

  const result = baseResult(
    { ...scenario, effectiveDate },
    extensionNeeded ? "caution" : "ok",
    "transition_ds",
    coverageEnd
      ? `Grandfathered F-1 period through ${formatDate(coverageEnd)}`
      : "Transition period needs document dates",
    coverageEnd
      ? `This scenario remains in the D/S transition framework, with the F-1 departure period running through ${formatDate(
          latestDepartureDate
        )}.`
      : "The transition result cannot be completed until the effective-date document end dates are known.",
    appliedRules,
    findings,
    timelineItems.sort((a, b) => (a.date > b.date ? 1 : -1)),
    [],
    nextActions
  );

  return {
    ...result,
    coverageEnd,
    departurePeriodDays: coverageEnd ? F1_DEPARTURE_PERIOD_DAYS : undefined,
    latestDepartureDate,
    extensionNeededBy: extensionNeeded ? coverageEnd : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE,
    citations: uniqueSources(appliedRules, findings)
  };
}

export const primarySources = [source("FR-2026-FINAL-RULE")];

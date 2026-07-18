import { SOURCE_INDEX, source } from "../sources/sourceIndex";
import { addDays, addYears, formatDate, isAfter, isOnOrBefore, isValidDateString, maxDate, minDate, normalizeDateInput } from "./dateMath";
import type { AppliedRule, Finding, PlannerResult, StudentScenario, TimelineItem } from "./types";

export const DEFAULT_EFFECTIVE_DATE = "2026-09-15";
export const F1_TRANSITION_DEPARTURE_PERIOD_DAYS = 60;
export const F1_FIXED_DEPARTURE_PERIOD_DAYS = 30;
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
    "A new or returning F-1 admission after the effective date is limited to the program length shown on the Form I-20 or four years, whichever is shorter, plus the fixed-period F-1 30-day departure period.",
  sourceIds: ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
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

const DATE_FIELDS: Array<[keyof StudentScenario, string, ("date" | "effectiveDate")?]> = [
  ["programEndOnEffectiveDate", "I-20 end on September 15, 2026"],
  ["currentProgramEndDate", "program end date"],
  ["eadEndOnEffectiveDate", "EAD end on September 15, 2026"],
  ["currentEadEndDate", "current EAD end date"],
  ["optFilingDate", "I-765 filing date"],
  ["reentryDate", "return/admission date"],
  ["effectiveDate", "rule effective date", "effectiveDate"]
];

function normalizeScenarioDates(scenario: StudentScenario): {
  scenario: StudentScenario;
  findings: Finding[];
  followUpQuestions: string[];
} {
  const normalizedScenario: StudentScenario = { ...scenario };
  const writableScenario = normalizedScenario as unknown as Record<string, string | undefined>;
  const normalizedMessages: string[] = [];
  const followUpQuestions: string[] = [];

  for (const [field, label, kind = "date"] of DATE_FIELDS) {
    const value = scenario[field];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const normalized = normalizeDateInput(value);
    if (normalized.value) {
      writableScenario[field] = normalized.value;
      if (normalized.normalized || value !== normalized.value) {
        normalizedMessages.push(`${label}: "${value}" -> ${formatDate(normalized.value)}`);
      }
      continue;
    }

    if (kind === "effectiveDate") {
      writableScenario[field] = DEFAULT_EFFECTIVE_DATE;
      followUpQuestions.push(`Confirm the ${label}. For now, the app is using ${formatDate(DEFAULT_EFFECTIVE_DATE)}.`);
    } else {
      writableScenario[field] = undefined;
      followUpQuestions.push(
        normalized.issue === "ambiguous"
          ? `Confirm the ${label}. "${value}" could mean more than one calendar date.`
          : `Confirm the ${label}. "${value}" did not match a calendar date the app could safely read.`
      );
    }
  }

  const findings: Finding[] = [];
  if (normalizedMessages.length) {
    findings.push(
      finding(
        "date-input-normalized",
        "info",
        "Some dates were normalized",
        `I read these date entries as: ${normalizedMessages.join("; ")}. The student should be able to correct any date that looks wrong.`,
        []
      )
    );
  }

  if (followUpQuestions.length) {
    findings.push(
      finding(
        "date-confirmation-needed",
        "question",
        "Some dates need confirmation",
        "The app kept the parts of the scenario that do not depend on those dates and marked the specific dates that would sharpen the result.",
        []
      )
    );
  }

  return { scenario: normalizedScenario, findings, followUpQuestions };
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

function safestStatus(
  preferred: PlannerResult["status"],
  findings: Finding[],
  followUpQuestions: string[]
): PlannerResult["status"] {
  if (findings.some((item) => item.tone === "danger")) {
    return "risk";
  }
  if (followUpQuestions.length > 0 || findings.some((item) => item.tone === "question")) {
    return "manual";
  }
  if (preferred === "ok" && findings.some((item) => item.tone === "warning")) {
    return "caution";
  }
  return preferred;
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

function isPostCompletionOpt(stage: StudentScenario["optStage"]): boolean {
  return stage.startsWith("post_completion");
}

function isStemOpt(stage: StudentScenario["optStage"]): boolean {
  return stage.startsWith("stem");
}

function isTransitionOpt(stage: StudentScenario["optStage"]): boolean {
  return isPostCompletionOpt(stage) || isStemOpt(stage);
}

function addOptFindings(
  scenario: StudentScenario,
  findings: Finding[],
  nextActions: string[],
  options: { fixedAdmission?: boolean; transitionCoverageEnd?: string; transitionLatestDepartureDate?: string; transitionCapDate?: string } = {}
) {
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

  if (options.fixedAdmission) {
    findings.push(
      finding(
        "fixed-opt-admission-needs-review",
        "question",
        "OPT/STEM return has its own fixed-admission branch",
        "What we can say now: ordinary post-effective-date F-1 admission uses the shorter of the I-20 program length or four years, plus 30 days. For post-completion OPT or STEM OPT return, the admitted-until date can turn on the approved EAD end date, DSO-recommended employment end date, pending I-765 receipt, and travel/extension facts.",
        ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
      )
    );
    nextActions.push("Add EAD or pending I-765 facts to compare the ordinary fixed-period branch with the OPT/STEM return branch.");
    return;
  }

  if (scenario.optStage.endsWith("approved") && !scenario.currentEadEndDate && !scenario.eadEndOnEffectiveDate) {
    findings.push(
      finding(
        "approved-opt-ead-needed",
        "question",
        "Approved OPT/STEM needs the EAD end date",
        `What we can say now: using the I-20/EAD facts already provided, this transition scenario runs through ${formatDate(
          options.transitionCoverageEnd
        )}, with the F-1 departure period through ${formatDate(
          options.transitionLatestDepartureDate
        )}. If an approved OPT/STEM EAD expires after the I-20 date but on or before ${formatDate(
          options.transitionCapDate
        )}, that EAD date may become the transition end; if it expires after ${formatDate(
          options.transitionCapDate
        )}, the four-year transition cap is still the outer limit.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Add the approved EAD expiration date to sharpen the OPT/STEM stay-through date.");
    return;
  }

  if (scenario.optStage.endsWith("approved") && scenario.currentEadEndDate && !scenario.eadEndOnEffectiveDate) {
    findings.push(
      finding(
        "approved-opt-branch-not-modeled",
        "question",
        "Approved OPT/STEM needs a dedicated status-end check",
        `What we can say now: the date provided is a current EAD end date. If that EAD was already active on September 15, 2026, it may be part of the D/S transition calculation; if it was approved later through the transition OPT/STEM path, it belongs in that branch. The current I-20/EAD facts already entered produce ${formatDate(
          options.transitionCoverageEnd
        )} as the tested transition end.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Confirm whether the approved EAD was active on September 15, 2026 or was approved under the transition OPT/STEM filing rule.");
    return;
  }

  if (!scenario.optFilingDate && scenario.optStage.endsWith("pending")) {
    findings.push(
      finding(
        "opt-pending-date-needed",
        "question",
        "Pending OPT/STEM filing date is needed",
        `What we can say now: a transition OPT/STEM I-765 filing on or before ${formatDate(
          OPT_TRANSITION_I765_DEADLINE
        )} may receive special treatment, but pending cases also depend on the receipt date and whether the student travels before filing or while the request is pending.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Confirm the I-765 receipt date for the pending OPT/STEM application.");
    return;
  }

  if (!scenario.optFilingDate && scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-filing-needed",
        "warning",
        "OPT timing needs its own check",
        `For transition-cohort post-completion OPT/STEM OPT, the rule creates a special I-765 path through ${formatDate(
          OPT_TRANSITION_I765_DEADLINE
        )}. If the filing is on or before that date and before the relevant status/EAD deadline, this piece may fit the transition path; if it is later, or after travel, the student should compare an extension strategy or fixed-period return branch.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Confirm the planned I-765 filing date before relying on the transition OPT treatment.");
    return;
  }

  if (!scenario.optFilingDate) {
    return;
  }

  const insideMarchWindow = isOnOrBefore(scenario.optFilingDate, OPT_TRANSITION_I765_DEADLINE);

  if (!insideMarchWindow) {
    findings.push(
      finding(
        "opt-filing-after-transition-window",
        "warning",
        "OPT/STEM filing date is outside the transition window",
        `The tested I-765 filing date (${formatDate(
          scenario.optFilingDate
        )}) is after ${formatDate(OPT_TRANSITION_I765_DEADLINE)}. The app should not apply the special transition filing treatment to this scenario.`,
        OPT_TRANSITION_RULE.sourceIds
      )
    );
    nextActions.push("Plan for an extension-of-stay analysis instead of relying on the transition OPT exception.");
  } else if (isPostCompletionOpt(scenario.optStage)) {
    if (!options.transitionLatestDepartureDate) {
      findings.push(
        finding(
          "post-opt-period-end-needed",
          "question",
          "Post-completion OPT needs the transition end date",
          "The post-completion OPT exception requires filing before the transition period of admission expires, including the F-1 60-day departure period.",
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    } else if (isOnOrBefore(scenario.optFilingDate, options.transitionLatestDepartureDate)) {
      findings.push(
        finding(
          "opt-filing-in-window",
          "good",
          "OPT filing date falls inside the transition window",
          `The tested I-765 filing date (${formatDate(
            scenario.optFilingDate
          )}) is on or before ${formatDate(OPT_TRANSITION_I765_DEADLINE)} and before the tested transition period expires.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    } else {
      findings.push(
        finding(
          "post-opt-after-period-expiration",
          "danger",
          "Post-completion OPT filing is after the transition period",
          `The tested I-765 filing date (${formatDate(
            scenario.optFilingDate
          )}) is after the calculated transition departure-period end (${formatDate(options.transitionLatestDepartureDate)}). The app should not apply the no-I-539 transition exception.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    }
  } else if (isStemOpt(scenario.optStage)) {
    if (!scenario.currentEadEndDate) {
      findings.push(
        finding(
          "stem-current-ead-needed",
          "question",
          "STEM OPT needs the current OPT EAD end date",
          `What we can say now: the STEM OPT filing date is on or before ${formatDate(
            OPT_TRANSITION_I765_DEADLINE
          )}. If the current OPT EAD ends on or after ${formatDate(
            scenario.optFilingDate
          )}, this timing piece fits; if the EAD ended before that filing date, the transition STEM OPT path is a risk.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
      nextActions.push("Add the current post-completion OPT EAD end date to resolve the STEM OPT timing branch.");
    } else if (isOnOrBefore(scenario.optFilingDate, scenario.currentEadEndDate)) {
      findings.push(
        finding(
          "stem-filing-in-window",
          "good",
          "STEM OPT filing date fits the transition rule",
          `The tested STEM OPT filing date (${formatDate(
            scenario.optFilingDate
          )}) is on or before ${formatDate(OPT_TRANSITION_I765_DEADLINE)} and before the current OPT EAD end date.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    } else {
      findings.push(
        finding(
          "stem-filing-after-current-ead",
          "danger",
          "STEM OPT filing is after the current OPT EAD end date",
          `The tested STEM OPT filing date (${formatDate(
            scenario.optFilingDate
          )}) is after the current OPT EAD end date (${formatDate(scenario.currentEadEndDate)}). The app should not apply the no-I-539 transition exception.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    }
  }

  if (scenario.travelPosture === "unknown" && scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-travel-unknown",
        "question",
        "Travel before filing must be confirmed",
        "What we can say now: the filing window can be checked from the date entered. If the student leaves before filing, the analysis shifts to a fixed-period return branch; if they stay and file first, the transition OPT/STEM path may remain available.",
        OPT_TRANSITION_RULE.sourceIds
      )
    );
  } else if (scenario.travelPosture !== "none" && scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-travel-before-filing",
        "danger",
        "Travel before filing OPT changes the analysis",
        "What we can say now: departure before filing separates this from the ordinary transition OPT/STEM path. Compare the no-travel filing path with the fixed-period return path before the student leaves.",
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
        "Automatic visa revalidation is a separate travel branch",
        "What we can say now: an ordinary post-effective-date F-1 return may create a fixed-period admission, but AVR has a different travel posture. Compare AVR with an ordinary return before treating travel as a new clock.",
        ["8CFR-214-1-A4", "8CFR-214-1-C8"]
      )
    );
  }
}

function buildFixedAdmissionResult(
  scenario: StudentScenario,
  isReentry: boolean,
  baseFindings: Finding[] = [],
  baseFollowUpQuestions: string[] = []
): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  const startDate = scenario.reentryDate ?? effectiveDate;
  const fourYearEnd = addYears(startDate, 4);
  const targetProgramEnd = scenario.currentProgramEndDate;
  const coverageEnd = targetProgramEnd ? minDate(targetProgramEnd, fourYearEnd) : undefined;
  const latestDepartureDate = coverageEnd ? addDays(coverageEnd, F1_FIXED_DEPARTURE_PERIOD_DAYS) : undefined;
  const extensionNeeded = coverageEnd && targetProgramEnd ? isAfter(targetProgramEnd, coverageEnd) : false;
  const appliedRules = [FIXED_ADMISSION_RULE];
  const findings: Finding[] = [...baseFindings];
  const nextActions: string[] = [];
  const followUpQuestions = [
    ...baseFollowUpQuestions,
    ...(targetProgramEnd ? [] : ["What program end date will be on the Form I-20 used for admission?"])
  ];
  const timelineItems: TimelineItem[] = [
    timeline(effectiveDate, "Rule effective date", "Fixed-period admission framework begins.")
  ];

  if (coverageEnd) {
    timelineItems.push(
      timeline(startDate, isReentry ? "Tested re-entry" : "Tested initial entry", "Admission clock starts from the inspected admission date."),
      timeline(coverageEnd, "Admit-until date to test", "Earlier of program end or four years from admission.", extensionNeeded ? "warning" : "good"),
      timeline(latestDepartureDate!, "F-1 departure/maintain-status period ends", "Thirty days after the tested program, training, or four-year point.")
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
  addOptFindings(scenario, findings, nextActions, { fixedAdmission: isTransitionOpt(scenario.optStage) });
  const status = safestStatus(
    followUpQuestions.length ? "manual" : extensionNeeded ? "caution" : "ok",
    findings,
    followUpQuestions
  );

  const result = baseResult(
    scenario,
    status,
    isReentry ? "fixed_period_reentry" : "incoming_fixed_period",
    coverageEnd
      ? `Fixed-period admission through ${formatDate(coverageEnd)}`
      : "Fixed-period admission needs the I-20 program end",
    coverageEnd
      ? `The tested program/training or four-year point is ${formatDate(coverageEnd)}, with the fixed-period F-1 30-day period running through ${formatDate(
          latestDepartureDate
        )}.`
      : "Add the I-20 program end date to turn the fixed-period rule into a specific admit-until date.",
    appliedRules,
    findings,
    timelineItems,
    followUpQuestions,
    nextActions
  );

  return {
    ...result,
    coverageEnd,
    departurePeriodDays: coverageEnd ? F1_FIXED_DEPARTURE_PERIOD_DAYS : undefined,
    latestDepartureDate,
    extensionNeededBy: extensionNeeded ? coverageEnd : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE
  };
}

export function calculateScenario(scenario: StudentScenario): PlannerResult {
  const dateNormalization = normalizeScenarioDates(scenario);
  const effectiveDate =
    dateNormalization.scenario.effectiveDate && isValidDateString(dateNormalization.scenario.effectiveDate)
    ? dateNormalization.scenario.effectiveDate
    : DEFAULT_EFFECTIVE_DATE;
  const scenarioWithEffectiveDate = { ...dateNormalization.scenario, effectiveDate };
  const dateFindings = dateNormalization.findings;
  const dateFollowUpQuestions = dateNormalization.followUpQuestions;

  const transitionCapDate = addYears(effectiveDate, 4);
  const missingFacts = findMissingTransitionFacts(scenarioWithEffectiveDate);
  const isProspective = scenarioWithEffectiveDate.startingPosition === "prospective_outside_us";
  const isFixedAlready =
    scenarioWithEffectiveDate.admissionBasis === "fixed_period" || scenarioWithEffectiveDate.startingPosition === "readmitted_fixed_period";

  if (isProspective || isFixedAlready) {
    return buildFixedAdmissionResult(
      scenarioWithEffectiveDate,
      scenarioWithEffectiveDate.startingPosition === "readmitted_fixed_period",
      dateFindings,
      dateFollowUpQuestions
    );
  }

  if (
    missingFacts.length ||
    scenarioWithEffectiveDate.admissionBasis !== "duration_of_status" ||
    scenarioWithEffectiveDate.inUsOnEffectiveDate !== "yes" ||
    scenarioWithEffectiveDate.maintainingStatusOnEffectiveDate !== "yes"
  ) {
    const findings = [
      ...dateFindings,
      finding(
        "transition-eligibility-unconfirmed",
        "question",
        "Grandfathering needs a few confirmed facts",
        "The transition treatment depends on being in the United States, properly maintaining F-1 status, and admitted for D/S on the rule's effective date.",
        ["8CFR-214-1-M1"]
      )
    ];

    return baseResult(
      scenarioWithEffectiveDate,
      "manual",
      "manual_review",
      "More facts needed before calculating the transition period",
      "The app should ask follow-up questions instead of guessing at D/S transition eligibility.",
      [TRANSITION_RULE],
      findings,
      [timeline(effectiveDate, "Rule effective date", "Transition eligibility is tested on this date.", "warning")],
      [
        ...dateFollowUpQuestions,
        ...(missingFacts.length ? missingFacts : ["Confirm the student's I-94 admission notation and status on September 15, 2026."])
      ],
      ["Collect the I-94, active I-20, status-maintenance facts, and any EAD dates before relying on a result."]
    );
  }

  const coverageEnd = computeTransitionCoverage(scenarioWithEffectiveDate);
  const latestDepartureDate = coverageEnd ? addDays(coverageEnd, F1_TRANSITION_DEPARTURE_PERIOD_DAYS) : undefined;
  const targetProgramEnd = scenarioWithEffectiveDate.currentProgramEndDate ?? scenarioWithEffectiveDate.programEndOnEffectiveDate;
  const targetTrainingEnd = scenarioWithEffectiveDate.eadEndOnEffectiveDate;
  const targetActivityEnd = maxDate(targetProgramEnd, targetTrainingEnd);
  const extensionNeeded = Boolean(coverageEnd && targetActivityEnd && isAfter(targetActivityEnd, coverageEnd));
  const appliedRules = [TRANSITION_RULE];
  const findings: Finding[] = [
    ...dateFindings,
    finding(
      "transition-cohort",
      "good",
      "Student fits the tested D/S transition cohort",
      "Based on the inputs, the student is treated as a D/S transition student rather than a new fixed-period admission case.",
      ["8CFR-214-1-M1"]
    )
  ];
  const nextActions: string[] = [];

  if (!scenarioWithEffectiveDate.currentProgramEndDate) {
    findings.push(
      finding(
        "target-program-end-needed",
        "question",
        "Longer study plans need a target end date",
        `What we can say now: the D/S transition period is based on the I-20/EAD facts in place on ${formatDate(
          effectiveDate
        )}. Add the later program, transfer, or change-of-level end date to see whether that plan runs past the grandfathered period.`,
        ["8CFR-214-1-M1"]
      )
    );
  }

  if (extensionNeeded && coverageEnd && targetActivityEnd) {
    findings.push(
      finding(
        "transition-extension-needed",
        "warning",
        "Study or training runs past the grandfathered period",
        `The tested study/training end (${formatDate(targetActivityEnd)}) is later than the calculated transition end (${formatDate(
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

  if (scenarioWithEffectiveDate.travelPosture === "planned" || scenarioWithEffectiveDate.travelPosture === "completed") {
    const fixedAfterTravel = scenarioWithEffectiveDate.reentryDate
      ? buildFixedAdmissionResult(
          {
            ...scenarioWithEffectiveDate,
            startingPosition: "readmitted_fixed_period",
            admissionBasis: "fixed_period",
            effectiveDate
          },
          true
        )
      : undefined;

    if (fixedAfterTravel?.coverageEnd && fixedAfterTravel.latestDepartureDate && coverageEnd && latestDepartureDate) {
      findings.push(
        finding(
          "travel-fixed-period-branch",
          "info",
          "Travel creates a separate fixed-period branch",
          `If the student stays in the D/S transition framework, the tested departure period runs through ${formatDate(
            latestDepartureDate
          )}. If they make an ordinary F-1 return on ${formatDate(
            scenarioWithEffectiveDate.reentryDate
          )}, the tested fixed-period admission runs through ${formatDate(
            fixedAfterTravel.coverageEnd
          )}, with the fixed-period 30-day stay-through date of ${formatDate(
            fixedAfterTravel.latestDepartureDate
          )}. Treat those as alternative scenarios, not one blended clock.`,
          ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
        )
      );
    } else {
      findings.push(
        finding(
          "travel-needs-admission-review",
          "question",
          "Travel changes the framework",
          "What we can say now: staying in the United States preserves the tested transition branch. Add the return date and I-20 end date for the return to compare it with a fixed-period admission branch.",
          ["8CFR-214-1-A4"]
        )
      );
    }
  }

  addTransferAndCptFindings(scenarioWithEffectiveDate, coverageEnd, findings, nextActions);
  addTravelFindings(scenarioWithEffectiveDate, findings, nextActions);
  addOptFindings(scenarioWithEffectiveDate, findings, nextActions, {
    transitionCoverageEnd: coverageEnd,
    transitionLatestDepartureDate: latestDepartureDate,
    transitionCapDate
  });

  const timelineItems = [
    timeline(effectiveDate, "Rule effective date", "Transition eligibility is tested on this date."),
    timeline(transitionCapDate, "Four-year transition cap", "Grandfathered D/S period ends no later than this date.", extensionNeeded ? "warning" : "neutral")
  ];

  if (scenarioWithEffectiveDate.programEndOnEffectiveDate) {
    timelineItems.push(
      timeline(
        scenarioWithEffectiveDate.programEndOnEffectiveDate,
        "I-20 end on effective date",
        "Program end shown on the active I-20 used for the transition calculation."
      )
    );
  }

  if (scenarioWithEffectiveDate.eadEndOnEffectiveDate) {
    timelineItems.push(
      timeline(
        scenarioWithEffectiveDate.eadEndOnEffectiveDate,
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

  if (scenarioWithEffectiveDate.optStage !== "none" && scenarioWithEffectiveDate.optStage !== "pre_completion") {
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

  if (scenarioWithEffectiveDate.pendingExtensionOnDeparture === "yes") {
    appliedRules.push(PENDING_EOS_TRAVEL_RULE);
  }

  const status = safestStatus(extensionNeeded ? "caution" : "ok", findings, dateFollowUpQuestions);

  const result = baseResult(
    scenarioWithEffectiveDate,
    status,
    "transition_ds",
    coverageEnd
      ? `Grandfathered F-1 period through ${formatDate(coverageEnd)}`
      : "Transition period needs document dates",
    coverageEnd
      ? `This scenario remains in the D/S transition framework, with the F-1 departure period running through ${formatDate(
          latestDepartureDate
        )}.`
      : "Add the effective-date I-20 or EAD end date to turn the transition rule into a specific stay-through date.",
    appliedRules,
    findings,
    timelineItems.sort((a, b) => (a.date > b.date ? 1 : -1)),
    dateFollowUpQuestions,
    nextActions
  );

  return {
    ...result,
    coverageEnd,
    departurePeriodDays: coverageEnd ? F1_TRANSITION_DEPARTURE_PERIOD_DAYS : undefined,
    latestDepartureDate,
    extensionNeededBy: extensionNeeded ? coverageEnd : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE,
    citations: uniqueSources(appliedRules, findings)
  };
}

export const primarySources = [source("FR-2026-FINAL-RULE")];

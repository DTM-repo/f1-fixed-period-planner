import { SOURCE_INDEX, source } from "../sources/sourceIndex";
import { addDays, addYears, formatDate, isAfter, isOnOrBefore, isValidDateString, maxDate, minDate, normalizeDateInput } from "./dateMath";
import type { AppliedRule, Finding, PlannerResult, StudentScenario, TimelineItem } from "./types";

export const DEFAULT_EFFECTIVE_DATE = "2026-09-15";
export const F1_TRANSITION_DEPARTURE_PERIOD_DAYS = 60;
export const F1_FIXED_DEPARTURE_PERIOD_DAYS = 30;
export const OPT_TRANSITION_I765_DEADLINE = "2027-03-18";

const TRANSITION_RULE: AppliedRule = {
  id: "transition-ds-cap",
  label: "Current F-1 old-rule protection",
  summary:
    "If you are in the United States on the effective date, maintaining F-1 status, and admitted for D/S, the old D/S rules may keep covering you up to the active I-20 or EAD end date, capped at four years from the effective date, plus the F-1 departure period.",
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
    "Certain post-completion OPT and STEM OPT I-765 filings made on or before March 18, 2027 are not paired with an I-539 only because the D/S rule changed.",
  sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
};

const PENDING_EOS_TRAVEL_RULE: AppliedRule = {
  id: "pending-eos-travel",
  label: "Pending extension and travel",
  summary:
    "Travel while an extension request is pending turns on whether you seek the balance of the prior admission period or a longer admission on return.",
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
  ["i94AdmitUntilDate", "I-94 admit-until date"],
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
      followUpQuestions.push(`Confirm the ${label}. For now, this scenario uses ${formatDate(DEFAULT_EFFECTIVE_DATE)}.`);
    } else {
      writableScenario[field] = undefined;
      followUpQuestions.push(
        normalized.issue === "ambiguous"
          ? `Confirm the ${label}. "${value}" could mean more than one calendar date.`
          : `Confirm the ${label}. "${value}" did not match a calendar date that can be safely read.`
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
        `I read these date entries as: ${normalizedMessages.join("; ")}. You can correct any date that looks wrong.`,
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
        "The result keeps the parts that do not depend on those dates and marks the specific dates that would sharpen the answer.",
        []
      )
    );
  }

  return { scenario: normalizedScenario, findings, followUpQuestions };
}

function findMissingTransitionFacts(scenario: StudentScenario): string[] {
  const missing: string[] = [];
  if (scenario.inUsOnEffectiveDate === "unknown") {
    missing.push("Will you be in the United States on September 15, 2026?");
  }
  if (scenario.maintainingStatusOnEffectiveDate === "unknown") {
    missing.push("Will you still be in F-1 status on September 15, 2026?");
  }
  if (scenario.admissionBasis === "unknown") {
    missing.push("Will your I-94 still show D/S, or will it already have a fixed end date?");
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
        )} as the old-rule protection end.`,
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
        )} may receive special treatment, but pending cases also depend on the receipt date and whether you travel before filing or while the request is pending.`,
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
        `For current-student post-completion OPT/STEM OPT, the rule creates a special I-765 path through ${formatDate(
          OPT_TRANSITION_I765_DEADLINE
        )}. If the filing is on or before that date and before the relevant status/EAD deadline, this piece may fit the old-rule path; if it is later, or after travel, compare an extension strategy or fixed-period return branch.`,
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
        `The I-765 filing date entered (${formatDate(
          scenario.optFilingDate
        )}) is after ${formatDate(OPT_TRANSITION_I765_DEADLINE)}. The special OPT/STEM filing treatment should not be applied to this scenario.`,
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
          "The post-completion OPT exception requires filing before the protected period expires, including the F-1 60-day departure period.",
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    } else if (isOnOrBefore(scenario.optFilingDate, options.transitionLatestDepartureDate)) {
      findings.push(
        finding(
          "opt-filing-in-window",
          "good",
          "OPT filing date falls inside the transition window",
          `The I-765 filing date entered (${formatDate(
            scenario.optFilingDate
          )}) is on or before ${formatDate(OPT_TRANSITION_I765_DEADLINE)} and before the protected period expires.`,
          OPT_TRANSITION_RULE.sourceIds
        )
      );
    } else {
      findings.push(
        finding(
          "post-opt-after-period-expiration",
          "danger",
          "Post-completion OPT filing is after the protected period",
          `The I-765 filing date entered (${formatDate(
            scenario.optFilingDate
          )}) is after the calculated departure-period end (${formatDate(options.transitionLatestDepartureDate)}). The no-I-539 exception should not be applied.`,
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
          `The STEM OPT filing date entered (${formatDate(
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
          `The STEM OPT filing date entered (${formatDate(
            scenario.optFilingDate
          )}) is after the current OPT EAD end date (${formatDate(scenario.currentEadEndDate)}). The no-I-539 exception should not be applied.`,
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
        "What we can say now: the filing window can be checked from the date entered. If you leave before filing, the analysis shifts to a fixed-period return branch; if you stay and file first, the OPT/STEM old-rule path may remain available.",
        OPT_TRANSITION_RULE.sourceIds
      )
    );
  } else if (scenario.travelPosture !== "none" && scenario.optStage.endsWith("not_filed")) {
    findings.push(
      finding(
        "opt-travel-before-filing",
        "danger",
        "Travel before filing OPT changes the analysis",
        "What we can say now: departure before filing separates this from the ordinary OPT/STEM old-rule path. Compare the no-travel filing path with the fixed-period return path before leaving.",
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
        "A later school or program change needs a separate check",
        "The old-rule protection is based on the I-20 or EAD date in place on September 15, 2026. A later school transfer, education-level change, or longer program date can require an extension of stay and may also trigger the new school/program-change limits.",
        ["8CFR-214-1-M1", "8CFR-214-2-F5II"]
      )
    );
    nextActions.push("Compare the I-20 end date on September 15, 2026 against the later transfer or new-program end date.");
  }

  if (scenario.educationLevel === "graduate") {
    if (scenario.schoolTransferPlan !== "yes" && scenario.academicProgramChangePlan !== "yes") {
      findings.push(
        finding(
          "graduate-level-change-rules",
          "info",
          "Graduate-level school changes are restricted",
          "Because you selected graduate study, later school-change planning is different. You may not change educational objectives during the program, and a school transfer requires an SEVP-authorized exception for extenuating circumstances.",
          ["8CFR-214-2-F5II"]
        )
      );
    }

    if (scenario.academicProgramChangePlan === "yes") {
      findings.push(
        finding(
          "graduate-program-change-limit",
          "danger",
          "Graduate program changes are tightly limited",
          "Because you selected graduate study and a planned academic program change, this scenario needs a graduate-level restriction check before relying on the plan. The final rule generally blocks graduate-level F-1 students from changing educational objectives during the program.",
          ["8CFR-214-2-F5II"]
        )
      );
      nextActions.push("Confirm whether the program change would count as a change of educational objective at the graduate level.");
    }

    if (scenario.schoolTransferPlan === "yes") {
      findings.push(
        finding(
          "graduate-transfer-limit",
          "warning",
          "Graduate transfers need an SEVP exception",
          "Because you selected graduate study and a planned school transfer, this scenario needs an exception check. The final rule prohibits graduate-level F-1 transfers unless SEVP authorizes an exception for extenuating circumstances.",
          ["8CFR-214-2-F5II"]
        )
      );
      nextActions.push("Confirm whether an SEVP exception would be available before planning a graduate-level transfer.");
    }
  }

  if (scenario.educationLevel === "undergraduate" && (scenario.schoolTransferPlan === "yes" || scenario.academicProgramChangePlan === "yes")) {
    findings.push(
      finding(
        "undergraduate-first-year-check",
        "warning",
        "Undergraduate changes need the one-academic-year check",
        "Because you selected undergraduate study and a school or program change, timing matters. The final rule generally requires undergraduate students to complete one academic year before transferring schools or changing programs, unless an exception applies.",
        ["8CFR-214-2-F5II"]
      )
    );
    nextActions.push("Confirm whether you will have completed one academic year before the transfer or program change.");
  } else if (scenario.educationLevel === "undergraduate") {
    findings.push(
      finding(
        "undergraduate-level-change-rules",
        "info",
        "Undergraduate school changes have first-year limits",
        "Because you selected undergraduate study, later transfer or program-change planning depends on the first-academic-year rule unless SEVP authorizes an exception for extenuating circumstances.",
        ["8CFR-214-2-F5II"]
      )
    );
  }

  if (scenario.nextProgramLevelPlan === "same_or_lower") {
    findings.push(
      finding(
        "same-or-lower-next-program",
        "danger",
        "Same-level or lower-level next programs may be blocked",
        "You selected a possible next program at the same or a lower education level. For programs completed after September 15, 2026, the final rule generally does not allow F-1 status for a new program at the same or a lower education level.",
        ["8CFR-214-2-F5II"]
      )
    );
    nextActions.push("Before relying on a same-level or lower-level next program, check whether the rule blocks that F-1 path.");
  }

  if (scenario.cptPlan === "unknown") {
    findings.push(
      finding(
        "cpt-timing-needed",
        "question",
        "CPT depends on timing and authorization",
        "The final rule does not eliminate Day One CPT or change the basic CPT approval process. The new timing issue is extension-of-stay timing: if you already have authorized CPT and file a timely extension before your F-1 period ends, the rule can allow CPT to continue while the extension is pending for up to 240 days. If the extension is filed only during the departure period after the F-1 period ends, CPT or other F-1 employment cannot continue or begin until the extension is approved.",
        ["8CFR-214-2-F5VIII-CPT"]
      )
    );
    nextActions.push("Add when CPT would start and whether it would fall before or after the I-94/protected period ends.");
  }

  if (scenario.cptPlan === "after_admission_end") {
    findings.push(
      finding(
        "cpt-after-admission-end",
        "warning",
        "CPT depends on you still being in F-1 status",
        "This flags CPT as a timing dependency. If practical training would occur after the calculated admission or protected period ends, you need an extension strategy before the CPT period.",
        ["8CFR-214-1-M1", "8CFR-214-1-A4", "8CFR-214-2-F5VIII-CPT"]
      )
    );
  } else if (scenario.cptPlan === "before_admission_end" && coverageEnd) {
    findings.push(
      finding(
        "cpt-before-admission-end",
        "info",
        "CPT is inside this F-1 period",
        `The CPT timing selected is before the calculated status end of ${formatDate(
          coverageEnd
        )}. A separate CPT eligibility checklist is still needed before giving training-specific guidance.`,
        ["8CFR-214-1-M1", "8CFR-214-1-A4", "8CFR-214-2-F5VIII-CPT"]
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
  const projectedCoverageEnd = targetProgramEnd ? minDate(targetProgramEnd, fourYearEnd) : undefined;
  const coverageEnd = scenario.i94AdmitUntilDate ?? projectedCoverageEnd;
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
      timeline(startDate, isReentry ? "F-1 reentry" : "F-1 entry", "The fixed-period clock starts when CBP admits you."),
      timeline(
        coverageEnd,
        "I-94 end date",
        scenario.i94AdmitUntilDate ? "I-94 admit-until date you entered." : "Earlier of program end or four years from admission.",
        extensionNeeded ? "warning" : "good"
      ),
      timeline(latestDepartureDate!, "F-1 departure/maintain-status period ends", "Thirty days after the program, training, or four-year point.")
    );
  }

  if (scenario.i94AdmitUntilDate) {
    findings.push(
      finding(
        "fixed-i94-date-provided",
        "info",
        "I-94 admit-until date provided",
        `This scenario uses the I-94 admit-until date you entered (${formatDate(
          scenario.i94AdmitUntilDate
        )}) as the fixed-period end. The program end date still matters for extension planning.`,
        ["8CFR-214-1-A4"]
      )
    );
  }

  if (extensionNeeded && coverageEnd && targetProgramEnd) {
    findings.push(
      finding(
        "fixed-extension-needed",
        "warning",
        "Your program runs past the fixed admission period",
        `Your program end date (${formatDate(targetProgramEnd)}) is after the four-year admission cap (${formatDate(
          coverageEnd
        )}). You should plan an extension-of-stay filing before the admission period expires.`,
        ["8CFR-214-1-A4", "USCIS-G1055-I539"]
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
      ? `${scenario.i94AdmitUntilDate ? "I-94 fixed period" : "Fixed-period admission"} through ${formatDate(coverageEnd)}`
      : "Fixed-period admission needs the I-20 program end",
    coverageEnd
      ? `Your fixed F-1 period would end ${formatDate(coverageEnd)}, with the fixed-period F-1 30-day period running through ${formatDate(
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
  const effectiveDateDocumentEnd = maxDate(scenarioWithEffectiveDate.programEndOnEffectiveDate, scenarioWithEffectiveDate.eadEndOnEffectiveDate);
  const currentDocumentEndsBeforeEffectiveDate = Boolean(
    !isProspective &&
      !isFixedAlready &&
      effectiveDateDocumentEnd &&
      isAfter(effectiveDate, effectiveDateDocumentEnd)
  );

  if (
    isProspective &&
    scenarioWithEffectiveDate.inUsOnEffectiveDate === "no" &&
    scenarioWithEffectiveDate.reentryDate &&
    isOnOrBefore(scenarioWithEffectiveDate.reentryDate, effectiveDate)
  ) {
    const findings = [
      ...dateFindings,
      finding(
        "future-entry-before-effective-date-contradiction",
        "danger",
        "These two answers do not fit together",
        `You answered that you will not be an F-1 student in the United States on ${formatDate(
          effectiveDate
        )}, but the entry date entered is ${formatDate(
          scenarioWithEffectiveDate.reentryDate
        )}. If you enter by that date and stay in valid F-1 status, this should be answered as Yes. If you will not be in the United States then, change the entry date to a later date.`,
        ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      )
    ];

    return baseResult(
      scenarioWithEffectiveDate,
      "manual",
      "manual_review",
      "Fix the September 15 answer or the entry date",
      "These answers cannot both be true, so no F-1 timeline is calculated from them.",
      [TRANSITION_RULE, FIXED_ADMISSION_RULE],
      findings,
      [
        timeline(scenarioWithEffectiveDate.reentryDate, "Entry date entered", "This date is on or before the rule starts.", "danger"),
        timeline(effectiveDate, "Rule effective date", "Your first answer says you will not be in the United States on this date.", "danger")
      ].sort((a, b) => (a.date > b.date ? 1 : -1)),
      [
        ...dateFollowUpQuestions,
        "Will you be in the United States in valid F-1 status on September 15, 2026?",
        "If not, what date will you actually enter the United States in F-1 status?"
      ],
      ["Correct one of the two answers before relying on a result."]
    );
  }

  if (isProspective || isFixedAlready) {
    return buildFixedAdmissionResult(
      scenarioWithEffectiveDate,
      scenarioWithEffectiveDate.startingPosition === "readmitted_fixed_period",
      dateFindings,
      dateFollowUpQuestions
    );
  }

  if (currentDocumentEndsBeforeEffectiveDate) {
    const latestDepartureDate = effectiveDateDocumentEnd
      ? addDays(effectiveDateDocumentEnd, F1_TRANSITION_DEPARTURE_PERIOD_DAYS)
      : undefined;
    const findings = [
      ...dateFindings,
      finding(
        "document-ends-before-effective-date",
        "question",
        "F-1 basis on September 15 needs confirmation",
        `The I-20/EAD date entered (${formatDate(
          effectiveDateDocumentEnd
        )}) is before the rule starts on ${formatDate(effectiveDate)}. Confirm whether you will have OPT/STEM OPT, a later I-20, or another F-1 basis on September 15 before using the old D/S rule path.`,
        ["8CFR-214-1-M1"]
      )
    ];

    return baseResult(
      scenarioWithEffectiveDate,
      "manual",
      "manual_review",
      "Confirm F-1 basis on September 15, 2026",
      "The current I-20/EAD date entered ends before the new rule starts, so the calculation needs your F-1 basis on the rule date.",
      [TRANSITION_RULE],
      findings,
      [
        timeline(effectiveDateDocumentEnd!, "Current I-20/EAD date entered", "This date is before the rule starts.", "warning"),
        ...(latestDepartureDate
          ? [timeline(latestDepartureDate, "F-1 departure period from that date", "Sixty days after the I-20/EAD date entered.", "warning")]
          : []),
        timeline(effectiveDate, "Rule effective date", "The old D/S rule path depends on you still having a qualifying F-1 basis on this date.", "warning")
      ].sort((a, b) => (a.date > b.date ? 1 : -1)),
      [
        ...dateFollowUpQuestions,
        "What F-1 basis will you have on September 15, 2026: OPT/STEM OPT, a later I-20, or something else?"
      ],
      ["Collect the OPT/STEM, later I-20, or extension facts before relying on an old D/S rule result."]
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
        "One more fact is needed before showing old-rule protection",
        "This protection depends on being in the United States, staying in F-1 status, and having D/S on your I-94 when the rule starts.",
        ["8CFR-214-1-M1"]
      )
    ];

    return baseResult(
      scenarioWithEffectiveDate,
      "manual",
      "manual_review",
      "More facts needed before calculating old-rule protection",
      "A reliable answer needs the next follow-up fact instead of guessing.",
      [TRANSITION_RULE],
      findings,
      [timeline(effectiveDate, "Rule effective date", "Old-rule protection is checked on this date.", "warning")],
      [
        ...dateFollowUpQuestions,
        ...(missingFacts.length ? missingFacts : ["Confirm your I-94 notation and F-1 status on September 15, 2026."])
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
      "You may stay under the old D/S rules",
      "Your situation fits the current-student protection: you are in the United States on September 15, 2026, staying in F-1 status, and your I-94 says D/S.",
      ["8CFR-214-1-M1"]
    )
  ];
  const nextActions: string[] = [];

  if (!scenarioWithEffectiveDate.currentProgramEndDate) {
    findings.push(
      finding(
        "target-program-end-needed",
        "question",
        "A later program date needs its own check",
        `What we can say now: old-rule protection is based on the I-20/EAD facts in place on ${formatDate(
          effectiveDate
        )}. Add the later program, transfer, or change-of-level end date to see whether that plan runs past the protected period.`,
        ["8CFR-214-1-M1"]
      )
    );
  }

  if (extensionNeeded && coverageEnd && targetActivityEnd) {
    findings.push(
      finding(
        "transition-extension-needed",
        "warning",
        "Your program is longer than the maximum protected period",
        `Your program or training date (${formatDate(targetActivityEnd)}) is later than the protected end date (${formatDate(
          coverageEnd
        )}). To stay in the United States past that date for study or training, you need an extension-of-stay plan before the protected period ends.`,
        ["8CFR-214-1-M1", "USCIS-G1055-I539"]
      )
    );
    nextActions.push("Map an extension-of-stay plan before the protected period expires.");
  } else if (coverageEnd) {
    findings.push(
      finding(
        "transition-covers-program",
        "good",
        "Your current I-20 fits inside the protected period",
        `The later I-20/EAD date in place on September 15, 2026 is not beyond the four-year cap, so this scenario does not show a program-level extension need before ${formatDate(
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
          `If you stay in the United States under the old-rule path, the departure period runs through ${formatDate(
            latestDepartureDate
          )}. If you make an ordinary F-1 return on ${formatDate(
            scenarioWithEffectiveDate.reentryDate
          )}, the fixed-period admission may run through ${formatDate(
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
          "What we can say now: staying in the United States preserves the old-rule branch. Add the return date and I-20 end date for the return to compare it with a fixed-period admission branch.",
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
    timeline(effectiveDate, "Rule effective date", "Old-rule protection is checked on this date."),
    timeline(transitionCapDate, "Four-year protection cap", "The protected D/S period ends no later than this date.", extensionNeeded ? "warning" : "neutral")
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
      timeline(coverageEnd, "Protected F-1 period ends", "Later effective-date document end, capped at four years.", extensionNeeded ? "warning" : "good"),
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
      ? `Old-rule F-1 protection through ${formatDate(coverageEnd)}`
      : "Old-rule protection needs document dates",
    coverageEnd
      ? `Your situation remains in the current-student old-rule path, with the F-1 departure period running through ${formatDate(
          latestDepartureDate
        )}.`
      : "Add the effective-date I-20 or EAD end date to turn the old-rule protection into a specific stay-through date.",
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

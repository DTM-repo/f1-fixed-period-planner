import { SOURCE_INDEX, source } from "../sources/sourceIndex";
import {
  addDays,
  addYears,
  daysBetween,
  formatDate,
  isAfter,
  isOnOrBefore,
  isValidDateString,
  maxDate,
  minDate,
  normalizeDateInput
} from "./dateMath";
import type { AppliedRule, Finding, PlannerResult, StudentScenario, TimelineItem } from "./types";

export const DEFAULT_EFFECTIVE_DATE = "2026-09-15";
export const F1_TRANSITION_DEPARTURE_PERIOD_DAYS = 60;
export const F1_FIXED_DEPARTURE_PERIOD_DAYS = 30;
export const OPT_TRANSITION_I765_DEADLINE = "2027-03-18";

export function postCompletionOptWindowOpens(scenario: StudentScenario): string | undefined {
  const programEnd = scenario.programEndOnEffectiveDate ?? scenario.currentProgramEndDate;
  return programEnd ? addDays(programEnd, -90) : undefined;
}

function hasTransitionOptPlan(scenario: StudentScenario): boolean {
  return scenario.optIntent === "yes" || (
    scenario.optStage !== "none" && scenario.optStage !== "pre_completion"
  );
}

const TRANSITION_RULE: AppliedRule = {
  id: "transition-ds-cap",
  label: "Protection for current F-1 students",
  summary:
    "A qualifying student who is in the United States in valid F-1 status with D/S on September 15, 2026 may remain under the old rules through the later I-20 or EAD end date in place that day, capped at September 15, 2030, plus 60 days.",
  sourceIds: ["8CFR-214-1-M1"]
};

const FIXED_ADMISSION_RULE: AppliedRule = {
  id: "fixed-admission-period",
  label: "Fixed F-1 admission period",
  summary:
    "A new F-1 admission or change of status uses the I-20 program dates, normally for no more than four years, followed by 30 days that are included on the I-94.",
  sourceIds: ["8CFR-214-1-A4", "FR-FOUR-YEAR-START", "8CFR-214-2-F5V"]
};

const OPT_TRANSITION_RULE: AppliedRule = {
  id: "transition-opt-filing",
  label: "Temporary OPT and STEM OPT filing rule",
  summary:
    "Some current students can file an I-765 by March 18, 2027 without filing an I-539 solely because the D/S rule changed, if every other timing requirement is met.",
  sourceIds: ["8CFR-214-1-M1-OPT"]
};

const ACADEMIC_MOBILITY_RULE: AppliedRule = {
  id: "academic-mobility",
  label: "New transfer and program-change limits",
  summary:
    "The rule restricts first-year undergraduate changes, graduate transfers and objective changes, and later same-level or lower-level study. DHS may delay these provisions through September 14, 2028.",
  sourceIds: ["8CFR-214-2-F5II", "8CFR-214-2-F5II-DELAY"]
};

const DATE_FIELDS: Array<[keyof StudentScenario, string, boolean?]> = [
  ["i94AdmitUntilDate", "I-94 admit-until date"],
  ["programStartDate", "I-20 program start date"],
  ["programEndOnEffectiveDate", "I-20 end date on September 15, 2026"],
  ["currentProgramEndDate", "current I-20 program end date"],
  ["eadEndOnEffectiveDate", "EAD end date on September 15, 2026"],
  ["currentEadEndDate", "current EAD end date"],
  ["optFilingDate", "I-765 filing date"],
  ["reentryDate", "entry or return date"],
  ["returnProgramStartDate", "returning I-20 program start date"],
  ["returnProgramEndDate", "returning I-20 program end date"],
  ["nextProgramStartDate", "next program start date"],
  ["nextProgramEndDate", "next program end date"],
  ["earlyEndDate", "early completion or withdrawal date"],
  ["effectiveDate", "rule effective date", true]
];

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

function uniqueSources(rules: AppliedRule[], findings: Finding[]) {
  const ids = new Set<string>(["FR-2026-FINAL-RULE"]);
  rules.forEach((rule) => rule.sourceIds.forEach((id) => ids.add(id)));
  findings.forEach((item) => item.sourceIds.forEach((id) => ids.add(id)));
  return [...ids].map((id) => SOURCE_INDEX[id]).filter(Boolean);
}

function statusFor(findings: Finding[], questions: string[], preferred: PlannerResult["status"]): PlannerResult["status"] {
  if (findings.some((item) => item.tone === "danger")) return "risk";
  if (questions.length || findings.some((item) => item.tone === "question")) return "manual";
  if (findings.some((item) => item.tone === "warning")) return "caution";
  return preferred;
}

function makeResult(
  scenario: StudentScenario,
  values: Omit<PlannerResult, "deterministic" | "effectiveDate" | "transitionCapDate" | "citations">
): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  return {
    deterministic: true,
    effectiveDate,
    transitionCapDate: addYears(effectiveDate, 4),
    ...values,
    citations: uniqueSources(values.appliedRules, values.findings)
  };
}

function normalizeScenarioDates(scenario: StudentScenario) {
  const normalizedScenario = { ...scenario };
  const writable = normalizedScenario as unknown as Record<string, string | undefined>;
  const findings: Finding[] = [];
  const followUpQuestions: string[] = [];
  const changes: string[] = [];

  for (const [field, label, useDefault] of DATE_FIELDS) {
    const raw = scenario[field];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = normalizeDateInput(raw);
    if (normalized.value) {
      writable[field] = normalized.value;
      if (normalized.normalized || normalized.value !== raw) changes.push(`${label}: ${formatDate(normalized.value)}`);
      continue;
    }
    if (useDefault) {
      writable[field] = DEFAULT_EFFECTIVE_DATE;
      followUpQuestions.push(`Confirm the ${label}. The published effective date is ${formatDate(DEFAULT_EFFECTIVE_DATE)}.`);
    } else {
      writable[field] = undefined;
      followUpQuestions.push(
        normalized.issue === "ambiguous"
          ? `Confirm the ${label} using the month name, day, and year.`
          : `Confirm the ${label}; that entry is not a valid calendar date.`
      );
    }
  }

  if (changes.length) {
    findings.push(
      finding(
        "date-input-normalized",
        "info",
        "Confirm these dates",
        `${changes.join("; ")}. Correct any date that does not match your document.`,
        []
      )
    );
  }
  if (followUpQuestions.length) {
    findings.push(
      finding(
        "date-confirmation-needed",
        "question",
        "A date needs your confirmation",
        "Use the month name, day, and year shown on your document.",
        []
      )
    );
  }
  return { scenario: normalizedScenario, findings, followUpQuestions };
}

function fixedLimitYears(scenario: StudentScenario): number {
  if (scenario.programType === "english_language_training") return 2;
  if (scenario.programType === "public_high_school") return 1;
  return 4;
}

function fixedProgramLabel(scenario: StudentScenario): string {
  if (scenario.programType === "english_language_training") return "24-month English-language-study limit";
  if (scenario.programType === "public_high_school") return "12-month public-high-school limit";
  return "four-year maximum";
}

function dateDefinitelyBefore(value: string | undefined, comparison: string): boolean {
  if (!value) return false;
  if (isValidDateString(value)) return value < comparison;
  if (/^\d{4}-\d{2}$/.test(value)) return value < comparison.slice(0, 7);
  return /^\d{4}$/.test(value) && value < comparison.slice(0, 4);
}

export function scenarioForFixedReentry(scenario: StudentScenario): StudentScenario {
  const hasDifferentI20 = scenario.reentryBasis === "longer_program_i20";
  return {
    ...scenario,
    startingPosition: "readmitted_fixed_period",
    admissionBasis: "fixed_period",
    inUsOnEffectiveDate: "no",
    maintainingStatusOnEffectiveDate: "unknown",
    programStartDate: hasDifferentI20 ? scenario.returnProgramStartDate : scenario.programStartDate,
    currentProgramEndDate: hasDifferentI20 ? scenario.returnProgramEndDate : scenario.currentProgramEndDate
  };
}

function addAcademicFindings(scenario: StudentScenario, findings: Finding[], nextActions: string[]) {
  const hasLevel = scenario.educationLevel && scenario.educationLevel !== "unknown";
  const hasPlan = scenario.schoolTransferPlan === "yes" || scenario.academicProgramChangePlan === "yes";
  if (!hasLevel && !hasPlan && scenario.nextProgramLevelPlan !== "same_or_lower") return;

  findings.push(
    finding(
      "academic-rules-status",
      "info",
      "These school-change rules are scheduled to begin September 15, 2026",
      "DHS may delay or suspend these particular restrictions through September 14, 2028. This status was last checked on July 19, 2026; no delay announcement had been published.",
      ["8CFR-214-2-F5II-DELAY"]
    )
  );

  const completedBeforeRule = dateDefinitelyBefore(
    scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint,
    scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE
  );

  if (scenario.educationLevel === "graduate" && !completedBeforeRule) {
    findings.push(
      finding(
        "graduate-objective-limit",
        scenario.academicProgramChangePlan === "yes" ? "danger" : "info",
        "You cannot change your graduate educational objective during the program",
        "The new rule does not allow an F-1 student at the graduate level or above to change a major or educational level during the program.",
        ["8CFR-214-2-F5II-GRADUATE"]
      )
    );
    findings.push(
      finding(
        "graduate-transfer-limit",
        scenario.schoolTransferPlan === "yes" ? "warning" : "info",
        "A graduate transfer requires an SEVP exception",
        "The new rule does not allow a graduate-level school transfer unless SEVP authorizes an exception for extenuating circumstances.",
        ["8CFR-214-2-F5II-GRADUATE"]
      )
    );
    if (scenario.schoolTransferPlan === "yes") nextActions.push("Ask your DSO whether your facts could support an SEVP exception before planning the transfer.");
  }

  if (scenario.educationLevel === "undergraduate") {
    if (!hasPlan) {
      findings.push(
        finding(
          "undergraduate-first-year-rule",
          "info",
          "Your first academic year limits school and program changes",
          "As an undergraduate student, during your first academic year you cannot transfer schools or change your major or education level unless SEVP authorizes an exception for extenuating circumstances.",
          ["8CFR-214-2-F5II"]
        )
      );
    } else if (scenario.firstAcademicYearCompleted === "yes") {
      findings.push(
        finding(
          "undergraduate-first-year-complete",
          "good",
          "The new first-year restriction does not block this timing",
          "You will have completed your first academic year before the planned change. Other transfer or program-change requirements still apply.",
          ["8CFR-214-2-F5II"]
        )
      );
    } else if (scenario.firstAcademicYearCompleted === "no") {
      findings.push(
        finding(
          "undergraduate-first-year-block",
          "danger",
          scenario.schoolTransferPlan === "yes" ? "You cannot transfer during your first academic year" : "You cannot make this program change during your first academic year",
          "SEVP can authorize an exception for extenuating circumstances, but the rule is that the change is not allowed during the first academic year.",
          ["8CFR-214-2-F5II"]
        )
      );
    } else {
      findings.push(
        finding(
          "undergraduate-first-year-needed",
          "question",
          "The timing of your first academic year matters",
          "Confirm whether you will have completed one academic year before the transfer or program change.",
          ["8CFR-214-2-F5II"]
        )
      );
    }
  }

  if (scenario.nextProgramLevelPlan === "same_or_lower") {
    const completedAfterRule = scenario.currentProgramEndDate && isAfter(scenario.currentProgramEndDate, scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE);
    findings.push(
      finding(
        "same-or-lower-next-program",
        completedAfterRule ? "danger" : completedBeforeRule ? "good" : "warning",
        completedBeforeRule ? "Your earlier completion does not trigger the new same-level bar" : "A same-level or lower-level next program is blocked after a post-rule completion",
        completedAfterRule
          ? `Because your current program ends after September 15, 2026, the rule does not allow you to remain in, be admitted in, or receive F-1 status for a later program at the same or a lower education level.`
          : completedBeforeRule
            ? "The new restriction counts programs completed after September 15, 2026. A program completed before that date does not count toward this limit."
            : "This restriction applies when the earlier U.S. F-1 program is completed after September 15, 2026. Confirm the earlier completion date before relying on this plan.",
        ["8CFR-214-2-F5II-SAME-LOWER"]
      )
    );
  }
}

function addCptFindings(
  scenario: StudentScenario,
  activityEnd: string | undefined,
  stayEnd: string | undefined,
  departurePeriodDays: number,
  findings: Finding[],
  nextActions: string[]
) {
  if (scenario.cptPlan === "none") return;
  const programContinues = Boolean(
    scenario.currentProgramEndDate &&
    activityEnd &&
    isAfter(scenario.currentProgramEndDate, activityEnd)
  );

  if (scenario.cptPlan === "unknown") {
    if (programContinues && activityEnd) {
      findings.push(
        finding(
          "cpt-plan-needed",
          "question",
          `CPT could make ${formatDate(activityEnd)} an important filing date`,
          `If you will have CPT authorized beyond ${formatDate(activityEnd)}, USCIS must receive your complete extension request before that date for the already-authorized CPT to continue automatically while the request is pending. CPT can never continue beyond the end date authorized by your DSO.`,
          ["8CFR-214-2-F5VIII-CPT", "8CFR-214-2-F7-TIMELY"]
        )
      );
    }
    return;
  }

  if (!programContinues) {
    findings.push(
      finding(
        "cpt-within-program",
        "info",
        "Your CPT remains tied to your program dates",
        `CPT can continue only through the end date authorized by your DSO and cannot continue past your I-20 program end date${scenario.currentProgramEndDate ? ` of ${formatDate(scenario.currentProgramEndDate)}` : ""}. The new rule does not create an earlier CPT deadline in your situation.`,
        ["8CFR-214-2-F5VIII-CPT"]
      )
    );
    return;
  }

  findings.push(
    finding(
      "cpt-extension-filing-deadline",
      "warning",
      `File before ${formatDate(activityEnd!)} to avoid a CPT interruption`,
      `Your I-20 program continues beyond ${formatDate(activityEnd!)}. If your DSO has authorized CPT beyond that date, USCIS must receive your complete Form I-539 before ${formatDate(activityEnd!)} for the already-authorized CPT to continue automatically while the request is pending. That continuation lasts no more than 240 days and ends sooner if your CPT authorization ends. Filing after ${formatDate(activityEnd!)} during the following ${departurePeriodDays}-day departure period${stayEnd ? ` through ${formatDate(stayEnd)}` : ""} does not automatically preserve CPT.`,
      ["8CFR-214-2-F5VIII-CPT", "8CFR-214-2-F7-TIMELY"]
    )
  );
  nextActions.push(`If uninterrupted CPT matters, have USCIS receive the complete extension request before ${formatDate(activityEnd!)}.`);
}

function addTravelAndDependentFindings(scenario: StudentScenario, findings: Finding[], nextActions: string[]) {
  if (scenario.travelPosture === "automatic_visa_revalidation" || scenario.reentryBasis === "automatic_visa_revalidation") {
    findings.push(
      finding(
        "automatic-visa-revalidation",
        "question",
        "Automatic visa revalidation needs a separate travel review",
        "Do not use the ordinary return projection for this trip until your itinerary, visa history, destination, and eligibility for automatic visa revalidation are confirmed.",
        ["8CFR-214-1-A4", "8CFR-214-1-C8"]
      )
    );
  }
  if (scenario.travelPosture !== "none" && scenario.pendingExtensionOnDeparture === "yes") {
    findings.push(
      finding(
        "pending-extension-travel",
        scenario.reentryBasis === "longer_program_i20" ? "danger" : "warning",
        "Travel after filing an extension of stay can change the case",
        scenario.reentryBasis === "longer_program_i20"
          ? "If you leave after filing Form I-539 and return seeking more time than remained on your prior admission, USCIS can treat that extension request as abandoned."
          : "USCIS does not automatically treat the extension request as abandoned only when your prior admission remains unexpired and you return seeking its remaining balance. Carry the receipt notice and valid I-20.",
        ["8CFR-214-1-C8"]
      )
    );
  }
  if (scenario.startingPosition === "change_status_inside_us" && scenario.travelPosture !== "none" && scenario.travelPosture !== "unknown") {
    findings.push(
      finding(
        "pending-change-status-travel",
        "danger",
        "Leaving while a change-of-status request is pending abandons that request",
        "If you leave the United States while your request to change to F-1 status is pending, DHS treats the change-of-status request as abandoned.",
        ["8CFR-214-1-C8"]
      )
    );
  }
  if (scenario.hasF2Dependents === "yes") {
    findings.push(
      finding(
        "f2-dependent-period",
        "info",
        "Your F-2 dependents cannot receive a longer period than you",
        "Include your spouse or children in the extension strategy. They must be included in your request or file their own timely extension requests, as applicable.",
        ["8CFR-214-2-F5-EXCEPTIONS", "8CFR-214-2-F7"]
      )
    );
    nextActions.push("Include every F-2 dependent in the filing plan and check each dependent's I-94.");
  }
}

function addEarlyEndFinding(scenario: StudentScenario, findings: Finding[], timelineItems: TimelineItem[]) {
  if (!scenario.earlyEndSituation || scenario.earlyEndSituation === "none") return;
  if (!scenario.earlyEndDate) {
    findings.push(
      finding(
        "early-end-date-needed",
        "question",
        "The actual end date is needed",
        "An early completion, authorized withdrawal, or status violation can shorten the date shown on the ordinary timeline.",
        ["8CFR-214-2-F5V"]
      )
    );
    return;
  }
  if (scenario.earlyEndSituation === "completed_early") {
    const end = addDays(scenario.earlyEndDate, 30);
    findings.push(finding("completed-early", "warning", "Early completion starts a new 30-day period", `You must leave or take action to maintain lawful status by ${formatDate(end)}.`, ["8CFR-214-2-F5V"]));
    timelineItems.push(timeline(end, "Early-completion deadline", "Thirty days after you actually finish.", "warning"));
  } else if (scenario.earlyEndSituation === "authorized_withdrawal") {
    const end = addDays(scenario.earlyEndDate, 15);
    findings.push(finding("authorized-withdrawal", "warning", "Authorized withdrawal gives you 15 days", `You must leave the United States by ${formatDate(end)}.`, ["8CFR-214-2-F5V"]));
    timelineItems.push(timeline(end, "Withdrawal departure date", "Fifteen days after the authorized withdrawal.", "warning"));
  } else if (scenario.earlyEndSituation === "status_violation") {
    findings.push(finding("status-violation", "danger", "There is no departure period after a status violation", "The rule says you must leave immediately. Speak with your DSO and qualified immigration counsel now.", ["8CFR-214-2-F5V"]));
  }
}

function addOptFindings(
  scenario: StudentScenario,
  activityEnd: string | undefined,
  latestDepartureDate: string | undefined,
  findings: Finding[],
  nextActions: string[]
) {
  if (scenario.optStage === "none") {
    if (scenario.optIntent === "yes") {
      findings.push(
        finding(
          "future-opt-plan",
          "info",
          "OPT begins with regular post-completion OPT",
          "STEM OPT, if you qualify later, is a 24-month extension after regular post-completion OPT.",
          ["USCIS-OPT-STEM"]
        )
      );
    }
    return;
  }
  if (scenario.optStage === "pre_completion") return;
  const isStem = scenario.optStage.startsWith("stem");
  const isApproved = scenario.optStage.endsWith("approved");
  const isPending = scenario.optStage.endsWith("pending");
  const isNotFiled = scenario.optStage.endsWith("not_filed");

  if (scenario.startingPosition !== "current_ds_inside_us") {
    findings.push(
      finding(
        "fixed-opt-separate-period",
        "info",
        "OPT or STEM OPT uses a separate fixed-period date",
        "An OPT return can depend on the EAD end date, a pending I-765 receipt, and the employment end date recommended by your DSO. Confirm those dates before relying on a projected I-94 date.",
        ["8CFR-214-2-F5-EXCEPTIONS"]
      )
    );
    return;
  }

  if ((isNotFiled || isPending) && scenario.dsoRecommendedOpt !== "yes") {
    findings.push(
      finding(
        "opt-dso-recommendation-needed",
        "question",
        "Get your DSO's OPT recommendation before filing",
        "Your DSO must recommend post-completion OPT or STEM OPT in SEVIS first. If you stay in the United States under D/S and submit your I-765 on time, the new rule does not by itself require a separate Form I-539 with that OPT filing.",
        ["8CFR-214-1-M1-OPT"]
      )
    );
  }

  if (isApproved) {
    const eadEnd = scenario.currentEadEndDate ?? scenario.eadEndOnEffectiveDate;
    if (eadEnd) {
      findings.push(
        finding(
          "approved-opt-through-ead",
          "good",
          `An approval can keep you in F-1 status through ${formatDate(addDays(eadEnd, 60))}`,
          `For a qualifying transition filing, approval permits F-1 stay through the EAD end date of ${formatDate(eadEnd)}, plus 60 days.`,
          ["8CFR-214-1-M1-OPT"]
        )
      );
    } else {
      findings.push(finding("approved-opt-ead-needed", "question", "Confirm the EAD end date", `The EAD end date determines how long approved OPT or STEM OPT extends your F-1 stay${activityEnd ? `. Your confirmed protection currently runs through ${formatDate(activityEnd)}` : ""}.`, ["8CFR-214-1-M1-OPT"]));
    }
    return;
  }

  if (!scenario.optFilingDate) {
    findings.push(
      finding(
        "opt-filing-date-needed",
        "question",
        "Your I-765 filing date controls the transition OPT path",
        `If you stay in the United States and do not return after September 15, submit your I-765 by March 18, 2027${latestDepartureDate ? ` and before your current D/S timeline ends on ${formatDate(latestDepartureDate)}` : ""}. Filing on time can let you use the transition OPT path without a separate Form I-539 solely because D/S ended.`,
        ["8CFR-214-1-M1-OPT"]
      )
    );
    return;
  }

  const normalWindowOpens = isStem
    ? scenario.currentEadEndDate ? addDays(scenario.currentEadEndDate, -90) : undefined
    : postCompletionOptWindowOpens(scenario);
  if (normalWindowOpens && isAfter(normalWindowOpens, scenario.optFilingDate)) {
    findings.push(
      finding(
        "opt-before-normal-window",
        "danger",
        "This filing date is before the normal OPT window opens",
        `${formatDate(scenario.optFilingDate)} is before the ordinary filing window opens on ${formatDate(normalWindowOpens)}. Choose a date within the normal filing window and within every transition deadline that applies.`,
        ["USCIS-OPT-STEM", "8CFR-214-1-M1-OPT"]
      )
    );
    return;
  }

  if (isAfter(scenario.optFilingDate, OPT_TRANSITION_I765_DEADLINE)) {
    findings.push(finding("opt-after-march-deadline", "danger", "This filing date misses the special transition deadline", `${formatDate(scenario.optFilingDate)} is after March 18, 2027. You cannot use the transition OPT path that avoids a separate Form I-539 solely because D/S ended.`, ["8CFR-214-1-M1-OPT"]));
    return;
  }
  if (latestDepartureDate && isAfter(scenario.optFilingDate, latestDepartureDate) && !isStem) {
    findings.push(finding("opt-after-status-deadline", "danger", "This post-completion OPT filing is too late for the transition path", `Submit the I-765 before your current D/S timeline ends on ${formatDate(latestDepartureDate)}.`, ["8CFR-214-1-M1-OPT"]));
    return;
  }
  if (isStem && scenario.currentEadEndDate && isAfter(scenario.optFilingDate, scenario.currentEadEndDate)) {
    findings.push(finding("stem-after-ead", "danger", "This STEM OPT filing date is after the current EAD ends", `Submit the STEM OPT I-765 before the current EAD expires on ${formatDate(scenario.currentEadEndDate)}.`, ["8CFR-214-1-M1-OPT"]));
    return;
  }
  if (isStem && !scenario.currentEadEndDate) {
    findings.push(finding("stem-current-ead-needed", "question", "Add your current OPT EAD end date", "STEM OPT must be filed before the current OPT EAD expires and by March 18, 2027.", ["8CFR-214-1-M1-OPT"]));
    return;
  }

  findings.push(
    finding(
      "opt-filing-in-window",
      "good",
      "This filing date fits the stay-in-the-U.S. OPT path",
      `${formatDate(scenario.optFilingDate)} is on or before March 18, 2027 and meets the confirmed transition deadlines. If you stay in the United States, you can avoid a separate Form I-539 solely because D/S ended, provided your DSO recommendation and all normal OPT requirements are met.`,
      ["8CFR-214-1-M1-OPT"]
    )
  );
  if (scenario.travelPosture !== "none" && isNotFiled) {
    findings.push(finding("opt-travel-before-filing", "danger", "File timing and travel can change which OPT process you use", "If you leave before filing and then return under the fixed-period system, plan for both the I-765 and Form I-539 requirements. Before you travel, ask your DSO to compare that path with getting the OPT recommendation and filing while you are still in the United States.", ["8CFR-214-1-M1-OPT"]));
    nextActions.push("Before traveling, compare filing the I-765 in the United States with the documents required after a fixed-period return.");
  }
}

function addTransitionOptTimeline(
  scenario: StudentScenario,
  latestDepartureDate: string,
  timelineItems: TimelineItem[]
) {
  const isStem = scenario.optStage.startsWith("stem");
  if (!hasTransitionOptPlan(scenario) || scenario.optStage.endsWith("approved")) return;

  const normalWindowOpens = isStem
    ? scenario.currentEadEndDate ? addDays(scenario.currentEadEndDate, -90) : undefined
    : postCompletionOptWindowOpens(scenario);
  if (normalWindowOpens) {
    timelineItems.push(
      timeline(
        normalWindowOpens,
        isStem ? "STEM OPT filing window opens" : "Post-completion OPT filing window opens",
        `${isStem ? "This is 90 days before your current OPT EAD ends." : "This is 90 days before your I-20 program ends."} Your DSO must recommend OPT before you submit Form I-765.`,
        "neutral"
      )
    );
  }

  const pathDeadline = minDate(
    OPT_TRANSITION_I765_DEADLINE,
    latestDepartureDate,
    isStem ? scenario.currentEadEndDate : undefined
  )!;
  const windowOpensTooLate = Boolean(normalWindowOpens && isAfter(normalWindowOpens, pathDeadline));
  const existingDeadlineEvent = timelineItems.find((item) => item.date === pathDeadline);
  const deadlineDetail = windowOpensTooLate
    ? `The temporary Form I-539 exception closes before your normal filing window opens${normalWindowOpens ? ` on ${formatDate(normalWindowOpens)}` : ""}, so it is not available for this OPT filing.`
    : pathDeadline === OPT_TRANSITION_I765_DEADLINE
      ? "After your DSO recommends OPT, submit Form I-765 by this date and while the old rules still cover you to avoid Form I-539 solely because the rule changed."
      : `Your old-rule stay or current EAD ends before March 18, 2027. Submit Form I-765 by this earlier date, after your DSO recommendation, to avoid Form I-539 solely because the rule changed.`;

  if (existingDeadlineEvent) {
    existingDeadlineEvent.detail = `${existingDeadlineEvent.detail} ${deadlineDetail}`;
    existingDeadlineEvent.tone = "warning";
  } else {
    timelineItems.push(
      timeline(
        pathDeadline,
        windowOpensTooLate ? "Form I-539 exception closes" : "Deadline to avoid Form I-539 for OPT",
        deadlineDetail,
        "warning"
      )
    );
  }

  if (scenario.optFilingDate) {
    const beforeNormalWindow = Boolean(normalWindowOpens && isAfter(normalWindowOpens, scenario.optFilingDate));
    const afterTransitionDeadline = isAfter(scenario.optFilingDate, pathDeadline);
    const filingFits =
      !beforeNormalWindow && !afterTransitionDeadline;
    timelineItems.push(
      timeline(
        scenario.optFilingDate,
        scenario.optStage.endsWith("pending") ? "Form I-765 submitted" : "Planned Form I-765 filing",
        filingFits
          ? "This date is within your normal filing window and no later than the deadline to avoid Form I-539 solely because the rule changed."
          : beforeNormalWindow
            ? `This date is before your normal filing window opens on ${formatDate(normalWindowOpens)}.`
            : `This date is after the ${formatDate(pathDeadline)} deadline for this OPT path.`,
        filingFits ? "good" : "danger"
      )
    );
  }
}

function buildFixedResult(
  scenario: StudentScenario,
  baseFindings: Finding[],
  baseQuestions: string[]
): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  const findings = [...baseFindings];
  const questions = [...baseQuestions];
  const actions: string[] = [];
  const rules = [FIXED_ADMISSION_RULE];
  const maxYears = fixedLimitYears(scenario);
  const programCap = scenario.programStartDate ? addYears(scenario.programStartDate, maxYears) : undefined;
  const projectedActivityEnd = scenario.currentProgramEndDate && programCap ? minDate(scenario.currentProgramEndDate, programCap) : undefined;
  const actualI94 = scenario.i94AdmitUntilDate;
  const activityEnd = actualI94 ? addDays(actualI94, -F1_FIXED_DEPARTURE_PERIOD_DAYS) : projectedActivityEnd;
  const i94End = actualI94 ?? (activityEnd ? addDays(activityEnd, F1_FIXED_DEPARTURE_PERIOD_DAYS) : undefined);
  const extensionNeeded = Boolean(activityEnd && scenario.currentProgramEndDate && isAfter(scenario.currentProgramEndDate, activityEnd));
  const isReentry = scenario.startingPosition === "readmitted_fixed_period";
  const isChangeOfStatus = scenario.startingPosition === "change_status_inside_us";

  if (!actualI94 && !scenario.programStartDate) questions.push("What program start date is on the I-20?");
  if (!actualI94 && !scenario.currentProgramEndDate) questions.push("What program end date is on the I-20?");
  if (!scenario.programType || scenario.programType === "unknown") {
    questions.push("Is this a college or university program, English-language training, or high school?");
  }

  const timelineItems: TimelineItem[] = [];
  if (scenario.programStartDate) timelineItems.push(timeline(scenario.programStartDate, "Program starts", "The four-year maximum is measured from this I-20 date."));
  if (scenario.reentryDate) timelineItems.push(timeline(scenario.reentryDate, isReentry ? "You return to the United States" : "You enter in F-1 status", "CBP issues the controlling I-94 at entry."));
  if (activityEnd) timelineItems.push(timeline(activityEnd, "Program or approved training ends", actualI94 ? "This is 30 days before your I-94 end date." : `Earlier of the I-20 end and the ${fixedProgramLabel(scenario)}.`, extensionNeeded ? "warning" : "good"));
  if (i94End) timelineItems.push(timeline(i94End, actualI94 ? "Your I-94 ends" : "Projected I-94 end date", "This date already includes the final 30 days to leave or take another action to maintain lawful status.", extensionNeeded ? "warning" : "neutral"));

  if (scenario.reentryDate && scenario.programStartDate) {
    const lead = daysBetween(scenario.reentryDate, scenario.programStartDate);
    if (lead > 30) findings.push(finding("entry-more-than-thirty-days-early", "danger", "This entry date is more than 30 days before the program starts", `The ordinary F-1 rule permits entry up to 30 days before the I-20 program start date. These dates are ${lead} days apart.`, ["8CFR-214-1-A4"]));
  }

  if (scenario.reentryDate && activityEnd && isAfter(scenario.reentryDate, activityEnd)) {
    findings.push(
      finding(
        "entry-after-authorized-study-end",
        "danger",
        "These I-20 dates do not support this entry",
        `Your entry date is ${formatDate(scenario.reentryDate)}, after the projected study or training period ends on ${formatDate(activityEnd)}. A return does not add four years from the travel date. Before traveling, obtain an I-20 whose program dates support the requested admission and confirm the plan with your DSO. CBP decides the period issued at entry.`,
        ["8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
      )
    );
  }

  if (actualI94) {
    findings.push(
      finding(
        "actual-i94-controls",
        "info",
        "Your I-94 date controls your stay",
        `Your I-94 ends ${formatDate(actualI94)}. That date already includes the final 30 days; your authorized stay does not continue for another 30 days beyond it.`,
        ["8CFR-214-2-F5V"]
      )
    );
  } else if (activityEnd && i94End) {
    findings.push(
      finding(
        "projected-fixed-date",
        extensionNeeded ? "warning" : "good",
        `Your projected I-94 date is ${formatDate(i94End)}`,
        `The projected study or training period ends ${formatDate(activityEnd)}. The I-94 should include 30 more days, through ${formatDate(i94End)}. Check the actual I-94 after admission because the issued document controls.`,
        ["8CFR-214-1-A4", "FR-FOUR-YEAR-START", "8CFR-214-2-F5V"]
      )
    );
  }

  if (extensionNeeded && activityEnd && i94End && scenario.currentProgramEndDate) {
    findings.push(
      finding(
        "fixed-extension-needed",
        "warning",
        "Your program continues after the first fixed period",
        `Your I-20 ends ${formatDate(scenario.currentProgramEndDate)}, after the projected study period ends ${formatDate(activityEnd)}. To continue, work with your DSO on either a timely Form I-539 extension or departure and readmission with an updated I-20. USCIS must receive a complete I-539 by ${formatDate(i94End)}. File before ${formatDate(activityEnd)} if you need already-authorized CPT or other F-1 employment to continue while the request is pending. A return does not automatically add four years from the travel date; the I-20 program dates and the I-94 issued by CBP control.`,
        ["8CFR-214-2-F7", "8CFR-214-2-F7-TIMELY"]
      )
    );
    actions.push("Before the study or training period ends, ask your DSO to compare a Form I-539 extension with departure and readmission on an updated I-20.");
    actions.push("Budget for the current I-539 filing fee and possible biometrics; premium processing is not currently promised for this extension category.");
    findings.push(
      finding(
        "extension-process-details",
        "info",
        "The extension is a USCIS application, not only an I-20 update",
        "The filing requires Form I-539, a properly endorsed new I-20, financial evidence, the filing fee, and any biometrics USCIS requires. The current general I-539 fee is $420 online or $470 on paper. Premium processing is not currently promised for this extension category.",
        ["8CFR-214-2-F7", "USCIS-G1055-I539"]
      )
    );
  }

  if (scenario.programType === "english_language_training") {
    findings.push(finding("elt-two-year-limit", "warning", "English-language training is limited to 24 months", "The fixed-period rule uses a 24-month aggregate maximum for English-language study, followed by 30 days included on the I-94.", ["8CFR-214-2-F5-EXCEPTIONS"]));
  }
  if (scenario.programType === "public_high_school") {
    findings.push(finding("public-high-school-limit", "warning", "Public high school is limited to 12 months in total", "The 12-month limit includes school breaks and annual vacations and applies across public high schools.", ["8CFR-214-2-F5-EXCEPTIONS"]));
  }

  addAcademicFindings(scenario, findings, actions);
  if (findings.some((item) => item.id.startsWith("graduate-") || item.id.startsWith("undergraduate-") || item.id === "same-or-lower-next-program")) rules.push(ACADEMIC_MOBILITY_RULE);
  addCptFindings(scenario, activityEnd, i94End, F1_FIXED_DEPARTURE_PERIOD_DAYS, findings, actions);
  addTravelAndDependentFindings(scenario, findings, actions);
  addEarlyEndFinding(scenario, findings, timelineItems);
  addOptFindings(scenario, activityEnd, i94End, findings, actions);

  const status = statusFor(findings, questions, extensionNeeded ? "caution" : "ok");
  const headline = i94End
    ? `${actualI94 ? "Your I-94 ends" : "Your projected I-94 would end"} ${formatDate(i94End)}`
    : "You will have a fixed F-1 end date instead of D/S";
  const summary = i94End
    ? `Your study or training period runs through ${formatDate(activityEnd)}, followed by 30 days already included in the ${formatDate(i94End)} I-94 date.`
    : "Your I-94 will show a specific admit-until date determined by your I-20 program start and end dates.";

  return makeResult(scenario, {
    classification: isChangeOfStatus ? "change_of_status_fixed_period" : isReentry ? "fixed_period_reentry" : "incoming_fixed_period",
    status,
    headline,
    summary,
    activityEnd,
    coverageEnd: activityEnd,
    i94AdmitUntilDate: i94End,
    departurePeriodDays: i94End ? 30 : undefined,
    latestDepartureDate: i94End,
    extensionPlanningDate: extensionNeeded ? activityEnd : undefined,
    extensionFilingDeadline: extensionNeeded ? i94End : undefined,
    extensionNeededBy: extensionNeeded ? i94End : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE,
    appliedRules: rules,
    findings,
    timeline: timelineItems.sort((a, b) => (a.date > b.date ? 1 : -1)),
    followUpQuestions: [...new Set(questions)],
    nextActions: [...new Set(actions)]
  });
}

function buildClarificationResult(
  scenario: StudentScenario,
  findings: Finding[],
  questions: string[],
  headline: string,
  summary: string
): PlannerResult {
  const effectiveDate = scenario.effectiveDate ?? DEFAULT_EFFECTIVE_DATE;
  return makeResult(scenario, {
    classification: "manual_review",
    status: "manual",
    headline,
    summary,
    appliedRules: [TRANSITION_RULE, FIXED_ADMISSION_RULE],
    findings,
    timeline: [timeline(effectiveDate, "The new rule begins", "Your location and valid F-1 status on this date determine which rules apply.", "warning")],
    followUpQuestions: [...new Set(questions)],
    nextActions: []
  });
}

export function calculateScenario(input: StudentScenario): PlannerResult {
  const normalized = normalizeScenarioDates(input);
  const effectiveDate = normalized.scenario.effectiveDate && isValidDateString(normalized.scenario.effectiveDate)
    ? normalized.scenario.effectiveDate
    : DEFAULT_EFFECTIVE_DATE;
  const scenario = { ...normalized.scenario, effectiveDate };

  if (
    scenario.inUsOnEffectiveDate === "no" &&
    scenario.reentryDate &&
    isOnOrBefore(scenario.reentryDate, effectiveDate) &&
    scenario.departBeforeEffectiveDate !== "yes"
  ) {
    const findings = [
      ...normalized.findings,
      finding(
        "future-entry-before-effective-date-contradiction",
        "question",
        "Your entry date and September 15 location conflict",
        `An F-1 entry on ${formatDate(scenario.reentryDate)} would place you in the United States on September 15, 2026 unless you leave again before that day.`,
        ["8CFR-214-1-M1"]
      )
    ];
    return buildClarificationResult(
      scenario,
      findings,
      [...normalized.followUpQuestions, "Will you leave the United States before September 15, 2026?"],
      "Will you leave before September 15?",
      "An entry before September 15 and a departure before September 15 lead to different rules."
    );
  }

  if (
    scenario.inUsOnEffectiveDate === "no" &&
    scenario.departBeforeEffectiveDate === "yes" &&
    scenario.reentryDate &&
    isOnOrBefore(scenario.reentryDate, effectiveDate)
  ) {
    return buildClarificationResult(
      scenario,
      [
        ...normalized.findings,
        finding(
          "post-rule-return-date-needed",
          "question",
          "Add the date you will return after September 15",
          `An F-1 entry on ${formatDate(scenario.reentryDate)} followed by departure before the rule starts does not begin the fixed-period timeline. Your next F-1 admission after September 15 does.`,
          ["8CFR-214-1-A4"]
        )
      ],
      [...normalized.followUpQuestions, "When will you next enter the United States in F-1 status after September 15, 2026?"],
      "Your post-rule return date is still needed",
      "Your next F-1 admission after September 15 determines the fixed-period path."
    );
  }

  if (
    (scenario.startingPosition === "current_ds_inside_us" || scenario.inUsOnEffectiveDate === "yes") &&
    scenario.returningAfterEffectiveDate === "yes" &&
    scenario.reentryDate &&
    isOnOrBefore(scenario.reentryDate, effectiveDate)
  ) {
    const findings = [
      ...normalized.findings,
      finding(
        "return-date-before-effective-date-contradiction",
        "question",
        "Your return date conflicts with your travel answer",
        `You said this trip brings you back after September 15, 2026, but the return date entered is ${formatDate(scenario.reentryDate)}.`,
        ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      )
    ];
    return buildClarificationResult(
      scenario,
      findings,
      [...normalized.followUpQuestions, "What date will you return after September 15, 2026?"],
      "Correct the return date",
      "The return must be after September 15, 2026 for this travel branch to apply."
    );
  }

  const fixedPath =
    scenario.startingPosition === "prospective_outside_us" ||
    scenario.startingPosition === "change_status_inside_us" ||
    scenario.startingPosition === "readmitted_fixed_period" ||
    scenario.admissionBasis === "fixed_period";
  if (fixedPath) return buildFixedResult(scenario, normalized.findings, normalized.followUpQuestions);

  if (
    scenario.startingPosition === "unknown" ||
    scenario.inUsOnEffectiveDate === "unknown" ||
    scenario.maintainingStatusOnEffectiveDate === "unknown"
  ) {
    const questions = [...normalized.followUpQuestions];
    if (scenario.inUsOnEffectiveDate === "unknown") questions.push("Will you be in the United States in valid F-1 status on September 15, 2026?");
    if (scenario.maintainingStatusOnEffectiveDate === "unknown" && scenario.inUsOnEffectiveDate === "yes") questions.push("Will your F-1 status still be valid on September 15, 2026?");
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("first-branch-needed", "question", "Your September 15 situation decides which rules apply", "Old D/S protection requires you to be in the United States in valid F-1 status on September 15, 2026.", ["8CFR-214-1-M1"])],
      questions,
      "Start with September 15, 2026",
      "Valid F-1 status in the United States on September 15 keeps the old D/S path available; otherwise the fixed-period rules apply."
    );
  }

  if (
    scenario.inUsOnEffectiveDate !== "yes" ||
    scenario.maintainingStatusOnEffectiveDate !== "yes" ||
    scenario.admissionBasis !== "duration_of_status"
  ) {
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("transition-not-established", "question", "The old-rule protection is not established yet", "It requires you to be in the United States in valid F-1 status with D/S on your I-94 when the rule begins.", ["8CFR-214-1-M1"])],
      [...normalized.followUpQuestions, "Confirm what your I-94 says and whether your F-1 status will be valid on September 15, 2026."],
      "Confirm your September 15 documents",
      "Old-rule protection requires valid F-1 status in the United States and D/S on your I-94 on September 15, 2026."
    );
  }

  const effectiveDocumentEnd = maxDate(scenario.programEndOnEffectiveDate, scenario.eadEndOnEffectiveDate);
  if (!effectiveDocumentEnd) {
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("effective-document-date-needed", "question", "Confirm the I-20 end date active on September 15", "Your active I-20 end date determines how long the old rules protect you. If you will have an approved EAD that day, its end date also matters.", ["8CFR-214-1-M1"])],
      [...normalized.followUpQuestions, "What program end date will be on your active I-20 on September 15, 2026?"],
      "You remain under the old rules",
      "Your active I-20 or approved EAD end date on September 15 determines when that protection ends."
    );
  }

  if (isAfter(effectiveDate, effectiveDocumentEnd)) {
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("document-ends-before-effective-date", "question", "Confirm what will keep you in F-1 status on September 15", `The document date of ${formatDate(effectiveDocumentEnd)} is before the rule begins. A later I-20, approved OPT EAD, or approved STEM OPT EAD is needed to establish valid F-1 status on September 15.`, ["8CFR-214-1-M1"])],
      [...normalized.followUpQuestions, "Will you have a later I-20, post-completion OPT, or STEM OPT on September 15, 2026?"],
      "Your current document ends before the rule begins",
      "A document covering September 15 is required for the old D/S protection."
    );
  }

  const transitionCap = addYears(effectiveDate, 4);
  let activityEnd = minDate(effectiveDocumentEnd, transitionCap)!;
  let latestDepartureDate = addDays(activityEnd, F1_TRANSITION_DEPARTURE_PERIOD_DAYS);
  const findings: Finding[] = [
    ...normalized.findings,
    finding(
      "transition-protection",
      "good",
      "You remain under the old rules",
      `This is the old duration-of-status system, shown as D/S on most current F-1 I-94 records. If you remain in the United States and do not travel, your protection continues through ${formatDate(activityEnd)}, followed by 60 days through ${formatDate(latestDepartureDate)}.`,
      ["8CFR-214-1-M1"]
    )
  ];
  const actions: string[] = [];
  const rules = [TRANSITION_RULE];

  const qualifyingApprovedOpt =
    (scenario.optStage === "post_completion_approved" || scenario.optStage === "stem_approved") &&
    Boolean(scenario.currentEadEndDate);
  if (qualifyingApprovedOpt && scenario.currentEadEndDate) {
    activityEnd = scenario.currentEadEndDate;
    latestDepartureDate = addDays(activityEnd, 60);
  }

  const plannedEnd = maxDate(scenario.currentProgramEndDate, scenario.currentEadEndDate, scenario.nextProgramEndDate, effectiveDocumentEnd);
  const extensionNeeded = Boolean(plannedEnd && isAfter(plannedEnd, activityEnd));
  if (extensionNeeded && plannedEnd) {
    findings.push(
      finding(
        "transition-extension-needed",
        "warning",
        "Your program or training continues beyond the old-rule protection",
        `Your current plan runs through ${formatDate(plannedEnd)}, but your old-rule protection ends ${formatDate(activityEnd)}. Before then, work with your DSO on either a timely Form I-539 extension or departure and readmission with an updated I-20. A return does not automatically add four years from the travel date; the new period is based on the I-20 program dates and the I-94 issued by CBP.`,
        ["8CFR-214-1-M1", "8CFR-214-2-F7"]
      )
    );
    actions.push("Before the old-rule protection ends, ask your DSO to compare a Form I-539 extension with departure and readmission on an updated I-20.");
  } else {
    const coveredProgramEnd = scenario.currentProgramEndDate ?? scenario.programEndOnEffectiveDate;
    findings.push(
      finding(
        "transition-covers-current-plan",
        "good",
        "You can finish this program without filing Form I-539",
        coveredProgramEnd
          ? `Your I-20 program ends on ${formatDate(coveredProgramEnd)}, within your old-rule protection. You do not need Form I-539 just to finish this program.`
          : "Your current program ends within your old-rule protection. You do not need Form I-539 just to finish it.",
        ["8CFR-214-1-M1"]
      )
    );
  }

  if (scenario.travelPosture === "planned" || scenario.travelPosture === "completed") {
    findings.push(
      finding(
        "travel-ends-ds-branch",
        "warning",
        "A return after September 15 ends the old-rule path",
        "If any trip brings you back after September 15, you return under the fixed-period system instead of keeping D/S. The I-94 issued after your return controls, and its projected end is calculated from the I-20 program dates, not simply from the day you return.",
        ["8CFR-214-1-M1", "8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
      )
    );
  }

  addAcademicFindings(scenario, findings, actions);
  if (findings.some((item) => item.id.startsWith("graduate-") || item.id.startsWith("undergraduate-") || item.id === "same-or-lower-next-program")) rules.push(ACADEMIC_MOBILITY_RULE);
  addCptFindings(scenario, activityEnd, latestDepartureDate, F1_TRANSITION_DEPARTURE_PERIOD_DAYS, findings, actions);
  addTravelAndDependentFindings(scenario, findings, actions);
  const timelineItems = [
    timeline(effectiveDate, "The new rule begins", "You must be in the United States in valid F-1 status on this date to keep the old rules."),
    timeline(activityEnd, qualifyingApprovedOpt ? "Your approved OPT ends" : "Your old-rule study period ends", qualifyingApprovedOpt ? "This is the expiration date on your approved EAD." : "This is the later I-20 or approved EAD date in effect on September 15, capped at September 15, 2030.", extensionNeeded ? "warning" : "good"),
    timeline(latestDepartureDate, "Your 60-day period ends", "This is the final day included after study or approved training under the old rules.", extensionNeeded ? "warning" : "neutral")
  ];
  if (scenario.nextProgramStartDate) {
    timelineItems.push(timeline(scenario.nextProgramStartDate, "Your next program begins", "This is the planned start date for the later program.", "neutral"));
  }
  if (scenario.nextProgramEndDate) {
    timelineItems.push(timeline(
      scenario.nextProgramEndDate,
      "Your next program ends",
      isAfter(scenario.nextProgramEndDate, activityEnd) ? "Your current old-rule period does not reach this date." : "Your current old-rule period reaches this date.",
      isAfter(scenario.nextProgramEndDate, activityEnd) ? "warning" : "good"
    ));
  }
  addEarlyEndFinding(scenario, findings, timelineItems);
  addOptFindings(scenario, activityEnd, latestDepartureDate, findings, actions);
  addTransitionOptTimeline(scenario, latestDepartureDate, timelineItems);
  if (hasTransitionOptPlan(scenario)) rules.push(OPT_TRANSITION_RULE);

  const questions = [...normalized.followUpQuestions];
  const status = statusFor(findings, questions, extensionNeeded ? "caution" : "ok");
  return makeResult(scenario, {
    classification: "transition_ds",
    status,
    headline: "You are under the old rules",
    summary: `If you do not travel, that protection continues through ${formatDate(latestDepartureDate)}, 60 days after your ${qualifyingApprovedOpt ? "approved OPT period" : "program"} ends.`,
    activityEnd,
    coverageEnd: activityEnd,
    departurePeriodDays: 60,
    latestDepartureDate,
    extensionPlanningDate: extensionNeeded ? activityEnd : undefined,
    extensionNeededBy: extensionNeeded ? activityEnd : undefined,
    i765TransitionDeadline: OPT_TRANSITION_I765_DEADLINE,
    appliedRules: rules,
    findings,
    timeline: timelineItems.sort((a, b) => (a.date > b.date ? 1 : -1)),
    followUpQuestions: questions,
    nextActions: [...new Set(actions)]
  });
}

export const primarySources = [source("FR-2026-FINAL-RULE")];

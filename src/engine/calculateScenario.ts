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
      followUpQuestions.push(`Confirm the ${label}. This result currently uses ${formatDate(DEFAULT_EFFECTIVE_DATE)}.`);
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
        "I read the dates this way",
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
        "The result still shows everything that can be determined without that date.",
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

  if (scenario.educationLevel === "graduate") {
    findings.push(
      finding(
        "graduate-objective-limit",
        scenario.academicProgramChangePlan === "yes" ? "danger" : "info",
        "You cannot change your graduate educational objective during the program",
        "The new rule does not allow an F-1 student at the graduate level or above to change a major or educational level during the program.",
        ["8CFR-214-2-F5II"]
      )
    );
    findings.push(
      finding(
        "graduate-transfer-limit",
        scenario.schoolTransferPlan === "yes" ? "warning" : "info",
        "A graduate transfer requires an SEVP exception",
        "The new rule does not allow a graduate-level school transfer unless SEVP authorizes an exception for extenuating circumstances.",
        ["8CFR-214-2-F5II"]
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
          "During your first academic year, you cannot transfer schools or change your major or education level unless SEVP authorizes an exception for extenuating circumstances.",
          ["8CFR-214-2-F5II"]
        )
      );
    } else if (scenario.firstAcademicYearCompleted === "yes") {
      findings.push(
        finding(
          "undergraduate-first-year-complete",
          "good",
          "The new first-year restriction does not block this timing",
          "You said you will have completed your first academic year before the planned change. Other transfer or program-change requirements still apply.",
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
        completedAfterRule ? "danger" : "warning",
        "A same-level or lower-level next program is blocked after a post-rule completion",
        completedAfterRule
          ? `Because your current program ends after September 15, 2026, the rule does not allow you to remain in, be admitted in, or receive F-1 status for a later program at the same or a lower education level.`
          : "This restriction applies when the earlier U.S. F-1 program is completed after September 15, 2026. Confirm the earlier completion date before relying on this plan.",
        ["8CFR-214-2-F5II"]
      )
    );
  }
}

function addCptFindings(scenario: StudentScenario, activityEnd: string | undefined, i94End: string | undefined, findings: Finding[], nextActions: string[]) {
  if (scenario.cptPlan === "none") return;
  if (scenario.cptPlan === "unknown") {
    findings.push(
      finding(
        "cpt-date-needed",
        "question",
        "CPT timing needs one more date",
        "The rule does not eliminate Day One CPT. The important new issue is whether a required extension reaches USCIS before your study or training period ends.",
        ["8CFR-214-2-F5VIII-CPT"]
      )
    );
    return;
  }
  if (scenario.cptPlan === "before_admission_end") {
    findings.push(
      finding(
        "cpt-before-period-end",
        "info",
        "A timely extension can preserve already-authorized CPT while it is pending",
        `If USCIS receives a complete extension before your study or training period ends${activityEnd ? ` on ${formatDate(activityEnd)}` : ""}, already-authorized CPT can continue while the extension is pending for up to 240 days, subject to the CPT end date and the rule's other requirements.`,
        ["8CFR-214-2-F5VIII-CPT", "8CFR-214-2-F7-TIMELY"]
      )
    );
  } else {
    findings.push(
      finding(
        "cpt-final-thirty-days",
        "danger",
        "Filing during the final 30 days does not preserve CPT",
        `An I-539 can still be timely if USCIS receives it by the I-94 date${i94End ? ` of ${formatDate(i94End)}` : ""}, but CPT and other F-1 employment cannot continue or begin until the extension is approved if the filing arrives only during those final 30 days.`,
        ["8CFR-214-2-F5VIII-CPT", "8CFR-214-2-F7-TIMELY"]
      )
    );
    nextActions.push("Plan the filing before the study or training period ends if uninterrupted CPT or on-campus work matters.");
  }
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
        "Travel while an I-539 is pending can change the case",
        scenario.reentryBasis === "longer_program_i20"
          ? "If you return seeking a period beyond the unexpired balance of the prior admission, USCIS may treat the pending extension as abandoned."
          : "The pending extension is not automatically abandoned only when the prior admission is still unexpired and you return seeking its remaining balance. Carry the receipt notice and valid I-20.",
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
  if (scenario.optStage === "none" || scenario.optStage === "pre_completion") return;
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
        "An OPT return can depend on the EAD end date, a pending I-765 receipt, and the employment end date recommended by your DSO. Add those documents before relying on a projected I-94 date.",
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
        "OPT requires your DSO's recommendation",
        "The temporary no-I-539 filing rule applies only after your DSO recommends post-completion OPT or STEM OPT. Confirm that step before relying on the filing window.",
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
      findings.push(finding("approved-opt-ead-needed", "question", "Add the EAD end date", `The EAD date determines the approved OPT or STEM OPT stay-through date. The timeline shown now continues to use the confirmed I-20 or EAD facts already provided${activityEnd ? ` through ${formatDate(activityEnd)}` : ""}.`, ["8CFR-214-1-M1-OPT"]));
    }
    return;
  }

  if (!scenario.optFilingDate) {
    findings.push(
      finding(
        "opt-filing-date-needed",
        "question",
        "The I-765 filing date changes the answer",
        `To use the temporary rule, file by March 18, 2027 and by the earlier applicable status deadline${latestDepartureDate ? ` of ${formatDate(latestDepartureDate)}` : ""}.`,
        ["8CFR-214-1-M1-OPT"]
      )
    );
    return;
  }

  if (isAfter(scenario.optFilingDate, OPT_TRANSITION_I765_DEADLINE)) {
    findings.push(finding("opt-after-march-deadline", "danger", "This filing date misses the temporary OPT deadline", `${formatDate(scenario.optFilingDate)} is after March 18, 2027, so the temporary no-I-539 rule does not apply.`, ["8CFR-214-1-M1-OPT"]));
    return;
  }
  if (latestDepartureDate && isAfter(scenario.optFilingDate, latestDepartureDate) && !isStem) {
    findings.push(finding("opt-after-status-deadline", "danger", "This post-completion OPT filing is too late for the temporary rule", `USCIS must receive the I-765 before your protected period ends on ${formatDate(latestDepartureDate)}.`, ["8CFR-214-1-M1-OPT"]));
    return;
  }
  if (isStem && scenario.currentEadEndDate && isAfter(scenario.optFilingDate, scenario.currentEadEndDate)) {
    findings.push(finding("stem-after-ead", "danger", "This STEM OPT filing date is after the current EAD ends", `USCIS must receive the STEM OPT I-765 before the current EAD expires on ${formatDate(scenario.currentEadEndDate)}.`, ["8CFR-214-1-M1-OPT"]));
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
      "This filing date fits the temporary OPT window",
      `The date you entered, ${formatDate(scenario.optFilingDate)}, is on or before March 18, 2027 and fits the other confirmed timing facts. You may avoid filing an I-539 solely because D/S ended, provided your DSO recommendation and all normal OPT requirements are met.`,
      ["8CFR-214-1-M1-OPT"]
    )
  );
  if (scenario.travelPosture !== "none" && isNotFiled) {
    findings.push(finding("opt-travel-before-filing", "danger", "Leaving before you file changes the OPT path", "If you leave before filing and return under the fixed-period system, you must plan for both the I-765 and I-539 requirements rather than relying on the temporary stay-in-the-U.S. path.", ["8CFR-214-1-M1-OPT"]));
    nextActions.push("Compare filing before travel with the documents needed for a fixed-period return.");
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
  if (activityEnd) timelineItems.push(timeline(activityEnd, "Study or training period ends", actualI94 ? "This is 30 days before the I-94 date you entered." : `Earlier of the I-20 end and the ${fixedProgramLabel(scenario)}.`, extensionNeeded ? "warning" : "good"));
  if (i94End) timelineItems.push(timeline(i94End, "I-94 admit-until date", "This includes the final 30 days to leave or take action to maintain lawful status.", extensionNeeded ? "warning" : "neutral"));

  if (scenario.reentryDate && scenario.programStartDate) {
    const lead = daysBetween(scenario.reentryDate, scenario.programStartDate);
    if (lead > 30) findings.push(finding("entry-more-than-thirty-days-early", "danger", "This entry date is more than 30 days before the program starts", `The ordinary F-1 rule permits entry up to 30 days before the I-20 program start date. These dates are ${lead} days apart.`, ["8CFR-214-1-A4"]));
  }

  if (actualI94) {
    findings.push(
      finding(
        "actual-i94-controls",
        "info",
        "The I-94 date you entered controls this timeline",
        `Your I-94 says ${formatDate(actualI94)}. That date already includes the final 30 days, so this app does not add another 30 days.`,
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
        `Your I-20 ends ${formatDate(scenario.currentProgramEndDate)}, after the projected study period ends ${formatDate(activityEnd)}. USCIS must receive a complete I-539 by ${formatDate(i94End)}. File before ${formatDate(activityEnd)} if you need already-authorized CPT or other F-1 employment to continue while the request is pending.`,
        ["8CFR-214-2-F7", "8CFR-214-2-F7-TIMELY"]
      )
    );
    actions.push("Work with your DSO well before the study or training period ends to prepare the new I-20 and I-539 evidence.");
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
  addCptFindings(scenario, activityEnd, i94End, findings, actions);
  addTravelAndDependentFindings(scenario, findings, actions);
  addEarlyEndFinding(scenario, findings, timelineItems);
  addOptFindings(scenario, activityEnd, i94End, findings, actions);

  const status = statusFor(findings, questions, extensionNeeded ? "caution" : "ok");
  const headline = i94End
    ? `${actualI94 ? "Your I-94 ends" : "Your projected I-94 would end"} ${formatDate(i94End)}`
    : "You will have a fixed F-1 end date instead of D/S";
  const summary = i94End
    ? `Your study or training period runs through ${formatDate(activityEnd)}, followed by 30 days already included in the ${formatDate(i94End)} I-94 date.`
    : "Your I-94 will show a specific admit-until date. Add the I-20 program start and end dates to project that date and see whether an extension may be needed.";

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
    timeline: [timeline(effectiveDate, "The new rule begins", "Your location and valid F-1 status on this date decide the first branch.", "warning")],
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
        "These answers need clarification",
        `You said you will not be in the United States in valid F-1 status on September 15, 2026, but you also entered ${formatDate(scenario.reentryDate)} as an F-1 entry date. That can happen only if you leave before September 15 or another fact changes.`,
        ["8CFR-214-1-M1"]
      )
    ];
    return buildClarificationResult(
      scenario,
      findings,
      [...normalized.followUpQuestions, "Will you leave the United States before September 15, 2026?"],
      "Tell us whether you will leave before September 15",
      "No date result is shown until the location conflict is resolved, but the rest of your answers are preserved."
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
          `You said you will enter on ${formatDate(scenario.reentryDate)} and leave before the rule starts. The fixed-period timeline begins with your next F-1 admission after September 15, not the earlier trip.`,
          ["8CFR-214-1-A4"]
        )
      ],
      [...normalized.followUpQuestions, "When will you next enter the United States in F-1 status after September 15, 2026?"],
      "Your post-rule return date is still needed",
      "The app kept the rest of your facts and will calculate the fixed-period path after you add that return date."
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
      [...normalized.findings, finding("first-branch-needed", "question", "Your September 15 situation decides the first result", "Answer the current question and the app will show the parts of the rule that apply immediately.", ["8CFR-214-1-M1"])],
      questions,
      "Start with September 15, 2026",
      "One answer decides whether the old D/S rules can continue for you or whether you enter the fixed-period system."
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
      "The app will keep the facts you already provided while you confirm the missing item."
    );
  }

  const effectiveDocumentEnd = maxDate(scenario.programEndOnEffectiveDate, scenario.eadEndOnEffectiveDate);
  if (!effectiveDocumentEnd) {
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("effective-document-date-needed", "question", "Add the I-20 end date that will be active on September 15", "That date is needed to calculate how long the old rules protect you. Add an EAD end date too if you will have one that day.", ["8CFR-214-1-M1"])],
      [...normalized.followUpQuestions, "What program end date will be on your active I-20 on September 15, 2026?"],
      "You remain under the old rules if these facts stay the same",
      "You are in the protected current-student group. Add your document date to see exactly how long the protection lasts."
    );
  }

  if (isAfter(effectiveDate, effectiveDocumentEnd)) {
    return buildClarificationResult(
      scenario,
      [...normalized.findings, finding("document-ends-before-effective-date", "question", "Tell us what will keep you in F-1 status on September 15", `The date entered, ${formatDate(effectiveDocumentEnd)}, is before the rule begins. Add a later I-20, OPT, or STEM OPT fact so the app does not guess.`, ["8CFR-214-1-M1"])],
      [...normalized.followUpQuestions, "Will you have a later I-20, post-completion OPT, or STEM OPT on September 15, 2026?"],
      "Your current document ends before the rule begins",
      "The rest of your result will appear after you identify your F-1 basis on September 15."
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
      `This is the old duration-of-status system, shown as D/S on most current F-1 I-94 records. If these facts stay the same and you do not leave the United States, your protection continues through ${formatDate(activityEnd)}, followed by 60 days through ${formatDate(latestDepartureDate)}.`,
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

  const plannedEnd = maxDate(scenario.currentProgramEndDate, scenario.currentEadEndDate, effectiveDocumentEnd);
  const extensionNeeded = Boolean(plannedEnd && isAfter(plannedEnd, activityEnd));
  if (extensionNeeded && plannedEnd) {
    findings.push(
      finding(
        "transition-extension-needed",
        "warning",
        "Your program or training continues beyond the old-rule protection",
        `Your current plan runs through ${formatDate(plannedEnd)}, but the protected study or training period ends ${formatDate(activityEnd)}. Work with your DSO on an extension-of-stay plan before that date.`,
        ["8CFR-214-1-M1", "8CFR-214-2-F7"]
      )
    );
    actions.push("Start the I-539 plan with your DSO well before the protected study or training period ends.");
  } else {
    findings.push(
      finding(
        "transition-covers-current-plan",
        "good",
        "Your current program fits inside the old-rule protection",
        `Based on the dates entered, you do not need an I-539 just to finish this program before ${formatDate(activityEnd)}. Travel, a later program, or a later training plan can change that answer.`,
        ["8CFR-214-1-M1"]
      )
    );
  }

  if (scenario.travelPosture === "planned" || scenario.travelPosture === "completed") {
    findings.push(
      finding(
        "travel-ends-ds-branch",
        "warning",
        "Returning after September 15 puts you in the fixed-period system",
        "The stay-in-the-U.S. timeline and the return timeline are alternatives. A return does not preserve D/S. The I-94 issued after your return controls, and the projected fixed period must be calculated from the I-20 program dates, not simply from the day you return.",
        ["8CFR-214-1-M1", "8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
      )
    );
  }

  addAcademicFindings(scenario, findings, actions);
  if (findings.some((item) => item.id.startsWith("graduate-") || item.id.startsWith("undergraduate-") || item.id === "same-or-lower-next-program")) rules.push(ACADEMIC_MOBILITY_RULE);
  addCptFindings(scenario, activityEnd, latestDepartureDate, findings, actions);
  addTravelAndDependentFindings(scenario, findings, actions);
  const timelineItems = [
    timeline(effectiveDate, "The new rule begins", "Your current D/S protection is measured on this date."),
    timeline(activityEnd, "Protected study or training ends", qualifyingApprovedOpt ? "Your approved EAD end date." : "The later active I-20 or EAD date, capped at four years.", extensionNeeded ? "warning" : "good"),
    timeline(latestDepartureDate, "Old-rule 60-day period ends", "Last day of the transition departure period.", extensionNeeded ? "warning" : "neutral")
  ];
  addEarlyEndFinding(scenario, findings, timelineItems);
  addOptFindings(scenario, activityEnd, latestDepartureDate, findings, actions);
  if (scenario.optStage !== "none" && scenario.optStage !== "pre_completion") rules.push(OPT_TRANSITION_RULE);

  const questions = [...normalized.followUpQuestions];
  const status = statusFor(findings, questions, extensionNeeded ? "caution" : "ok");
  return makeResult(scenario, {
    classification: "transition_ds",
    status,
    headline: `You remain under the old rules through ${formatDate(activityEnd)}`,
    summary: `If you stay in the United States and these facts do not change, your 60-day period runs through ${formatDate(latestDepartureDate)}.`,
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

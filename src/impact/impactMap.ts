import type { IntakeTopic } from "../ai/intakePayload";
import {
  DEFAULT_EFFECTIVE_DATE,
  OPT_TRANSITION_I765_DEADLINE,
  postCompletionOptWindowOpens
} from "../engine/calculateScenario";
import { addDays, compareDates, formatDate } from "../engine/dateMath";
import type { Finding, PlannerResult, StudentScenario } from "../engine/types";

export type ImpactCategory =
  | "stay"
  | "travel"
  | "extension"
  | "departure"
  | "opt"
  | "cpt"
  | "school_transfer"
  | "program_change"
  | "later_program"
  | "program_limits"
  | "dependents"
  | "special";

export interface ImpactClaim {
  id: string;
  category: ImpactCategory;
  tone: Finding["tone"];
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface ImpactMap {
  headline: string;
  summary: string;
  sourceIds: string[];
  focusClaims: ImpactClaim[];
  otherClaims: ImpactClaim[];
  unresolved: string[];
  ruleStatus?: string;
}

export const EXPLORATION_OPTIONS: Array<{
  topic: IntakeTopic;
  title: string;
  description: string;
}> = [
  { topic: "stay_length", title: "How long I can stay", description: "Your I-94, I-20, and the dates that control your stay." },
  { topic: "travel", title: "Travel", description: "What changes when you leave and return." },
  { topic: "extension", title: "Needing more time", description: "Form I-539 and the travel alternative." },
  { topic: "opt", title: "OPT or STEM OPT", description: "Filing, travel, and the one-time OPT deadline." },
  { topic: "cpt", title: "CPT", description: "Work during study and a pending extension." },
  { topic: "school_transfer", title: "Transfer schools", description: "New limits for undergraduate and graduate students." },
  { topic: "program_change", title: "Change my program", description: "Major, degree level, and graduate-program limits." },
  { topic: "later_program", title: "Study another program", description: "When a later F-1 program must be at a higher level." },
  { topic: "dependents", title: "F-2 family", description: "How your spouse or children's dates follow yours." },
  { topic: "early_end", title: "Finish early or withdraw", description: "Shorter departure periods and status concerns." }
];

const TOPIC_CATEGORY: Record<IntakeTopic, ImpactCategory> = {
  stay_length: "stay",
  travel: "travel",
  opt: "opt",
  stem_opt: "opt",
  cpt: "cpt",
  extension: "extension",
  school_transfer: "school_transfer",
  program_change: "program_change",
  later_program: "later_program",
  dependents: "dependents",
  early_end: "special",
  change_of_status: "stay"
};

const SPECIAL_FINDING_IDS = new Set([
  "date-input-normalized",
  "date-confirmation-needed",
  "future-entry-before-effective-date-contradiction",
  "post-rule-return-date-needed",
  "entry-more-than-thirty-days-early",
  "entry-after-authorized-study-end",
  "automatic-visa-revalidation",
  "pending-extension-travel",
  "pending-change-status-travel",
  "early-end-date-needed",
  "completed-early",
  "authorized-withdrawal",
  "status-violation"
]);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function hasFinding(result: PlannerResult, id: string): boolean {
  return result.findings.some((item) => item.id === id);
}

function categoryOrder(category: ImpactCategory): number {
  return [
    "stay",
    "travel",
    "extension",
    "departure",
    "opt",
    "cpt",
    "school_transfer",
    "program_change",
    "later_program",
    "program_limits",
    "dependents",
    "special"
  ].indexOf(category);
}

function fixedStaySummary(result: PlannerResult): { headline: string; summary: string } {
  if (result.i94AdmitUntilDate && result.activityEnd) {
    return {
      headline: `Your projected I-94 ends ${formatDate(result.i94AdmitUntilDate)}`,
      summary: `Your study or training period ends ${formatDate(result.activityEnd)}. The final 30 days are already included in the I-94 date.`
    };
  }
  return {
    headline: "Your I-94 will have an end date",
    summary: "The date will follow your I-20 program dates, normally for no more than four years from the program start date, plus 30 days."
  };
}

function mainConclusion(
  scenario: StudentScenario,
  stayResult: PlannerResult,
  travelResult: PlannerResult | null
): { headline: string; summary: string; sourceIds: string[] } {
  const transitionPath =
    scenario.startingPosition === "current_ds_inside_us" &&
    scenario.inUsOnEffectiveDate === "yes" &&
    scenario.maintainingStatusOnEffectiveDate === "yes" &&
    scenario.admissionBasis === "duration_of_status";

  const coverageConflict = stayResult.findings.find((item) => item.id === "document-ends-before-effective-date");
  if (coverageConflict) {
    return {
      headline: "These dates do not fit yet",
      summary: "Your I-20 ends before September 15, 2026. Confirm the later I-20 or approved OPT or STEM OPT EAD that will keep your F-1 status active that day.",
      sourceIds: coverageConflict.sourceIds
    };
  }

  if (travelResult) {
    const projected = travelResult.i94AdmitUntilDate
      ? ` Your projected I-94 would end ${formatDate(travelResult.i94AdmitUntilDate)}; the I-94 issued by CBP controls.`
      : " The I-20 used at entry and the I-94 issued by CBP will set your new end date.";
    return {
      headline: "Your return puts you under the new rules",
      summary: `Returning after September 15, 2026 moves you from the old D/S rules to a dated F-1 admission period.${projected}`,
      sourceIds: ["8CFR-214-1-M1", "8CFR-214-1-A4"]
    };
  }

  if (transitionPath) {
    if (stayResult.activityEnd && stayResult.latestDepartureDate) {
      return {
        headline: "You are under the old rules",
        summary: `If you do not return after September 15, the old rules continue through ${formatDate(stayResult.activityEnd)}, followed by 60 days through ${formatDate(stayResult.latestDepartureDate)}.`,
        sourceIds: ["8CFR-214-1-M1"]
      };
    }
    return {
      headline: "You are under the old rules",
      summary: "The I-20 or approved EAD in effect on September 15 sets how long the old rules continue, no later than September 15, 2030.",
      sourceIds: ["8CFR-214-1-M1"]
    };
  }

  if (stayResult.classification === "manual_review") {
    return {
      headline: stayResult.headline,
      summary: stayResult.summary,
      sourceIds: stayResult.findings.flatMap((item) => item.sourceIds).slice(0, 2)
    };
  }

  return { ...fixedStaySummary(stayResult), sourceIds: ["8CFR-214-1-A4", "8CFR-214-2-F5V"] };
}

function optClaim(
  scenario: StudentScenario,
  result: PlannerResult,
  travelResult: PlannerResult | null,
  transitionPath: boolean
): ImpactClaim | null {
  if (scenario.optIntent === "no" && scenario.optStage === "none") return null;

  const fixedPath = !transitionPath && result.classification !== "manual_review";
  if (fixedPath) {
    return {
      id: "opt-fixed-period",
      category: "opt",
      tone: "info",
      title: "OPT needs its own stay period",
      detail: "For post-completion OPT, file Form I-765 and either Form I-539 or seek a new F-1 admission through CBP after travel. STEM OPT comes after regular OPT.",
      sourceIds: ["8CFR-214-2-F11", "USCIS-OPT-STEM"]
    };
  }

  if (!transitionPath) return null;

  if (scenario.optStage.endsWith("approved") && scenario.currentEadEndDate) {
    return {
      id: "opt-approved",
      category: "opt",
      tone: "good",
      title: `Your approved OPT stay runs through ${formatDate(addDays(scenario.currentEadEndDate, 60))}`,
      detail: `Your EAD ends ${formatDate(scenario.currentEadEndDate)}, followed by 60 days under the old rules.`,
      sourceIds: ["8CFR-214-1-M1-OPT"]
    };
  }

  const normalWindowOpens = postCompletionOptWindowOpens(scenario);
  const currentStayEnds = result.latestDepartureDate;
  const windowCanUseException = Boolean(
    normalWindowOpens &&
    compareDates(normalWindowOpens, OPT_TRANSITION_I765_DEADLINE) <= 0 &&
    (!currentStayEnds || compareDates(normalWindowOpens, currentStayEnds) <= 0)
  );

  if (travelResult && windowCanUseException) {
    const alreadyFiledBeforePlannedTravel = scenario.travelPosture === "planned" && (
      scenario.optStage.endsWith("pending") ||
      scenario.optStage.endsWith("approved")
    );
    const filedBeforeDeparture = scenario.optFiledBeforeDeparture === "yes" || alreadyFiledBeforePlannedTravel;
    if (filedBeforeDeparture) {
      return {
        id: "opt-filed-before-travel",
        category: "opt",
        tone: "good",
        title: "Filing before travel preserves the one-time OPT option",
        detail: "Submit Form I-765 before you leave, by March 18, 2027, and while the old rules still cover you. The fixed-period return does not by itself add Form I-539 for that OPT period.",
        sourceIds: ["8CFR-214-1-M1-OPT"]
      };
    }
    if (scenario.optFiledBeforeDeparture === "no") {
      return {
        id: "opt-travel-before-filing",
        category: "opt",
        tone: "warning",
        title: "Traveling before you file closes the one-time OPT option",
        detail: "After a fixed-period return, post-completion OPT requires Form I-765 and Form I-539. A later request for admission through CBP can be an alternative to Form I-539.",
        sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
      };
    }
    if (normalWindowOpens && scenario.reentryDate && compareDates(scenario.reentryDate, normalWindowOpens) < 0) {
      return {
        id: "opt-trip-before-window",
        category: "opt",
        tone: "warning",
        title: "This trip comes before your OPT filing window",
        detail: `Your normal filing window opens ${formatDate(normalWindowOpens)}. Returning under the new rules before then means later OPT requires Form I-765 and Form I-539, or another admission through CBP.`,
        sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
      };
    }
    return {
      id: "opt-order-before-travel",
      category: "opt",
      tone: "warning",
      title: "File Form I-765 before you leave",
      detail: `Your normal filing window opens ${formatDate(normalWindowOpens!)}. ${scenario.dsoRecommendedOpt === "yes" ? "" : "Your DSO must recommend OPT first. "}Submit Form I-765 before your trip and by March 18, 2027 to avoid Form I-539 for that OPT period.`,
      sourceIds: ["8CFR-214-1-M1-OPT"]
    };
  }

  if (scenario.optFilingDate && compareDates(scenario.optFilingDate, OPT_TRANSITION_I765_DEADLINE) <= 0) {
    return {
      id: "opt-transition-filed",
      category: "opt",
      tone: "good",
      title: "Your filing date fits the one-time OPT exception",
      detail: `If USCIS receives your Form I-765 by ${formatDate(OPT_TRANSITION_I765_DEADLINE)} while the old rules still cover you, you do not need Form I-539 solely because the rule changed.`,
      sourceIds: ["8CFR-214-1-M1-OPT"]
    };
  }

  if (windowCanUseException) {
    return {
      id: "opt-transition-window",
      category: "opt",
      tone: "good",
      title: "You may be able to skip Form I-539 for OPT",
      detail: `After your DSO recommends OPT, USCIS must receive Form I-765 by ${formatDate(OPT_TRANSITION_I765_DEADLINE)} and before your old-rule stay ends.`,
      sourceIds: ["8CFR-214-1-M1-OPT"]
    };
  }

  if (normalWindowOpens) {
    return {
      id: "opt-window-after-exception",
      category: "opt",
      tone: "warning",
      title: "The one-time OPT exception closes before your filing window opens",
      detail: `Your normal 90-day filing window opens ${formatDate(normalWindowOpens)}, after March 18, 2027. Plan for Form I-765 plus Form I-539, or a new F-1 admission after travel.`,
      sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
    };
  }

  if (travelResult) {
    return {
      id: "opt-travel-order-conditional",
      category: "opt",
      tone: "info",
      title: "Travel and OPT filing order may matter",
      detail: "If your normal OPT window opens by March 18, 2027, filing Form I-765 before departure can avoid Form I-539 for that OPT period. Your I-20 end date decides whether this option is available.",
      sourceIds: ["8CFR-214-1-M1-OPT"]
    };
  }

  return {
    id: "opt-transition-general",
    category: "opt",
    tone: "info",
    title: "Some current students have a one-time OPT option",
    detail: "Some current students can file Form I-765 by March 18, 2027 without Form I-539. Your program end date determines whether your normal filing window opens in time.",
    sourceIds: ["8CFR-214-1-M1-OPT"]
  };
}

export function buildImpactMap(
  scenario: StudentScenario,
  stayResult: PlannerResult,
  travelResult: PlannerResult | null,
  focusTopics: IntakeTopic[] = []
): ImpactMap {
  const primaryResult = travelResult ?? stayResult;
  const conclusion = mainConclusion(scenario, stayResult, travelResult);
  if (hasFinding(stayResult, "document-ends-before-effective-date")) {
    return {
      ...conclusion,
      focusClaims: [],
      otherClaims: [],
      unresolved: stayResult.followUpQuestions
    };
  }
  const claims: ImpactClaim[] = [];
  const push = (claim: ImpactClaim | null) => {
    if (claim && !claims.some((item) => item.id === claim.id)) claims.push(claim);
  };
  const transition =
    scenario.startingPosition === "current_ds_inside_us" &&
    scenario.inUsOnEffectiveDate === "yes" &&
    scenario.maintainingStatusOnEffectiveDate === "yes" &&
    scenario.admissionBasis === "duration_of_status";
  const fixed = primaryResult.classification !== "transition_ds" && primaryResult.classification !== "manual_review";
  const needsExtension = (result: PlannerResult) => Boolean(
    result.extensionNeededBy ||
    result.extensionPlanningDate ||
    hasFinding(result, "fixed-extension-needed") ||
    hasFinding(result, "transition-extension-needed")
  );
  const stayNeedsExtension = needsExtension(stayResult);
  const primaryNeedsExtension = needsExtension(primaryResult);
  const anyRouteNeedsExtension = stayNeedsExtension || primaryNeedsExtension;
  const travelCoversCurrentProgram = Boolean(
    travelResult?.activityEnd &&
    scenario.currentProgramEndDate &&
    compareDates(travelResult.activityEnd, scenario.currentProgramEndDate) >= 0
  );

  if (transition) {
    if (travelResult) {
      push({
        id: "travel-stay-alternative",
        category: "travel",
        tone: "info",
        title: "Staying in the United States keeps the old rules",
        detail: stayResult.latestDepartureDate
          ? `Without a post-September 15 return, your current old-rule timeline runs through ${formatDate(stayResult.latestDepartureDate)}.`
          : "Without a post-September 15 return, the old-rule timeline remains available.",
        sourceIds: ["8CFR-214-1-M1"]
      });
    } else {
      push({
        id: "travel-can-end-ds",
        category: "travel",
        tone: scenario.travelPosture === "planned" ? "warning" : "info",
        title: "A return after September 15 starts the new rules",
        detail: "Any F-1 return after that date creates a dated admission period. The I-20 used at entry and the I-94 issued by CBP control the new end date.",
        sourceIds: ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      });
    }
  } else if (fixed) {
    push({
      id: "travel-fixed-dates",
      category: "travel",
      tone: "info",
      title: "Travel does not add four years from the return date",
      detail: "A new admission period follows the program dates on your I-20. CBP decides the period and the issued I-94 controls.",
      sourceIds: ["8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
    });
  }

  if (travelResult && stayNeedsExtension) {
    const stayPlanningDate = stayResult.extensionPlanningDate ?? stayResult.activityEnd;
    const stayFilingDeadline = stayResult.extensionFilingDeadline ?? stayResult.extensionNeededBy;
    push({
      id: "stay-route-needs-extension",
      category: "extension",
      tone: "warning",
      title: stayPlanningDate
        ? `Staying in the United States needs a plan before ${formatDate(stayPlanningDate)}`
        : "Staying in the United States requires more time",
      detail: stayFilingDeadline
        ? `File Form I-539 by ${formatDate(stayFilingDeadline)}, or leave and request a new admission period before your old-rule stay ends.`
        : "File Form I-539 or leave and request a new admission period before your old-rule stay ends.",
      sourceIds: ["8CFR-214-1-M1", "8CFR-214-2-F7"]
    });
  }

  if (primaryNeedsExtension) {
    const deadline = primaryResult.extensionPlanningDate ?? primaryResult.activityEnd;
    const finalDeadline = primaryResult.extensionFilingDeadline ?? primaryResult.extensionNeededBy;
    push({
      id: "more-time-needed",
      category: "extension",
      tone: "warning",
      title: deadline ? `You need a plan before ${formatDate(deadline)}` : "You will need more time",
      detail: finalDeadline && deadline && finalDeadline !== deadline
        ? `File Form I-539 by ${formatDate(finalDeadline)}, or leave and request readmission with an updated I-20. File before ${formatDate(deadline)} if authorized work must continue.`
        : "Before your current stay ends, file Form I-539 or leave and request readmission with an updated I-20. USCIS or CBP makes the decision.",
      sourceIds: ["8CFR-214-2-F7", "8CFR-214-2-F7-TIMELY"]
    });
  }

  if (travelResult && travelCoversCurrentProgram && stayNeedsExtension && !primaryNeedsExtension) {
    push({
      id: "travel-may-avoid-i539",
      category: "travel",
      tone: "good",
      title: "This return may let you avoid Form I-539",
      detail: `The projected admission reaches your program end date of ${formatDate(scenario.currentProgramEndDate!)}. Bring the supporting I-20 and travel documents; the I-94 issued by CBP controls.`,
      sourceIds: ["8CFR-214-2-F7", "8CFR-214-1-A4"]
    });
  } else if (anyRouteNeedsExtension) {
    push({
      id: "travel-is-extension-alternative",
      category: "travel",
      tone: "info",
      title: "Travel is another way to request more time",
      detail: "Instead of Form I-539, you can leave and request a new F-1 admission period with the supporting I-20 and travel documents. CBP decides at entry.",
      sourceIds: ["8CFR-214-2-F7", "8CFR-214-1-A4"]
    });
  }

  if (anyRouteNeedsExtension) {
    push({
      id: "extension-fee",
      category: "extension",
      tone: "info",
      title: "Form I-539 costs $420 online or $470 on paper",
      detail: "These are the current USCIS filing fees for this form. Check the fee again before filing.",
      sourceIds: ["USCIS-G1055-I539"]
    });
    push({
      id: "extension-biometrics",
      category: "extension",
      tone: "info",
      title: "USCIS may require biometrics or an interview",
      detail: "Watch for every USCIS notice after filing. Missing a required appointment can affect the request.",
      sourceIds: ["FR-F1-EXTENSION-PROCESS"]
    });
    push({
      id: "extension-premium",
      category: "extension",
      tone: "info",
      title: "Premium processing is not currently available",
      detail: "DHS said it will continue exploring premium processing for these requests, but no premium option exists now.",
      sourceIds: ["FR-I539-PREMIUM"]
    });
  } else if (transition && stayResult.activityEnd) {
    push({
      id: "no-extension-for-current-program",
      category: "extension",
      tone: "good",
      title: "You do not need Form I-539 to finish this program",
      detail: `Your current program fits within the old-rule period ending ${formatDate(stayResult.activityEnd)}, as long as you do not return under the new rules.`,
      sourceIds: ["8CFR-214-1-M1"]
    });
  } else if (fixed) {
    push({
      id: "fixed-extension-conditional",
      category: "extension",
      tone: "info",
      title: "Longer study needs another period of stay",
      detail: "If your program continues beyond your I-94 study period, use Form I-539 or leave and request a new admission with an updated I-20.",
      sourceIds: ["8CFR-214-2-F7"]
    });
  }

  if (transition) {
    push({
      id: "transition-departure-period",
      category: "departure",
      tone: "good",
      title: "You keep 60 days after study or approved training",
      detail: stayResult.latestDepartureDate
        ? `Your current timeline includes 60 days through ${formatDate(stayResult.latestDepartureDate)} after study or approved training ends.`
        : "The old rules include 60 days after study or approved training ends.",
      sourceIds: ["8CFR-214-1-M1"]
    });
  } else if (fixed) {
    push({
      id: "fixed-departure-period",
      category: "departure",
      tone: "warning",
      title: "Your final period is 30 days, not 60",
      detail: primaryResult.i94AdmitUntilDate
        ? `Those 30 days are already included in the I-94 end date of ${formatDate(primaryResult.i94AdmitUntilDate)}.`
        : "The 30 days are included in the I-94 end date; they are not added afterward.",
      sourceIds: ["8CFR-214-2-F5V"]
    });
  }

  push(optClaim(scenario, primaryResult, travelResult, transition));

  if (focusTopics.includes("cpt") || scenario.cptPlan === "planned") {
    const plannedCptNeedsExtension = primaryNeedsExtension && scenario.cptPlan === "planned";
    push({
      id: plannedCptNeedsExtension ? "cpt-extension" : "cpt-existing-rules",
      category: "cpt",
      tone: plannedCptNeedsExtension ? "warning" : "info",
      title: plannedCptNeedsExtension ? "File early to protect authorized CPT" : "This rule does not eliminate Day 1 CPT",
      detail: plannedCptNeedsExtension && primaryResult.activityEnd
        ? `A complete extension filed before ${formatDate(primaryResult.activityEnd)} can continue already-authorized CPT while pending, for up to 240 days and no later than the DSO-authorized CPT end date.`
        : "Existing CPT eligibility rules still apply. CPT cannot continue past the date authorized by your DSO or your I-20 program end date.",
      sourceIds: ["8CFR-214-2-F5VIII-CPT", "8CFR-214-2-F7-TIMELY"]
    });
  }

  if (scenario.educationLevel === "graduate") {
    push({
      id: "graduate-transfer",
      category: "school_transfer",
      tone: scenario.schoolTransferPlan === "yes" ? "warning" : "info",
      title: "A graduate transfer requires an SEVP exception",
      detail: "Graduate students cannot transfer during the program unless SEVP approves an exception for extenuating circumstances.",
      sourceIds: ["8CFR-214-2-F5II"]
    });
    push({
      id: "graduate-program-change",
      category: "program_change",
      tone: scenario.academicProgramChangePlan === "yes" ? "danger" : "info",
      title: "Graduate students cannot change their major or degree level",
      detail: "The restriction applies throughout the graduate program. The rule does not provide the same exception listed for graduate school transfers.",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  } else if (scenario.educationLevel === "undergraduate") {
    const firstYearComplete = scenario.firstAcademicYearCompleted === "yes";
    push({
      id: "undergraduate-transfer",
      category: "school_transfer",
      tone: scenario.schoolTransferPlan === "yes" && scenario.firstAcademicYearCompleted === "no" ? "danger" : "info",
      title: firstYearComplete ? "The new first-year transfer limit is behind you" : "No school transfer during your first academic year",
      detail: firstYearComplete
        ? "You have completed your first academic year, so this new restriction no longer blocks a transfer. Other transfer requirements still apply."
        : "After the first academic year, this new restriction no longer blocks a transfer. SEVP can approve an earlier exception for extenuating circumstances.",
      sourceIds: ["8CFR-214-2-F5II"]
    });
    push({
      id: "undergraduate-program-change",
      category: "program_change",
      tone: scenario.academicProgramChangePlan === "yes" && scenario.firstAcademicYearCompleted === "no" ? "danger" : "info",
      title: firstYearComplete ? "The new first-year program limit is behind you" : "No major or degree-level change during your first academic year",
      detail: firstYearComplete
        ? "You have completed your first academic year, so this new restriction no longer blocks a major or degree-level change. Other requirements still apply."
        : "After the first academic year, this new restriction no longer blocks the change. SEVP can approve an earlier exception for extenuating circumstances.",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  }

  if (scenario.educationLevel && scenario.educationLevel !== "unknown") {
    const completedAfterRule = !scenario.currentProgramEndDate || compareDates(scenario.currentProgramEndDate, DEFAULT_EFFECTIVE_DATE) > 0;
    if (completedAfterRule) {
      push({
        id: "later-program-level",
        category: "later_program",
        tone: scenario.nextProgramLevelPlan === "same_or_lower" ? "danger" : "info",
        title: "Your next F-1 program must be at a higher level",
        detail: "After completing a U.S. F-1 program on or after September 15, 2026, you cannot start another F-1 program at the same or a lower education level.",
        sourceIds: ["8CFR-214-2-F5II"]
      });
    }
  }

  if (scenario.programType === "english_language_training") {
    push({
      id: "english-training-cap",
      category: "program_limits",
      tone: "warning",
      title: "English-language study is limited to 24 months",
      detail: "The 24-month total includes breaks and annual vacation, followed by 30 days already included in the I-94 date.",
      sourceIds: ["8CFR-214-2-F5-EXCEPTIONS"]
    });
  }
  if (scenario.programType === "public_high_school") {
    push({
      id: "public-high-school-cap",
      category: "program_limits",
      tone: "warning",
      title: "Public high school is limited to 12 months total",
      detail: "The total includes breaks and annual vacations across public high schools.",
      sourceIds: ["8CFR-214-2-F5-EXCEPTIONS"]
    });
  }

  if (scenario.hasF2Dependents === "yes") {
    push({
      id: "f2-dependents",
      category: "dependents",
      tone: "info",
      title: "Your F-2 family's dates cannot extend past yours",
      detail: "Include each F-2 dependent in your extension plan. They must join your Form I-539 request or file their own timely request, as applicable.",
      sourceIds: ["8CFR-214-2-F5-EXCEPTIONS", "8CFR-214-2-F7"]
    });
  }

  for (const finding of primaryResult.findings) {
    if (!SPECIAL_FINDING_IDS.has(finding.id)) continue;
    push({
      id: `special-${finding.id}`,
      category: "special",
      tone: finding.tone,
      title: finding.title,
      detail: finding.detail,
      sourceIds: finding.sourceIds
    });
  }

  const focusCategories = new Set(focusTopics.map((topic) => TOPIC_CATEGORY[topic]));
  const sorted = [...claims].sort((left, right) => {
    const focusDifference = Number(focusCategories.has(right.category)) - Number(focusCategories.has(left.category));
    return focusDifference || categoryOrder(left.category) - categoryOrder(right.category);
  });
  const focusClaims = sorted.filter((claim) => focusCategories.has(claim.category));
  const otherClaims = sorted.filter((claim) => !focusCategories.has(claim.category));
  const unresolved = unique([
    ...primaryResult.followUpQuestions,
    ...(scenario.hasF2Dependents === "unknown" && anyRouteNeedsExtension ? ["Whether any F-2 dependents need the same extension plan."] : [])
  ]);

  return {
    ...conclusion,
    focusClaims,
    otherClaims,
    unresolved,
    ruleStatus: scenario.educationLevel && scenario.educationLevel !== "unknown"
      ? "School-transfer and program-change restrictions are scheduled for September 15, 2026. DHS may delay them through September 14, 2028; no delay was announced as of July 19, 2026."
      : undefined
  };
}

export function impactClaimText(map: ImpactMap): string[] {
  return [map.headline, map.summary, ...map.focusClaims.flatMap((claim) => [claim.title, claim.detail]), ...map.otherClaims.flatMap((claim) => [claim.title, claim.detail])];
}

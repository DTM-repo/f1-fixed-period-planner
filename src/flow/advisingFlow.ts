import type { IntakeTopic } from "../ai/intakePayload";
import type { StudentScenario } from "../engine/types";
import {
  EXPLORATION_OPTIONS,
  type ImpactCategory,
  type ImpactClaim,
  type ImpactMap
} from "../impact/impactMap";

export type CanonicalTopic = Exclude<IntakeTopic, "stem_opt" | "change_of_status">;

const TOPIC_CATEGORIES: Record<CanonicalTopic, ImpactCategory[]> = {
  stay_length: ["stay", "departure", "program_limits"],
  travel: ["travel"],
  extension: ["extension"],
  opt: ["opt"],
  cpt: ["cpt"],
  school_transfer: ["school_transfer"],
  program_change: ["program_change"],
  later_program: ["later_program"],
  dependents: ["dependents"],
  early_end: ["special"],
  immigrant_intent: ["immigrant_intent"],
  school_filing_support: ["school_support"]
};

export const IMPACT_TOPIC_ORDER: readonly CanonicalTopic[] = [
  "stay_length",
  "travel",
  "extension",
  "opt",
  "school_transfer",
  "program_change",
  "later_program",
  "cpt",
  "dependents",
  "early_end"
];

const QUESTION_TOPICS: Record<string, CanonicalTopic> = {
  travelIntent: "travel",
  returnAfterRule: "travel",
  returnDate: "travel",
  travelI20: "travel",
  travelProgramStart: "travel",
  travelProgramEnd: "travel",
  optIntent: "opt",
  optStatus: "opt",
  dsoRecommendation: "opt",
  optFilingDate: "opt",
  optBeforeTravel: "opt",
  eadEndDate: "opt",
  schoolTransfer: "school_transfer",
  programChange: "program_change",
  firstAcademicYear: "program_change",
  nextProgram: "later_program",
  previousProgramEnd: "later_program",
  nextProgramStart: "later_program",
  nextProgramEnd: "later_program",
  cptIntent: "cpt",
  f2Dependents: "dependents",
  earlyEnd: "early_end",
  earlyEndDate: "early_end"
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function canonicalTopic(topic: IntakeTopic): CanonicalTopic {
  if (topic === "stem_opt") return "opt";
  if (topic === "change_of_status") return "stay_length";
  return topic;
}

export function canonicalTopics(topics: IntakeTopic[]): CanonicalTopic[] {
  return unique(topics.map(canonicalTopic));
}

export function topicMeta(topic: IntakeTopic): { title: string; description: string } {
  const canonical = canonicalTopic(topic);
  const option = EXPLORATION_OPTIONS.find((item) => item.topic === canonical);
  return option ?? { title: "Your F-1 situation", description: "The dates and rules that affect your plans." };
}

export function claimsForTopic(map: ImpactMap, topic: IntakeTopic): ImpactClaim[] {
  const categories = new Set(TOPIC_CATEGORIES[canonicalTopic(topic)]);
  return [...map.focusClaims, ...map.otherClaims].filter((claim) => categories.has(claim.category));
}

export function allImpactTopics(): CanonicalTopic[] {
  return [...IMPACT_TOPIC_ORDER];
}

export function topicImpactLine(map: ImpactMap, topic: CanonicalTopic, scenario: StudentScenario): string {
  if (topic === "stay_length") {
    if (scenario.inUsOnEffectiveDate === "yes" && scenario.optStage.endsWith("approved")) {
      return "Old rules continue through approved OPT, followed by 60 days";
    }
    if (scenario.inUsOnEffectiveDate === "yes") {
      return "Old rules continue through your current I-20 or approved training, plus 60 days";
    }
    if (scenario.inUsOnEffectiveDate === "no") {
      return "Your dated I-94 includes 30 days after study or training";
    }
    return map.headline;
  }
  const claim = claimsForTopic(map, topic)[0];
  if (claim) return claim.title;

  const currentStudent = scenario.inUsOnEffectiveDate === "yes";
  const undergraduate = scenario.educationLevel === "undergraduate";
  const graduate = scenario.educationLevel === "graduate";
  const fallbacks: Record<CanonicalTopic, string> = {
    stay_length: map.headline,
    travel: currentStudent
      ? "Returning after September 15 gives you a dated I-94"
      : "Travel uses your I-20 dates, not a fresh four years",
    extension: "More study time can require Form I-539 or a new entry",
    opt: currentStudent
      ? "Some current students can skip Form I-539 for OPT"
      : "OPT can require a separate period of authorized stay",
    cpt: "CPT can continue only through its authorized end date",
    school_transfer: graduate
      ? "A graduate school transfer requires an SEVP exception"
      : undergraduate
        ? "Undergraduates cannot transfer during their first academic year"
        : "The new rule limits when you can transfer schools",
    program_change: graduate
      ? "Graduate students cannot change their major or degree level"
      : undergraduate
        ? "Undergraduates cannot change programs during their first academic year"
        : "The new rule limits major and education-level changes",
    later_program: "Your next F-1 program must be at a higher level",
    dependents: "F-2 family members cannot stay beyond your F-1 period",
    early_end: "Finishing early or withdrawing can shorten your time to leave",
    immigrant_intent: "A pending immigrant petition needs individual F-1 intent review",
    school_filing_support: "Your school decides what Form I-539 help it provides"
  };
  return fallbacks[topic];
}

export function baselineClaimForTopic(
  map: ImpactMap,
  topic: CanonicalTopic,
  scenario: StudentScenario
): ImpactClaim {
  const currentStudent = scenario.inUsOnEffectiveDate === "yes";
  const undergraduate = scenario.educationLevel === "undergraduate";
  const graduate = scenario.educationLevel === "graduate";
  const guidance: Record<CanonicalTopic, { detail: string; sourceIds: string[] }> = {
    stay_length: currentStudent
      ? {
          detail: "The I-20 or approved EAD in effect on September 15, 2026 controls how long the old rules continue, no later than September 15, 2030. The 60-day period follows.",
          sourceIds: ["8CFR-214-1-M1"]
        }
      : {
          detail: "Under the new system, CBP issues a dated I-94. The study period follows your I-20 but is normally limited to four years from the I-20 program start date, followed by 30 days.",
          sourceIds: ["8CFR-214-1-A4", "FR-FOUR-YEAR-START", "8CFR-214-2-F5V"]
        },
    travel: currentStudent
      ? {
          detail: "If you leave and return after September 15, 2026, you receive a dated I-94 under the new rules. The I-20 you use and the I-94 issued by CBP control the new end date. Leaving and returning can also be an alternative to Form I-539 when you need more time.",
          sourceIds: ["8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
        }
      : {
          detail: "Each F-1 admission uses the program dates on the I-20 you present. Returning later does not automatically begin four years from the travel date; the I-20 and the I-94 issued by CBP control.",
          sourceIds: ["8CFR-214-1-A4", "FR-FOUR-YEAR-START"]
        },
    extension: {
      detail: "If your I-94 ends before your study or authorized training, you must either file a complete Form I-539 on time or leave and request a new admission with an updated I-20. USCIS must receive a timely filing by the I-94 date.",
      sourceIds: ["8CFR-214-2-F7", "8CFR-214-2-F7-TIMELY"]
    },
    opt: currentStudent
      ? {
          detail: "The one-time OPT option applies only if your normal filing window lets you submit a DSO-recommended Form I-765 by March 18, 2027 and before your old-rule stay ends. If you plan to travel, submit the online application before you leave.",
          sourceIds: ["8CFR-214-1-M1-OPT"]
        }
      : {
          detail: "Post-completion OPT begins with a DSO recommendation and Form I-765. STEM OPT, if you qualify later, is a separate 24-month extension after regular post-completion OPT.",
          sourceIds: ["8CFR-214-2-F11", "USCIS-OPT-STEM"]
        },
    cpt: {
      detail: "The rule does not remove Day 1 CPT or change the basic CPT eligibility rules. CPT still requires DSO authorization and cannot continue past its authorized date or the end of the underlying program.",
      sourceIds: ["8CFR-214-2-F5VIII-CPT"]
    },
    school_transfer: {
      detail: graduate
        ? "During a graduate program, you cannot transfer schools unless SEVP approves an exception for extenuating circumstances."
        : undergraduate
          ? "During your first academic year, you cannot transfer schools unless SEVP approves an exception for extenuating circumstances."
          : "The new rule restricts school transfers. The exact limit depends on your education level and where you are in the program.",
      sourceIds: ["8CFR-214-2-F5II"]
    },
    program_change: {
      detail: graduate
        ? "During a graduate program, you cannot change your educational objective, including your major or education level."
        : undergraduate
          ? "During your first academic year, you cannot change your major or education level unless SEVP approves an exception for extenuating circumstances."
          : "The new rule restricts changes to a major or education level. The exact limit depends on your education level and where you are in the program.",
      sourceIds: ["8CFR-214-2-F5II"]
    },
    later_program: {
      detail: "After you complete an F-1 program on or after September 15, 2026, a later F-1 program generally must be at a higher education level. A program completed before that date does not count toward this limit.",
      sourceIds: ["8CFR-214-2-F5II-SAME-LOWER"]
    },
    dependents: {
      detail: "An F-2 spouse or child cannot receive a longer period of stay than you. Include each dependent when you plan an extension and check each I-94 after travel.",
      sourceIds: ["8CFR-214-2-F5-EXCEPTIONS", "8CFR-214-2-F7"]
    },
    early_end: {
      detail: "The ordinary timeline assumes you complete the program on your I-20 end date. Finishing early, withdrawing with school approval, or losing F-1 status can move your departure date earlier.",
      sourceIds: ["8CFR-214-2-F5V"]
    },
    immigrant_intent: {
      detail: "This final rule does not create a special answer for a pending I-140. USCIS can review whether you still meet the temporary-purpose requirements for F-1 status when it decides a Form I-539, so this needs individual advice.",
      sourceIds: ["FR-F1-TEMPORARY-INTENT", "FR-I140-OUT-OF-SCOPE"]
    },
    school_filing_support: {
      detail: "The rule sets the government filing requirements for Form I-539. It does not require a school to prepare or file the application for you; ask the school what support it provides.",
      sourceIds: ["8CFR-214-2-F7"]
    }
  };
  const canonical = canonicalTopic(topic);
  return {
    id: `explorer-baseline-${canonical}`,
    category: TOPIC_CATEGORIES[canonical][0],
    tone: "info",
    title: topicImpactLine(map, canonical, scenario),
    detail: guidance[canonical].detail,
    sourceIds: guidance[canonical].sourceIds
  };
}

export function topicForQuestion(questionId: string): CanonicalTopic | undefined {
  return QUESTION_TOPICS[questionId];
}

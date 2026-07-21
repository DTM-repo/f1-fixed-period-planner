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

export function topicForQuestion(questionId: string): CanonicalTopic | undefined {
  return QUESTION_TOPICS[questionId];
}

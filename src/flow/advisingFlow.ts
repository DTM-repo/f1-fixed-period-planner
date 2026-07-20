import type { IntakeTopic } from "../ai/intakePayload";
import {
  EXPLORATION_OPTIONS,
  type ImpactCategory,
  type ImpactClaim,
  type ImpactMap
} from "../impact/impactMap";

export type CanonicalTopic = Exclude<IntakeTopic, "stem_opt" | "change_of_status">;

export type ExplorationStep =
  | { kind: "offer"; topic: CanonicalTopic }
  | { kind: "question"; topic: CanonicalTopic }
  | { kind: "insight"; topic: CanonicalTopic }
  | { kind: "complete" };

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
  early_end: ["special"]
};

const DEFAULT_ORDER: CanonicalTopic[] = [
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

export function buildExplorationQueue(map: ImpactMap, focusTopics: IntakeTopic[]): CanonicalTopic[] {
  const focus = canonicalTopics(focusTopics);
  const categories = new Set([...map.focusClaims, ...map.otherClaims].map((claim) => claim.category));
  const applicable = DEFAULT_ORDER.filter((topic) => {
    if (topic === "stay_length") return true;
    if (topic === "dependents" && map.unresolved.some((item) => /F-2|dependent/i.test(item))) return true;
    return TOPIC_CATEGORIES[topic].some((category) => categories.has(category));
  });
  return unique([...focus, ...applicable]);
}

export function explorationStep({
  queue,
  focusTopics,
  acceptedTopics,
  completedTopics,
  hasQuestion,
  finished
}: {
  queue: CanonicalTopic[];
  focusTopics: IntakeTopic[];
  acceptedTopics: IntakeTopic[];
  completedTopics: IntakeTopic[];
  hasQuestion: (topic: CanonicalTopic) => boolean;
  finished: boolean;
}): ExplorationStep {
  if (finished) return { kind: "complete" };
  const completed = new Set(canonicalTopics(completedTopics));
  const topic = queue.find((item) => !completed.has(item));
  if (!topic) return { kind: "complete" };

  const accepted = new Set([...canonicalTopics(focusTopics), ...canonicalTopics(acceptedTopics)]);
  if (!accepted.has(topic)) return { kind: "offer", topic };
  if (hasQuestion(topic)) return { kind: "question", topic };
  return { kind: "insight", topic };
}

export function topicForQuestion(questionId: string): CanonicalTopic | undefined {
  return QUESTION_TOPICS[questionId];
}

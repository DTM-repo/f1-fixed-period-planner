import type { IntakeCandidateFact, IntakeCaseEvent, IntakeTopic } from "../ai/intakePayload";
import { DEFAULT_EFFECTIVE_DATE } from "../engine/calculateScenario";
import { compareDates, isValidDateString } from "../engine/dateMath";
import type { EducationLevel, StudentScenario } from "../engine/types";

export type CaseTopic = Exclude<IntakeTopic, "stem_opt" | "change_of_status">;

export type CaseEventKind =
  | "rule_date"
  | "program"
  | "practical_training"
  | "travel"
  | "later_program"
  | "immigrant_petition";

export type CaseEventRole =
  | "rule_effective_date"
  | "completed_program"
  | "active_program"
  | "incoming_program"
  | "approved_opt"
  | "planned_opt"
  | "planned_return"
  | "future_program"
  | "pending_petition";

export interface CaseDate {
  value: string;
  precision: "day" | "month" | "year";
}

export interface CaseEvent {
  id: string;
  kind: CaseEventKind;
  role: CaseEventRole;
  label: string;
  start?: CaseDate;
  end?: CaseDate;
  educationLevel?: EducationLevel;
  source: "student" | "confirmed" | "derived";
}

export type TopicApplicability = "applies" | "could_apply" | "needs_fact" | "not_applicable";

export interface CaseTopicEvaluation {
  topic: CaseTopic;
  applicability: TopicApplicability;
  reason: string;
}

export interface StudentCase {
  scenario: StudentScenario;
  events: CaseEvent[];
  concerns: CaseTopic[];
  topicEvaluations: CaseTopicEvaluation[];
}

const MAIN_TOPIC_ORDER: readonly CaseTopic[] = [
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

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function canonicalTopic(topic: IntakeTopic): CaseTopic {
  if (topic === "stem_opt") return "opt";
  if (topic === "change_of_status") return "stay_length";
  return topic;
}

function caseDate(value?: string): CaseDate | undefined {
  if (!value) return undefined;
  if (isValidDateString(value)) return { value, precision: "day" };
  if (/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(value)) return { value, precision: "month" };
  if (/^20\d{2}$/.test(value)) return { value, precision: "year" };
  return undefined;
}

function compatibleDate(first?: CaseDate, second?: CaseDate): boolean {
  if (!first || !second) return true;
  const shorter = first.value.length <= second.value.length ? first.value : second.value;
  const longer = first.value.length > second.value.length ? first.value : second.value;
  return longer === shorter || longer.startsWith(`${shorter}-`);
}

function definitelyBefore(value: string | undefined, comparison: string): boolean {
  if (!value) return false;
  if (isValidDateString(value)) return compareDates(value, comparison) < 0;
  if (/^20\d{2}-\d{2}$/.test(value)) return value < comparison.slice(0, 7);
  return /^20\d{2}$/.test(value) && value < comparison.slice(0, 4);
}

function factValue(facts: IntakeCandidateFact[], fields: IntakeCandidateFact["field"][]): string | undefined {
  return facts.find((fact) => fields.includes(fact.field) && fact.value !== "unknown")?.value;
}

function buildEvents(
  scenario: StudentScenario,
  facts: IntakeCandidateFact[],
  concerns: CaseTopic[],
  intakeEvents: IntakeCaseEvent[]
): CaseEvent[] {
  const events: CaseEvent[] = [{
    id: "rule-effective-date",
    kind: "rule_date",
    role: "rule_effective_date",
    label: "The new rule begins",
    start: caseDate(DEFAULT_EFFECTIVE_DATE),
    source: "derived"
  }];
  const programEnd = scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint ??
    factValue(facts, ["currentProgramEndDate", "programEndOnEffectiveDate"]);
  const programStart = scenario.programStartDate ?? factValue(facts, ["programStartDate"]);
  const approvedOpt = scenario.optStage.endsWith("approved");
  const currentStudent = scenario.inUsOnEffectiveDate === "yes" || scenario.startingPosition === "current_ds_inside_us";
  const completedProgram = Boolean(programEnd && approvedOpt && definitelyBefore(programEnd, DEFAULT_EFFECTIVE_DATE));

  if (programStart || programEnd) {
    events.push({
      id: completedProgram ? "completed-program" : currentStudent ? "active-program" : "incoming-program",
      kind: "program",
      role: completedProgram ? "completed_program" : currentStudent ? "active_program" : "incoming_program",
      label: completedProgram ? "Program completed" : currentStudent ? "Current program" : "Incoming program",
      start: caseDate(programStart),
      end: caseDate(programEnd),
      educationLevel: scenario.educationLevel,
      source: scenario.currentProgramEndDate || scenario.programStartDate ? "confirmed" : "student"
    });
  }

  const eadEnd = scenario.currentEadEndDate ?? scenario.currentEadEndDateHint ??
    factValue(facts, ["currentEadEndDate", "eadEndOnEffectiveDate"]);
  if (scenario.optIntent === "yes" || scenario.optStage !== "none" || concerns.includes("opt")) {
    events.push({
      id: approvedOpt ? "approved-opt" : "planned-opt",
      kind: "practical_training",
      role: approvedOpt ? "approved_opt" : "planned_opt",
      label: approvedOpt ? "Approved OPT" : "Planned post-completion OPT",
      end: caseDate(eadEnd),
      source: scenario.currentEadEndDate ? "confirmed" : "student"
    });
  }

  if (scenario.travelPosture === "planned" || scenario.travelPosture === "completed" || scenario.reentryDate) {
    events.push({
      id: "planned-return",
      kind: "travel",
      role: "planned_return",
      label: scenario.travelPosture === "completed" ? "Return to the United States" : "Possible return to the United States",
      start: caseDate(scenario.reentryDate),
      source: scenario.reentryDate ? "confirmed" : "student"
    });
  }

  const laterProgramKnown = ![undefined, "unknown", "not_planning"].includes(scenario.nextProgramLevelPlan) ||
    Boolean(scenario.nextProgramStartDate || scenario.nextProgramEndDate) || concerns.includes("later_program");
  if (laterProgramKnown) {
    events.push({
      id: "future-program",
      kind: "later_program",
      role: "future_program",
      label: "Possible later program",
      start: caseDate(scenario.nextProgramStartDate),
      end: caseDate(scenario.nextProgramEndDate),
      source: scenario.nextProgramStartDate || scenario.nextProgramEndDate ? "confirmed" : "student"
    });
  }

  if (scenario.pendingEmploymentImmigrantPetition === "yes" || concerns.includes("immigrant_intent")) {
    events.push({
      id: "pending-immigrant-petition",
      kind: "immigrant_petition",
      role: "pending_petition",
      label: "Pending employment-based immigrant petition",
      source: "student"
    });
  }

  for (const [index, event] of intakeEvents.entries()) {
    const start = caseDate(event.startDate);
    const end = caseDate(event.endDate);
    const scenarioEvent = events.find((item) =>
      !item.id.startsWith("intake-") &&
      item.kind === event.kind &&
      item.role === event.role
    );
    if (scenarioEvent) {
      if (compatibleDate(start, scenarioEvent.start) && compatibleDate(end, scenarioEvent.end)) {
        scenarioEvent.start ??= start;
        scenarioEvent.end ??= end;
        if (!scenarioEvent.educationLevel || scenarioEvent.educationLevel === "unknown") {
          scenarioEvent.educationLevel = event.educationLevel;
        }
      }
      continue;
    }
    const existing = events.find((item) =>
      item.kind === event.kind &&
      item.role === event.role &&
      compatibleDate(start, item.start) &&
      compatibleDate(end, item.end)
    );
    if (existing) {
      existing.start ??= start;
      existing.end ??= end;
      if (!existing.educationLevel || existing.educationLevel === "unknown") {
        existing.educationLevel = event.educationLevel;
      }
      continue;
    }
    events.push({
      id: `intake-${event.role}-${index}`,
      kind: event.kind,
      role: event.role,
      label: event.label,
      start,
      end,
      educationLevel: event.educationLevel,
      source: "student"
    });
  }

  return events;
}

function evaluateTopics(scenario: StudentScenario, events: CaseEvent[], concerns: CaseTopic[]): CaseTopicEvaluation[] {
  const concernSet = new Set(concerns);
  const hasCurrentProgram = events.some((event) => event.role === "active_program");
  const hasIncomingProgram = events.some((event) => event.role === "incoming_program");
  const hasFutureProgram = events.some((event) => event.role === "future_program");
  const hasApprovedOpt = events.some((event) => event.role === "approved_opt");
  const hasStudyContext = hasCurrentProgram || hasIncomingProgram || hasFutureProgram;
  const collegeProgram = scenario.programType === "college_or_university" || scenario.programType === "unknown" || !scenario.programType;
  const currentOrIncoming = scenario.inUsOnEffectiveDate !== "unknown" || scenario.startingPosition !== "unknown";
  const evaluations = new Map<CaseTopic, CaseTopicEvaluation>();
  const set = (topic: CaseTopic, applicability: TopicApplicability, reason: string) => {
    evaluations.set(topic, { topic, applicability, reason });
  };

  set("stay_length", "applies", "Every F-1 case needs a controlling period of stay.");
  set("travel", currentOrIncoming ? "applies" : "needs_fact", "Travel can create or replace the controlling admission period.");

  const extensionRelevant = concernSet.has("extension") || concernSet.has("opt") || hasFutureProgram ||
    scenario.optIntent === "yes" || scenario.inUsOnEffectiveDate === "no" || !events.some((event) => event.role === "active_program" && event.end?.precision === "day");
  set(
    "extension",
    extensionRelevant ? "could_apply" : "not_applicable",
    extensionRelevant ? "Study, training, or a later program may need more time." : "The known current program fits within the present stay."
  );

  const optRelevant = concernSet.has("opt") || scenario.optIntent !== "no" || scenario.optStage !== "none";
  set(
    "opt",
    collegeProgram && optRelevant ? (scenario.optIntent === "yes" || scenario.optStage !== "none" ? "applies" : "could_apply") : "not_applicable",
    collegeProgram ? "Post-completion OPT can change the required stay and travel timing." : "This program category does not use the ordinary college OPT path."
  );

  const schoolRulesRelevant = collegeProgram && (hasStudyContext || hasApprovedOpt);
  set("school_transfer", schoolRulesRelevant || concernSet.has("school_transfer") ? "could_apply" : "not_applicable", "Transfer rules depend on the program phase and education level.");
  set("program_change", hasStudyContext || concernSet.has("program_change") ? "could_apply" : "not_applicable", "Program-change limits apply only while a relevant program is active or planned.");

  const laterProgramRelevant = concernSet.has("later_program") || scenario.nextProgramLevelPlan !== "not_planning";
  set("later_program", laterProgramRelevant ? "could_apply" : "not_applicable", "A later F-1 program can trigger education-level and timing rules.");
  set("cpt", collegeProgram && hasStudyContext ? "could_apply" : concernSet.has("cpt") ? "needs_fact" : "not_applicable", "CPT applies only during a qualifying program of study.");
  set("dependents", scenario.hasF2Dependents === "no" && !concernSet.has("dependents") ? "not_applicable" : "could_apply", "F-2 family members follow the F-1 period of stay.");
  set("early_end", hasCurrentProgram || hasIncomingProgram || hasFutureProgram || concernSet.has("early_end") ? "could_apply" : "not_applicable", "Finishing early or withdrawing matters only during a program of study.");

  if (concernSet.has("immigrant_intent") || scenario.pendingEmploymentImmigrantPetition === "yes") {
    set("immigrant_intent", "applies", "A pending immigrant petition raises a separate F-1 temporary-purpose review issue.");
  }
  if (concernSet.has("school_filing_support")) {
    set("school_filing_support", "applies", "The student asked what filing help the school provides.");
  }

  return [...MAIN_TOPIC_ORDER, ...concerns.filter((topic) => !MAIN_TOPIC_ORDER.includes(topic))]
    .map((topic) => evaluations.get(topic))
    .filter((evaluation): evaluation is CaseTopicEvaluation => Boolean(evaluation));
}

export function buildStudentCase(
  scenario: StudentScenario,
  facts: IntakeCandidateFact[] = [],
  topics: IntakeTopic[] = [],
  intakeEvents: IntakeCaseEvent[] = []
): StudentCase {
  const concerns = unique(topics.map(canonicalTopic));
  const events = buildEvents(scenario, facts, concerns, intakeEvents);
  return {
    scenario,
    events,
    concerns,
    topicEvaluations: evaluateTopics(scenario, events, concerns)
  };
}

export function applicableCaseTopics(studentCase: StudentCase): CaseTopic[] {
  return studentCase.topicEvaluations
    .filter((evaluation) => evaluation.applicability !== "not_applicable")
    .map((evaluation) => evaluation.topic);
}

import type { IntakeCandidateFact, IntakeTopic } from "./intakePayload";
import type { StudentScenario } from "../engine/types";
import type { CaseEvent, CaseTopicEvaluation } from "../case/studentCase";

export interface AdvisorTurn {
  role: "user" | "assistant";
  text: string;
  sourceIds?: string[];
}

export interface FollowUpRequest {
  scenario: StudentScenario;
  question: string;
  focusTopics: IntakeTopic[];
  history: AdvisorTurn[];
  caseEvents?: CaseEvent[];
  applicableRuleAreas?: CaseTopicEvaluation[];
}

export interface FollowUpResponse {
  answer: string;
  sourceIds: string[];
  facts: IntakeCandidateFact[];
  topics: IntakeTopic[];
  model?: string;
}

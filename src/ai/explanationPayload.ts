import type { PlannerResult, StudentScenario } from "../engine/types";

export interface ExplanationRequest {
  scenario: StudentScenario;
  result: PlannerResult;
}

export interface ExplanationResponse {
  explanation: string;
  model?: string;
}

import type { StudentScenario } from "../engine/types";

export interface ExplanationRequest {
  scenario: StudentScenario;
}

export interface ExplanationResponse {
  title: string;
  paragraphs: string[];
  model?: string;
}

import type { StudentScenario } from "../engine/types";

export type IntakeFactField =
  | "startingPosition"
  | "admissionBasis"
  | "i94AdmitUntilDate"
  | "inUsOnEffectiveDate"
  | "maintainingStatusOnEffectiveDate"
  | "programEndOnEffectiveDate"
  | "currentProgramEndDate"
  | "eadEndOnEffectiveDate"
  | "currentEadEndDate"
  | "optStage"
  | "optFilingDate"
  | "travelPosture"
  | "reentryDate"
  | "reentryBasis"
  | "pendingExtensionOnDeparture"
  | "transferOrProgramChange"
  | "educationLevel"
  | "nextProgramLevelPlan"
  | "cptPlan";

export type IntakeConfidence = "high" | "medium" | "low";

export interface IntakeCandidateFact {
  field: IntakeFactField;
  value: string;
  label: string;
  confidence: IntakeConfidence;
  evidence: string;
  needsConfirmation: boolean;
  note: string;
}

export interface IntakeExtractionRequest {
  narrative: string;
  currentScenario: StudentScenario;
}

export interface IntakeExtractionResponse {
  summary: string;
  facts: IntakeCandidateFact[];
  followUpQuestions: string[];
  cautions: string[];
  model?: string;
}

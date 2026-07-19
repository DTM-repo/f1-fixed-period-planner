import type { StudentScenario } from "../engine/types";

export type IntakeFactField =
  | "startingPosition"
  | "admissionBasis"
  | "i94AdmitUntilDate"
  | "inUsOnEffectiveDate"
  | "maintainingStatusOnEffectiveDate"
  | "departBeforeEffectiveDate"
  | "programStartDate"
  | "programEndOnEffectiveDate"
  | "currentProgramEndDate"
  | "eadEndOnEffectiveDate"
  | "currentEadEndDate"
  | "optIntent"
  | "optStage"
  | "optFilingDate"
  | "travelPosture"
  | "reentryDate"
  | "reentryBasis"
  | "pendingExtensionOnDeparture"
  | "transferOrProgramChange"
  | "schoolTransferPlan"
  | "academicProgramChangePlan"
  | "educationLevel"
  | "programType"
  | "firstAcademicYearCompleted"
  | "nextProgramLevelPlan"
  | "dsoRecommendedOpt"
  | "hasF2Dependents"
  | "earlyEndSituation"
  | "earlyEndDate"
  | "returningAfterEffectiveDate"
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

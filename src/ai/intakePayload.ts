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

export type IntakeTopic =
  | "travel"
  | "opt"
  | "stem_opt"
  | "cpt"
  | "extension"
  | "school_transfer"
  | "program_change"
  | "change_of_status";

export interface IntakeCandidateFact {
  field: IntakeFactField;
  value: string;
  confidence: IntakeConfidence;
  needsConfirmation: boolean;
}

export interface IntakeExtractionRequest {
  narrative: string;
  currentScenario: StudentScenario;
}

export interface IntakeExtractionResponse {
  highlights: string[];
  topics: IntakeTopic[];
  facts: IntakeCandidateFact[];
  model?: string;
}

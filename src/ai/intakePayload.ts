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
  | "optFiledBeforeDeparture"
  | "travelPosture"
  | "reentryDate"
  | "reentryBasis"
  | "returnProgramStartDate"
  | "returnProgramEndDate"
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
  | "stay_length"
  | "travel"
  | "opt"
  | "stem_opt"
  | "cpt"
  | "extension"
  | "school_transfer"
  | "program_change"
  | "later_program"
  | "dependents"
  | "early_end"
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

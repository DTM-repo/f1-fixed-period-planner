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
  | "nextProgramStartDate"
  | "nextProgramEndDate"
  | "dsoRecommendedOpt"
  | "hasF2Dependents"
  | "earlyEndSituation"
  | "earlyEndDate"
  | "returningAfterEffectiveDate"
  | "cptPlan"
  | "pendingEmploymentImmigrantPetition";

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
  | "change_of_status"
  | "immigrant_intent"
  | "school_filing_support";

export interface IntakeCandidateFact {
  field: IntakeFactField;
  value: string;
  confidence: IntakeConfidence;
  needsConfirmation: boolean;
}

export interface IntakeCaseEvent {
  kind: "program" | "practical_training" | "travel" | "later_program" | "immigrant_petition";
  role:
    | "completed_program"
    | "active_program"
    | "incoming_program"
    | "approved_opt"
    | "planned_opt"
    | "planned_return"
    | "future_program"
    | "pending_petition";
  label: string;
  startDate: string;
  endDate: string;
  educationLevel: "undergraduate" | "graduate" | "other" | "unknown";
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
  events?: IntakeCaseEvent[];
  model?: string;
}

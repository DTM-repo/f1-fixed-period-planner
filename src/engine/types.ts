import type { SourceReference } from "../sources/sourceIndex";

export type DateString = string;
export type YesNoUnknown = "yes" | "no" | "unknown";

export type StartingPosition =
  | "current_ds_inside_us"
  | "prospective_outside_us"
  | "change_status_inside_us"
  | "readmitted_fixed_period"
  | "transfer_or_program_change"
  | "unknown";

export type AdmissionBasis = "duration_of_status" | "fixed_period" | "unknown";

export type OptStage =
  | "none"
  | "pre_completion"
  | "post_completion_not_filed"
  | "post_completion_pending"
  | "post_completion_approved"
  | "stem_not_filed"
  | "stem_pending"
  | "stem_approved";

export type TravelPosture =
  | "none"
  | "planned"
  | "completed"
  | "automatic_visa_revalidation"
  | "unknown";

export type ReentryBasis =
  | "same_i20_balance"
  | "new_f1_admission"
  | "longer_program_i20"
  | "automatic_visa_revalidation"
  | "unknown";

export type CptPlan = "none" | "planned" | "unknown";
export type EducationLevel = "undergraduate" | "graduate" | "other" | "unknown";
export type NextProgramLevelPlan = "higher" | "same_or_lower" | "not_planning" | "unknown";
export type ProgramType =
  | "college_or_university"
  | "english_language_training"
  | "public_high_school"
  | "private_high_school"
  | "other"
  | "unknown";

export type EarlyEndSituation =
  | "none"
  | "completed_early"
  | "authorized_withdrawal"
  | "status_violation"
  | "unknown";

export interface StudentScenario {
  startingPosition: StartingPosition;
  admissionBasis: AdmissionBasis;
  i94AdmitUntilDate?: DateString;
  inUsOnEffectiveDate: YesNoUnknown;
  maintainingStatusOnEffectiveDate: YesNoUnknown;
  departBeforeEffectiveDate?: YesNoUnknown;
  programStartDate?: DateString;
  programEndOnEffectiveDate?: DateString;
  currentProgramEndDate?: DateString;
  eadEndOnEffectiveDate?: DateString;
  currentEadEndDate?: DateString;
  optIntent?: YesNoUnknown;
  optStage: OptStage;
  optFilingDate?: DateString;
  travelPosture: TravelPosture;
  reentryDate?: DateString;
  reentryBasis: ReentryBasis;
  returnProgramStartDate?: DateString;
  returnProgramEndDate?: DateString;
  pendingExtensionOnDeparture: YesNoUnknown;
  transferOrProgramChange: YesNoUnknown;
  schoolTransferPlan?: YesNoUnknown;
  academicProgramChangePlan?: YesNoUnknown;
  educationLevel?: EducationLevel;
  programType?: ProgramType;
  firstAcademicYearCompleted?: YesNoUnknown;
  nextProgramLevelPlan?: NextProgramLevelPlan;
  dsoRecommendedOpt?: YesNoUnknown;
  hasF2Dependents?: YesNoUnknown;
  earlyEndSituation?: EarlyEndSituation;
  earlyEndDate?: DateString;
  returningAfterEffectiveDate?: YesNoUnknown;
  cptPlan: CptPlan;
  narrative?: string;
  effectiveDate?: DateString;
}

export type ResultStatus = "ok" | "caution" | "risk" | "manual";

export interface AppliedRule {
  id: string;
  label: string;
  summary: string;
  sourceIds: string[];
}

export interface Finding {
  id: string;
  tone: "good" | "info" | "warning" | "danger" | "question";
  title: string;
  detail: string;
  sourceIds: string[];
}

export interface TimelineItem {
  date: DateString;
  title: string;
  detail: string;
  tone: "neutral" | "good" | "warning" | "danger";
}

export interface PlannerResult {
  deterministic: true;
  classification:
    | "transition_ds"
    | "incoming_fixed_period"
    | "change_of_status_fixed_period"
    | "fixed_period_reentry"
    | "manual_review";
  status: ResultStatus;
  headline: string;
  summary: string;
  effectiveDate: DateString;
  transitionCapDate: DateString;
  activityEnd?: DateString;
  coverageEnd?: DateString;
  i94AdmitUntilDate?: DateString;
  departurePeriodDays?: number;
  latestDepartureDate?: DateString;
  extensionPlanningDate?: DateString;
  extensionFilingDeadline?: DateString;
  extensionNeededBy?: DateString;
  i765TransitionDeadline?: DateString;
  appliedRules: AppliedRule[];
  findings: Finding[];
  timeline: TimelineItem[];
  followUpQuestions: string[];
  nextActions: string[];
  citations: SourceReference[];
}

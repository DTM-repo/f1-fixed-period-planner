import type { StudentScenario } from "../engine/types";

export const DEFAULT_SCENARIO: StudentScenario = {
  startingPosition: "unknown",
  admissionBasis: "unknown",
  inUsOnEffectiveDate: "unknown",
  maintainingStatusOnEffectiveDate: "unknown",
  departBeforeEffectiveDate: "unknown",
  optIntent: "unknown",
  optStage: "none",
  optFiledBeforeDeparture: "unknown",
  travelPosture: "unknown",
  reentryBasis: "unknown",
  pendingExtensionOnDeparture: "unknown",
  transferOrProgramChange: "unknown",
  schoolTransferPlan: "unknown",
  academicProgramChangePlan: "unknown",
  educationLevel: "unknown",
  programType: "unknown",
  firstAcademicYearCompleted: "unknown",
  nextProgramLevelPlan: "unknown",
  dsoRecommendedOpt: "unknown",
  hasF2Dependents: "unknown",
  earlyEndSituation: "none",
  returningAfterEffectiveDate: "unknown",
  cptPlan: "none"
};

export const DEMO_SCENARIOS: Array<{ id: string; label: string; scenario: StudentScenario }> = [
  {
    id: "transition-long-program",
    label: "Current student, long program",
    scenario: {
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      programStartDate: "2025-08-25",
      programEndOnEffectiveDate: "2031-05-15",
      currentProgramEndDate: "2031-05-15",
      optStage: "none",
      travelPosture: "none",
      reentryBasis: "unknown",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      educationLevel: "graduate",
      programType: "college_or_university",
      firstAcademicYearCompleted: "yes",
      nextProgramLevelPlan: "unknown",
      cptPlan: "none"
    }
  },
  {
    id: "incoming",
    label: "Incoming after rule date",
    scenario: {
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      programStartDate: "2026-08-24",
      currentProgramEndDate: "2030-05-20",
      optStage: "none",
      travelPosture: "none",
      reentryBasis: "unknown",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      educationLevel: "undergraduate",
      programType: "college_or_university",
      firstAcademicYearCompleted: "no",
      nextProgramLevelPlan: "higher",
      cptPlan: "none"
    }
  },
  {
    id: "transition-travel",
    label: "Current student with travel",
    scenario: {
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      programStartDate: "2025-08-25",
      programEndOnEffectiveDate: "2031-05-15",
      currentProgramEndDate: "2031-05-15",
      optStage: "none",
      travelPosture: "planned",
      reentryDate: "2027-08-20",
      reentryBasis: "new_f1_admission",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      educationLevel: "graduate",
      programType: "college_or_university",
      firstAcademicYearCompleted: "yes",
      nextProgramLevelPlan: "unknown",
      cptPlan: "none"
    }
  },
  {
    id: "opt-transition",
    label: "Current student planning OPT",
    scenario: {
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      programStartDate: "2023-08-28",
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "post_completion_not_filed",
      optFilingDate: "2027-02-10",
      travelPosture: "none",
      reentryBasis: "unknown",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      educationLevel: "undergraduate",
      programType: "college_or_university",
      firstAcademicYearCompleted: "yes",
      nextProgramLevelPlan: "unknown",
      cptPlan: "none"
    }
  }
];

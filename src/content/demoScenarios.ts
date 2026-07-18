import type { StudentScenario } from "../engine/types";

export const DEFAULT_SCENARIO: StudentScenario = {
  startingPosition: "current_ds_inside_us",
  admissionBasis: "duration_of_status",
  inUsOnEffectiveDate: "yes",
  maintainingStatusOnEffectiveDate: "yes",
  programEndOnEffectiveDate: "2031-05-15",
  currentProgramEndDate: "2031-05-15",
  optStage: "none",
  travelPosture: "none",
  reentryBasis: "unknown",
  pendingExtensionOnDeparture: "no",
  transferOrProgramChange: "no",
  cptPlan: "none"
};

export const DEMO_SCENARIOS: Array<{ id: string; label: string; scenario: StudentScenario }> = [
  {
    id: "transition-long-program",
    label: "Current D/S, long program",
    scenario: DEFAULT_SCENARIO
  },
  {
    id: "incoming",
    label: "Incoming F-1",
    scenario: {
      startingPosition: "prospective_outside_us",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown",
      currentProgramEndDate: "2030-05-20",
      optStage: "none",
      travelPosture: "none",
      reentryBasis: "unknown",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      cptPlan: "none"
    }
  },
  {
    id: "transition-travel",
    label: "Travel reset test",
    scenario: {
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      programEndOnEffectiveDate: "2031-05-15",
      currentProgramEndDate: "2031-05-15",
      optStage: "none",
      travelPosture: "planned",
      reentryDate: "2027-08-20",
      reentryBasis: "new_f1_admission",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      cptPlan: "none"
    }
  },
  {
    id: "opt-transition",
    label: "Post-OPT transition",
    scenario: {
      startingPosition: "current_ds_inside_us",
      admissionBasis: "duration_of_status",
      inUsOnEffectiveDate: "yes",
      maintainingStatusOnEffectiveDate: "yes",
      programEndOnEffectiveDate: "2026-12-20",
      currentProgramEndDate: "2026-12-20",
      optStage: "post_completion_not_filed",
      optFilingDate: "2027-02-10",
      travelPosture: "none",
      reentryBasis: "unknown",
      pendingExtensionOnDeparture: "no",
      transferOrProgramChange: "no",
      cptPlan: "none"
    }
  }
];

import type { StudentScenario } from "../engine/types";
import { canonicalTopics, type CanonicalTopic } from "../flow/advisingFlow";
import type { IntakeTopic } from "./intakePayload";

export function directlyRelevantReportTopics(
  scenario: StudentScenario,
  extensionNeeded: boolean
): CanonicalTopic[] {
  return canonicalTopics([
    ...(extensionNeeded ? ["extension" as const] : []),
    ...(["planned", "completed"].includes(scenario.travelPosture) || scenario.returningAfterEffectiveDate === "yes"
      ? ["travel" as const]
      : []),
    ...(scenario.optIntent === "yes" || scenario.optStage !== "none" ? ["opt" as const] : []),
    ...(scenario.cptPlan === "planned" ? ["cpt" as const] : []),
    ...(scenario.schoolTransferPlan === "yes" ? ["school_transfer" as const] : []),
    ...(scenario.academicProgramChangePlan === "yes" ? ["program_change" as const] : []),
    ...(!["not_planning", "unknown"].includes(scenario.nextProgramLevelPlan ?? "unknown") ? ["later_program" as const] : []),
    ...(scenario.hasF2Dependents === "yes" ? ["dependents" as const] : []),
    ...(!["none", "unknown"].includes(scenario.earlyEndSituation ?? "unknown") ? ["early_end" as const] : []),
    ...(scenario.pendingEmploymentImmigrantPetition === "yes" ? ["immigrant_intent" as const] : [])
  ]);
}

export function reportTopicsFor(
  scenario: StudentScenario,
  focusTopics: IntakeTopic[] = [],
  exploredTopics: IntakeTopic[] = [],
  extensionNeeded = false
): CanonicalTopic[] {
  return canonicalTopics([
    "stay_length",
    ...focusTopics,
    ...exploredTopics,
    ...directlyRelevantReportTopics(scenario, extensionNeeded)
  ]);
}

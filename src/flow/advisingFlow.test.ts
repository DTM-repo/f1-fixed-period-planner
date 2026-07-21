import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import type { StudentScenario } from "../engine/types";
import type { ImpactMap } from "../impact/impactMap";
import {
  allImpactTopics,
  baselineClaimForTopic,
  canonicalTopics,
  claimsForTopic,
  topicImpactLine
} from "./advisingFlow";

const map: ImpactMap = {
  headline: "You are under the old rules",
  summary: "Your current stay remains under D/S.",
  sourceIds: [],
  focusClaims: [{ id: "opt", category: "opt", tone: "info", title: "Some current students can skip Form I-539 for OPT", detail: "Plan the filing window.", sourceIds: [] }],
  otherClaims: [
    { id: "travel", category: "travel", tone: "info", title: "A return after September 15 starts the new rules", detail: "A return changes the rules.", sourceIds: [] },
    { id: "departure", category: "departure", tone: "good", title: "You keep 60 days after study or approved training", detail: "The old period remains.", sourceIds: [] },
    { id: "extension", category: "extension", tone: "info", title: "You do not need Form I-539 to finish this program", detail: "No filing is needed for this program.", sourceIds: [] }
  ],
  unresolved: []
};

const currentGraduate: StudentScenario = {
  ...DEFAULT_SCENARIO,
  startingPosition: "current_ds_inside_us",
  admissionBasis: "duration_of_status",
  inUsOnEffectiveDate: "yes",
  maintainingStatusOnEffectiveDate: "yes",
  educationLevel: "graduate"
};

describe("student-controlled impact map", () => {
  it("defines every impact area in one stable order", () => {
    expect(allImpactTopics()).toEqual([
      "stay_length",
      "travel",
      "extension",
      "opt",
      "school_transfer",
      "program_change",
      "later_program",
      "cpt",
      "dependents",
      "early_end"
    ]);
  });

  it("keeps priorities in the order the student selected them", () => {
    expect(canonicalTopics(["opt", "travel", "stem_opt", "extension", "travel"])).toEqual([
      "opt",
      "travel",
      "extension"
    ]);
  });

  it("uses the verified claim title for a compact impact line", () => {
    expect(topicImpactLine(map, "travel", currentGraduate)).toBe("A return after September 15 starts the new rules");
    expect(topicImpactLine(map, "extension", currentGraduate)).toBe("You do not need Form I-539 to finish this program");
  });

  it("turns the main conclusion into a specific length-of-stay line", () => {
    expect(topicImpactLine(map, "stay_length", currentGraduate)).toBe("Old rules continue through your current I-20 or approved training, plus 60 days");
    expect(claimsForTopic(map, "stay_length").map((claim) => claim.id)).toContain("departure");
  });

  it("gives literal category-specific fallbacks when no detailed claim exists", () => {
    expect(topicImpactLine(map, "school_transfer", currentGraduate)).toBe("A graduate school transfer requires an SEVP exception");
    expect(topicImpactLine(map, "program_change", currentGraduate)).toBe("Graduate students cannot change their major or degree level");
    expect(topicImpactLine(map, "dependents", currentGraduate)).toBe("F-2 family members cannot stay beyond your F-1 period");
  });

  it("gives every unexplored topic concise grounded guidance", () => {
    const claim = baselineClaimForTopic(map, "extension", currentGraduate);
    expect(claim.detail).toContain("Form I-539");
    expect(claim.sourceIds).toEqual(["8CFR-214-2-F7", "8CFR-214-2-F7-TIMELY"]);
  });

  it("uses education-level-specific academic guidance", () => {
    expect(baselineClaimForTopic(map, "school_transfer", currentGraduate).detail).toContain("graduate program");
    expect(baselineClaimForTopic(map, "program_change", currentGraduate).detail).not.toContain("first academic year");
  });
});

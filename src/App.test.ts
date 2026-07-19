import { describe, expect, it } from "vitest";
import { mergeFacts } from "./App";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import type { IntakeCandidateFact } from "./ai/intakePayload";

function fact(field: IntakeCandidateFact["field"], value: string): IntakeCandidateFact {
  return { field, value, confidence: "high", needsConfirmation: false };
}

describe("confirmed September 15 answer", () => {
  it("cannot be overwritten by a conflicting narrative extraction", () => {
    const current = {
      ...DEFAULT_SCENARIO,
      inUsOnEffectiveDate: "yes" as const,
      maintainingStatusOnEffectiveDate: "yes" as const,
      admissionBasis: "duration_of_status" as const,
      startingPosition: "current_ds_inside_us" as const
    };
    const merged = mergeFacts(current, [
      fact("inUsOnEffectiveDate", "no"),
      fact("maintainingStatusOnEffectiveDate", "no"),
      fact("startingPosition", "prospective_outside_us")
    ], true);
    expect(merged.inUsOnEffectiveDate).toBe("yes");
    expect(merged.maintainingStatusOnEffectiveDate).toBe("yes");
    expect(merged.startingPosition).toBe("current_ds_inside_us");
    expect(merged.admissionBasis).toBe("duration_of_status");
  });

  it("keeps a no answer but can still recognize an in-country change of status", () => {
    const current = {
      ...DEFAULT_SCENARIO,
      inUsOnEffectiveDate: "no" as const,
      startingPosition: "prospective_outside_us" as const,
      admissionBasis: "fixed_period" as const
    };
    const merged = mergeFacts(current, [
      fact("inUsOnEffectiveDate", "yes"),
      fact("startingPosition", "change_status_inside_us")
    ], true);
    expect(merged.inUsOnEffectiveDate).toBe("no");
    expect(merged.startingPosition).toBe("change_status_inside_us");
    expect(merged.admissionBasis).toBe("fixed_period");
  });
});

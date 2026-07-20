import { describe, expect, it } from "vitest";

import { SOURCE_INDEX, sourceLinkLabel } from "./sourceIndex";

describe("source links", () => {
  it("uses stable Federal Register paragraph anchors for rule passages", () => {
    const rulePassages = Object.values(SOURCE_INDEX).filter((reference) =>
      reference.url.includes("federalregister.gov") && reference.id !== "FR-2026-FINAL-RULE"
    );

    expect(rulePassages.length).toBeGreaterThan(0);
    rulePassages.forEach((reference) => {
      expect(reference.url).toMatch(/#p-\d+$/);
      expect(reference.url).not.toContain(":~:text=");
      expect(sourceLinkLabel(reference)).toBe("Open the highlighted rule passage");
    });
  });

  it("does not promise a highlight for general or non-rule sources", () => {
    expect(sourceLinkLabel(SOURCE_INDEX["FR-2026-FINAL-RULE"])).toBe("Open the official rule");
    expect(sourceLinkLabel(SOURCE_INDEX["USCIS-OPT-STEM"])).toBe("Open the cited source");
  });
});

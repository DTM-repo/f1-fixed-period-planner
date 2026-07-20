import { describe, expect, it } from "vitest";
import type { ImpactMap } from "../impact/impactMap";
import { buildExplorationQueue, explorationStep } from "./advisingFlow";

const map: ImpactMap = {
  headline: "You are under the old rules",
  summary: "Your current stay remains under D/S.",
  sourceIds: [],
  focusClaims: [{ id: "opt", category: "opt", tone: "info", title: "OPT matters", detail: "Plan the filing window.", sourceIds: [] }],
  otherClaims: [
    { id: "travel", category: "travel", tone: "info", title: "Travel matters", detail: "A return changes the rules.", sourceIds: [] },
    { id: "departure", category: "departure", tone: "good", title: "You keep 60 days", detail: "The old period remains.", sourceIds: [] },
    { id: "extension", category: "extension", tone: "info", title: "More time", detail: "Two routes are available.", sourceIds: [] }
  ],
  unresolved: []
};

describe("one-at-a-time advising flow", () => {
  it("puts the student's concern first and then adds applicable areas", () => {
    expect(buildExplorationQueue(map, ["opt"])).toEqual(["opt", "stay_length", "travel", "extension"]);
  });

  it("offers an unselected area instead of silently skipping it", () => {
    expect(explorationStep({
      queue: ["travel"],
      focusTopics: [],
      acceptedTopics: [],
      completedTopics: [],
      hasQuestion: () => false,
      finished: false
    })).toEqual({ kind: "offer", topic: "travel" });
  });

  it("asks one controlling question for an accepted area", () => {
    expect(explorationStep({
      queue: ["travel", "extension"],
      focusTopics: ["travel"],
      acceptedTopics: [],
      completedTopics: [],
      hasQuestion: (topic) => topic === "travel",
      finished: false
    })).toEqual({ kind: "question", topic: "travel" });
  });

  it("shows substantive guidance when an area needs no more facts", () => {
    expect(explorationStep({
      queue: ["extension"],
      focusTopics: [],
      acceptedTopics: ["extension"],
      completedTopics: [],
      hasQuestion: () => false,
      finished: false
    })).toEqual({ kind: "insight", topic: "extension" });
  });

  it("moves to the next area only after the current one is complete", () => {
    expect(explorationStep({
      queue: ["travel", "extension"],
      focusTopics: ["travel"],
      acceptedTopics: [],
      completedTopics: ["travel"],
      hasQuestion: () => false,
      finished: false
    })).toEqual({ kind: "offer", topic: "extension" });
  });

  it("finishes after every applicable area has been addressed", () => {
    expect(explorationStep({
      queue: ["travel", "extension"],
      focusTopics: ["travel"],
      acceptedTopics: ["extension"],
      completedTopics: ["travel", "extension"],
      hasQuestion: () => false,
      finished: false
    })).toEqual({ kind: "complete" });
  });

  it("lets the student request the complete advisement at any step", () => {
    expect(explorationStep({
      queue: ["travel"],
      focusTopics: [],
      acceptedTopics: [],
      completedTopics: [],
      hasQuestion: () => true,
      finished: true
    })).toEqual({ kind: "complete" });
  });
});

export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

const REASONING_EFFORTS = new Set<ReasoningEffort>([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max"
]);

export function reasoningEffort(value: string | undefined, fallback: ReasoningEffort): ReasoningEffort {
  return value && REASONING_EFFORTS.has(value as ReasoningEffort)
    ? value as ReasoningEffort
    : fallback;
}

import { formatDate } from "../engine/dateMath";
import type { PlannerResult } from "../engine/types";

export function buildLocalExplanation(result: PlannerResult): string {
  const lines = [
    `Here is what the calculator can say from the facts entered so far: ${result.headline}.`,
    result.summary
  ];

  if (result.coverageEnd) {
    lines.push(`The tested status or admission end is ${formatDate(result.coverageEnd)}.`);
  }

  if (result.latestDepartureDate) {
    lines.push(`The tested stay-through/departure-period date is ${formatDate(result.latestDepartureDate)}.`);
  }

  const priorityFindings = result.findings
    .filter((finding) => finding.tone !== "good")
    .slice(0, 3)
    .map((finding) => `${finding.title}: ${finding.detail}`);

  if (priorityFindings.length) {
    lines.push(["The main things to check next:", ...priorityFindings.map((finding) => `- ${finding}`)].join("\n"));
  }

  if (result.followUpQuestions.length) {
    lines.push(["The next facts that would sharpen this result:", ...result.followUpQuestions.map((question) => `- ${question}`)].join("\n"));
  }

  lines.push(
    "This explanation is generated from the deterministic calculator result. It does not add new legal conclusions beyond the cited rule findings."
  );

  return lines.join("\n\n");
}

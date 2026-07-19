import { formatDate } from "../engine/dateMath";
import type { PlannerResult } from "../engine/types";

export function buildLocalExplanation(result: PlannerResult): string {
  const lines = [`Under the new rules in your situation, here is what your answers show so far: ${result.headline}. ${result.summary}`];

  if (result.coverageEnd) {
    lines.push(`The important end date in this scenario is ${formatDate(result.coverageEnd)}.`);
  }

  if (result.latestDepartureDate) {
    lines.push(`After that, your F-1 period to leave the United States or take another immigration step runs through ${formatDate(result.latestDepartureDate)}.`);
  }

  const priorityFindings = result.findings
    .filter((finding) => finding.tone !== "good")
    .slice(0, 3)
    .map((finding) => `${finding.title}: ${finding.detail}`);

  if (priorityFindings.length) {
    lines.push(`The main things to check next are ${priorityFindings.join(" ")}`);
  }

  if (result.followUpQuestions.length) {
    lines.push(`The next detail that would sharpen this result is: ${result.followUpQuestions[0]}`);
  }

  lines.push("This note uses only the rule result and source-linked findings already shown here.");

  return lines.join("\n\n");
}

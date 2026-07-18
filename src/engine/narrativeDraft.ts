import type { StudentScenario } from "./types";

const isoDatePattern = /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g;
const usDatePattern = /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/g;

function pad(value: string): string {
  return value.padStart(2, "0");
}

function normalizeDate(match: RegExpExecArray, order: "ymd" | "mdy"): string {
  if (order === "ymd") {
    return `${match[1]}-${pad(match[2])}-${pad(match[3])}`;
  }
  return `${match[3]}-${pad(match[1])}-${pad(match[2])}`;
}

function extractDates(text: string): string[] {
  const dates = new Set<string>();
  for (const match of text.matchAll(isoDatePattern)) {
    dates.add(normalizeDate(match, "ymd"));
  }
  for (const match of text.matchAll(usDatePattern)) {
    dates.add(normalizeDate(match, "mdy"));
  }
  return [...dates].sort();
}

export function draftScenarioFromNarrative(text: string, current: StudentScenario): StudentScenario {
  const normalized = text.toLowerCase();
  const dates = extractDates(text);
  const next: StudentScenario = {
    ...current,
    narrative: text
  };

  if (/\b(incoming|outside the u\.?s\.?|not in the u\.?s\.?|haven't entered|have not entered)\b/.test(normalized)) {
    next.startingPosition = "prospective_outside_us";
    next.admissionBasis = "fixed_period";
    next.inUsOnEffectiveDate = "no";
    next.maintainingStatusOnEffectiveDate = "unknown";
  }

  if (/\b(d\/s|duration of status)\b/.test(normalized)) {
    next.admissionBasis = "duration_of_status";
  }

  if (/\btransfer|transferring|new school|change of program|change program|higher degree\b/.test(normalized)) {
    next.transferOrProgramChange = "yes";
    next.startingPosition =
      next.startingPosition === "prospective_outside_us" ? "prospective_outside_us" : "transfer_or_program_change";
  }

  if (/\bstem opt\b/.test(normalized)) {
    next.optStage = /\bnot filed|haven't filed|have not filed|will file\b/.test(normalized)
      ? "stem_not_filed"
      : "stem_pending";
  } else if (/\bpost[- ]?completion opt|opt\b/.test(normalized)) {
    next.optStage = /\bnot filed|haven't filed|have not filed|will file\b/.test(normalized)
      ? "post_completion_not_filed"
      : "post_completion_pending";
  }

  if (/\bcpt\b/.test(normalized)) {
    next.cptPlan = "unknown";
  }

  if (/\btravel|leave the u\.?s\.?|re-enter|reenter|return\b/.test(normalized)) {
    next.travelPosture = "planned";
    next.reentryBasis = "unknown";
  }

  if (!next.programEndOnEffectiveDate && dates[0]) {
    next.programEndOnEffectiveDate = dates[0];
  }

  if (!next.currentProgramEndDate && dates.at(-1)) {
    next.currentProgramEndDate = dates.at(-1);
  }

  if (!next.reentryDate && dates.length > 1 && /\btravel|re-enter|reenter|return\b/.test(normalized)) {
    next.reentryDate = dates[0];
  }

  return next;
}

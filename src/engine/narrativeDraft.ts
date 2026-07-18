import type { StudentScenario } from "./types";
import { normalizeDateInput } from "./dateMath";

const explicitDatePattern =
  /\b(?:20\d{2}-\d{1,2}-\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?),?\s+20\d{2})\b/gi;

interface DateMention {
  value: string;
  before: string;
  after: string;
  context: string;
}

function extractDateMentions(text: string): DateMention[] {
  const mentions: DateMention[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(explicitDatePattern)) {
    const normalized = normalizeDateInput(match[0]);
    if (!normalized.value || seen.has(`${normalized.value}-${match.index}`)) {
      continue;
    }
    seen.add(`${normalized.value}-${match.index}`);
    const start = Math.max(0, match.index - 70);
    const end = Math.min(text.length, match.index + match[0].length + 70);
    const beforeStart = Math.max(0, match.index - 45);
    const afterEnd = Math.min(text.length, match.index + match[0].length + 35);
    mentions.push({
      value: normalized.value,
      before: text.slice(beforeStart, match.index).toLowerCase(),
      after: text.slice(match.index + match[0].length, afterEnd).toLowerCase(),
      context: text.slice(start, end).toLowerCase()
    });
  }
  return mentions;
}

export function draftScenarioFromNarrative(text: string, current: StudentScenario): StudentScenario {
  const normalized = text.toLowerCase();
  const dateMentions = extractDateMentions(text);
  const dates = dateMentions.map((mention) => mention.value);
  const next: StudentScenario = {
    ...current,
    narrative: text
  };

  if (/\b(incoming|outside the u\.?s\.?|not in the u\.?s\.?|haven't entered|have not entered)\b/.test(normalized)) {
    next.startingPosition = "prospective_outside_us";
    next.admissionBasis = "fixed_period";
    next.inUsOnEffectiveDate = "no";
    next.maintainingStatusOnEffectiveDate = "unknown";
  } else if (/\b(in the u\.?s\.?|inside the u\.?s\.?|already here|current f-?1)\b/.test(normalized)) {
    next.startingPosition = "current_ds_inside_us";
    next.inUsOnEffectiveDate = "yes";
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

  for (const mention of dateMentions) {
    const nearBefore = mention.before.slice(-36);
    const nearbyWords = `${nearBefore} ${mention.after.slice(0, 24)}`;
    if (/\b(ead|work permit|employment authorization|card expires|card ends)\b/.test(nearBefore)) {
      next.currentEadEndDate = mention.value;
      if (/\bseptember 15|sep\.? 15|effective date|on sep|on september\b/.test(mention.context)) {
        next.eadEndOnEffectiveDate = mention.value;
      }
      continue;
    }
    if (/\b(i-?765|file|filing|apply|application|receipt)\b/.test(nearBefore)) {
      next.optFilingDate = mention.value;
      continue;
    }
    if (/\b(i-?20|program|school|degree|study|studies|graduate|graduation|complete|finish|end|ends)\b/.test(nearBefore)) {
      next.programEndOnEffectiveDate = mention.value;
      next.currentProgramEndDate = mention.value;
      continue;
    }
    if (/\b(travel|leave|re-enter|reenter|return|coming back|come back|arrive|arrival|enter)\b/.test(nearBefore)) {
      next.reentryDate = mention.value;
      continue;
    }
    if (/\b(ead|work permit|employment authorization|i-?765|file|filing|apply|application|receipt|travel|leave|re-enter|reenter|return|coming back|come back|arrive|arrival|enter)\b/.test(nearbyWords)) {
      continue;
    }
    if (/\b(i-?20|program|school|degree|study|studies|graduate|graduation|complete|finish|end|ends)\b/.test(mention.context)) {
      next.programEndOnEffectiveDate = mention.value;
      next.currentProgramEndDate = mention.value;
    }
  }

  if (dates.length === 1 && !next.currentProgramEndDate) {
    next.currentProgramEndDate = dates[0];
  }
  if (dates.length > 0 && !next.programEndOnEffectiveDate && next.startingPosition !== "prospective_outside_us") {
    next.programEndOnEffectiveDate = dates.at(-1);
  }

  return next;
}

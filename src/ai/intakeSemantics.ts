import type { IntakeCandidateFact, IntakeTopic } from "./intakePayload";

const TOPICS: IntakeTopic[] = [
  "travel",
  "opt",
  "stem_opt",
  "cpt",
  "extension",
  "school_transfer",
  "program_change",
  "change_of_status"
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const TOPIC_PATTERNS: Record<IntakeTopic, RegExp> = {
  travel: /\b(?:travel|trip|fly|flying|return|re-?enter|come back|go abroad|leave the (?:u\.?s\.?|united states))\b/i,
  opt: /\b(?:opt|optional practical training)\b/i,
  stem_opt: /\b(?:stem[ -]?opt|stem optional practical training)\b/i,
  cpt: /\b(?:cpt|curricular practical training|day[ -]?1 cpt)\b/i,
  extension: /\b(?:i-?539|extension of stay|extend my (?:stay|status|program))\b/i,
  school_transfer: /\b(?:transfer(?:ring)? (?:schools?|to another school)|school transfer)\b/i,
  program_change: /\b(?:change (?:my )?(?:major|program|degree|education level)|switch (?:my )?(?:major|program|degree))\b/i,
  change_of_status: /\b(?:change of status|change (?:my )?status (?:to|into) f-?1)\b/i
};

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isTopic(value: unknown): value is IntakeTopic {
  return typeof value === "string" && TOPICS.includes(value as IntakeTopic);
}

export function deriveNarrativeTopics(narrative: string, modelTopics: unknown): IntakeTopic[] {
  const supplied = Array.isArray(modelTopics) ? modelTopics.filter(isTopic) : [];
  const detected = TOPICS.filter((topic) => TOPIC_PATTERNS[topic].test(narrative));
  const topics = unique([...supplied, ...detected]);
  return topics.includes("stem_opt") ? topics.filter((topic) => topic !== "opt") : topics;
}

function hasField(facts: IntakeCandidateFact[], field: IntakeCandidateFact["field"]): boolean {
  return facts.some((fact) => fact.field === field && fact.value !== "unknown");
}

function currentStudentCue(narrative: string): boolean {
  return (
    /\b(?:i am|i'm|im|currently|now)\b[^.!?\n]{0,90}\b(?:f-?1|international) student\b/i.test(narrative) ||
    /\b(?:first|second|third|fourth|fifth)[ -]?year\b[^.!?\n]{0,50}\b(?:f-?1|international)?\s*student\b/i.test(narrative) ||
    /\b(?:freshman|sophomore|junior|senior)\b[^.!?\n]{0,50}\b(?:f-?1|international)?\s*student\b/i.test(narrative) ||
    /\bcurrent (?:f-?1|international) student\b/i.test(narrative)
  );
}

function explicitlyAwayOnEffectiveDate(narrative: string): boolean {
  return (
    /\b(?:not|won't|will not) be (?:in|inside) (?:the )?(?:u\.?s\.?|united states)[^.!?\n]{0,45}\bseptember (?:15|fifteenth)\b/i.test(narrative) ||
    /\b(?:outside|away from) (?:the )?(?:u\.?s\.?|united states)[^.!?\n]{0,45}\bseptember (?:15|fifteenth)\b/i.test(narrative) ||
    /\bleav(?:e|ing)[^.!?\n]{0,45}\bbefore september (?:15|fifteenth)\b[^.!?\n]{0,55}\b(?:return|come back)[^.!?\n]{0,20}\bafter\b/i.test(narrative)
  );
}

function studyClearlyContinuesPastEffectiveDate(narrative: string): boolean {
  const match = narrative.match(
    /\b(?:graduat(?:e|ing)|finish(?:ing)?|complet(?:e|ing))\b[^.!?\n]{0,45}\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i
  );
  if (!match) return /\b(?:third|fourth|fifth)[ -]?year (?:f-?1|international)?\s*student\b/i.test(narrative);
  const month = MONTHS.findIndex((item) => item.toLowerCase() === match[1].toLowerCase()) + 1;
  const year = Number(match[2]);
  return year > 2026 || (year === 2026 && month >= 10);
}

function assumption(field: IntakeCandidateFact["field"], value: string, label: string, note: string): IntakeCandidateFact {
  return {
    field,
    value,
    label,
    confidence: "medium",
    evidence: "Your story describes current F-1 study that continues beyond September 15, 2026.",
    needsConfirmation: true,
    note
  };
}

export function addCurrentStudentAssumptions(narrative: string, facts: IntakeCandidateFact[]): IntakeCandidateFact[] {
  if (!currentStudentCue(narrative)) return facts;
  const next = [...facts];

  if (!hasField(next, "startingPosition")) {
    next.push(assumption("startingPosition", "current_ds_inside_us", "You are a current F-1 student", "Change this if you are not currently studying in the United States in F-1 status."));
  }
  if (!hasField(next, "admissionBasis") && !hasField(next, "i94AdmitUntilDate")) {
    next.push(assumption("admissionBasis", "duration_of_status", "Your I-94 says D/S", "This is the usual I-94 answer for current F-1 students. You can correct it if your I-94 shows a date."));
  }

  const presenceAlreadyKnown = hasField(next, "inUsOnEffectiveDate");
  if (!presenceAlreadyKnown && studyClearlyContinuesPastEffectiveDate(narrative) && !explicitlyAwayOnEffectiveDate(narrative)) {
    next.push(assumption("inUsOnEffectiveDate", "yes", "You expect to be in the United States on September 15, 2026", "I am using this as a working assumption because your studies continue past that date. Change it if you expect to be outside the United States that day."));
  }
  if (!hasField(next, "maintainingStatusOnEffectiveDate") && next.some((fact) => fact.field === "inUsOnEffectiveDate" && fact.value === "yes")) {
    next.push(assumption("maintainingStatusOnEffectiveDate", "yes", "You expect your F-1 status to remain valid", "Change this if you expect a status problem before September 15, 2026."));
  }

  return next;
}

function graduationHighlight(narrative: string): string | undefined {
  const after = narrative.match(
    /\b(?:graduat(?:e|ing)|finish(?:ing)?|complet(?:e|ing))\b[^.!?\n]{0,45}\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i
  );
  const before = narrative.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b[^.!?\n]{0,30}\b(?:graduat(?:e|ing)|finish(?:ing)?|complet(?:e|ing))\b/i
  );
  const match = after ?? before;
  if (!match) return undefined;
  const month = MONTHS.find((item) => item.toLowerCase() === match[1].toLowerCase());
  return month ? `Graduating ${month} ${match[2]}` : undefined;
}

function yearHighlight(narrative: string): string | undefined {
  const match = narrative.match(/\b(first|second|third|fourth|fifth)[ -]?year\b/i);
  if (!match) return undefined;
  return `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}-year student`;
}

export function buildIntakeHighlights(
  narrative: string,
  facts: IntakeCandidateFact[],
  modelHighlights: unknown,
  topics: IntakeTopic[]
): string[] {
  const supplied = Array.isArray(modelHighlights)
    ? modelHighlights
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.split(/\s+/).length <= 10)
    : [];
  const generated: string[] = [];
  const fact = (field: IntakeCandidateFact["field"], value?: string) => facts.find((item) => item.field === field && (!value || item.value === value));
  const suppliedHas = (pattern: RegExp) => supplied.some((item) => pattern.test(item));

  if (fact("startingPosition", "current_ds_inside_us")) generated.push("Current F-1 student");
  const year = yearHighlight(narrative);
  if (year) generated.push(year);
  const education = fact("educationLevel");
  if (education?.value === "undergraduate") generated.push("Undergraduate student");
  if (education?.value === "graduate") generated.push("Graduate student");
  const graduation = graduationHighlight(narrative);
  if (graduation) generated.push(graduation);
  if (fact("optIntent", "yes") || (fact("optStage") && fact("optStage")?.value !== "none")) generated.push(fact("optStage")?.value.startsWith("stem") ? "Plans STEM OPT" : "Plans post-completion OPT");
  else if ((topics.includes("opt") || topics.includes("stem_opt")) && !suppliedHas(/\bOPT\b/i)) generated.push("Has an OPT question");
  if (fact("travelPosture", "planned")) generated.push("Plans to travel");
  else if (topics.includes("travel") && !suppliedHas(/\b(?:travel|trip|return)\b/i)) generated.push("Has a travel question");
  if (topics.includes("cpt")) generated.push("Has a CPT question");
  if (topics.includes("school_transfer")) generated.push("Considering a school transfer");
  if (topics.includes("program_change")) generated.push("Considering a program change");

  const category = (item: string): string | undefined => {
    if (/\b(?:current|incoming).*\bF-?1\b/i.test(item)) return "f1-position";
    if (/\b(?:first|second|third|fourth|fifth)[ -]?year\b/i.test(item)) return "year";
    if (/\b(?:undergraduate|graduate)\b/i.test(item)) return "education";
    if (/\b(?:graduat|complet|finish)/i.test(item)) return "graduation";
    if (/\bOPT\b/i.test(item)) return "opt";
    if (/\b(?:travel|trip|return)\b/i.test(item)) return "travel";
    if (/\bCPT\b/i.test(item)) return "cpt";
    if (/\btransfer/i.test(item)) return "transfer";
    if (/\b(?:program|major) change/i.test(item)) return "program-change";
    return undefined;
  };
  const covered = new Set(generated.map(category).filter((item): item is string => Boolean(item)));
  const additional = supplied.filter((item) => {
    const itemCategory = category(item);
    if (!itemCategory || !covered.has(itemCategory)) {
      if (itemCategory) covered.add(itemCategory);
      return true;
    }
    return false;
  });
  const concise = [...generated, ...additional]
    .map((item) => item.replace(/[.]+$/, "").trim())
    .filter((item) => item.length > 0 && item.length <= 80);
  return unique(concise).slice(0, 6);
}

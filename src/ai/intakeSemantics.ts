import type { IntakeCandidateFact, IntakeTopic } from "./intakePayload";

const TOPICS: IntakeTopic[] = [
  "stay_length",
  "travel",
  "opt",
  "stem_opt",
  "cpt",
  "extension",
  "school_transfer",
  "program_change",
  "later_program",
  "dependents",
  "early_end",
  "change_of_status",
  "immigrant_intent",
  "school_filing_support"
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
  stay_length: /\b(?:how long (?:can|may|will) i stay|stay in the (?:u\.?s\.?|united states)|i-?94|duration of status|d\/s)\b/i,
  travel: /\b(?:travel|trip|fly|flying|return|re-?enter|come back|go abroad|go home|visit home|vacation|leave the (?:u\.?s\.?|united states))\b/i,
  opt: /\b(?:opt|optional practical training)\b/i,
  stem_opt: /\b(?:stem[ -]?opt|stem optional practical training)\b/i,
  cpt: /\b(?:cpt|curricular practical training|day[ -]?1 cpt)\b/i,
  extension: /\b(?:i-?539|extension of stay|uscis extension|extension with uscis|need(?:ing)? (?:an )?extension|avoid[^.!?\n]{0,35}extension|extend my (?:stay|status|program))\b/i,
  school_transfer: /\b(?:transfer(?:ring)? (?:schools?|to another school|my (?:record|sevis record))|school transfer|sevis transfer|transfer(?:ring)? (?:my )?(?:record|sevis record)|transfer to [a-z])\b/i,
  program_change: /\b(?:change (?:of|in) (?:my )?educational objective|change (?:my )?(?:major|program|degree|education level)|switch (?:my )?(?:major|program|degree))\b/i,
  later_program: /\b(?:(?:another|later|next|second|new)\s+(?:(?:bachelor'?s|master'?s|doctoral|graduate|undergraduate)\s+)?(?:degree|program)|second\s+(?:bachelor'?s|master'?s|doctorate|phd)|(?:same|lower|higher)[ -](?:degree|education)?level|(?:pursue|begin|start|enroll in|study)\s+(?:a\s+)?(?:second|another|new)\s+(?:bachelor'?s|master'?s|doctorate|phd|degree|program))\b/i,
  dependents: /\b(?:f-?2|dependent|spouse|husband|wife|child|children)\b/i,
  early_end: /\b(?:finish|complete|graduate) early|\bwithdraw(?:al|ing)?\b|\bstop studying\b/i,
  change_of_status: /\b(?:change of status|change (?:my )?status (?:to|into) f-?1)\b/i,
  immigrant_intent: /\b(?:i-?140|eb-?[123]|immigrant visa petition|immigrant intent|non-?immigrant intent)\b/i,
  school_filing_support: /\b(?:school|college|university|international (?:office|advisor))\b[^.!?\n]{0,75}\b(?:support|help|prepare|file)\b[^.!?\n]{0,35}\bi-?539\b|\bi-?539\b[^.!?\n]{0,75}\b(?:school|college|university|international (?:office|advisor))\b/i
};

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function deriveNarrativeTopics(
  narrative: string,
  modelTopics: unknown,
  facts: IntakeCandidateFact[] = []
): IntakeTopic[] {
  const text = narrative.normalize("NFKC").replace(/[‘’]/g, "'");
  const extracted = Array.isArray(modelTopics)
    ? modelTopics.filter((topic): topic is IntakeTopic => typeof topic === "string" && TOPICS.includes(topic as IntakeTopic))
    : [];
  const factSupports: Partial<Record<IntakeTopic, IntakeCandidateFact["field"][]>> = {
    travel: ["travelPosture", "reentryDate", "returningAfterEffectiveDate", "reentryBasis"],
    opt: ["optIntent", "optStage", "optFilingDate", "currentEadEndDate", "eadEndOnEffectiveDate"],
    stem_opt: ["optStage", "currentEadEndDate", "eadEndOnEffectiveDate"],
    cpt: ["cptPlan"],
    school_transfer: ["schoolTransferPlan"],
    program_change: ["academicProgramChangePlan"],
    later_program: ["nextProgramLevelPlan", "nextProgramStartDate", "nextProgramEndDate"],
    dependents: ["hasF2Dependents"],
    early_end: ["earlyEndSituation", "earlyEndDate"],
    change_of_status: ["startingPosition"],
    immigrant_intent: ["pendingEmploymentImmigrantPetition"]
  };
  const supportedByFact = (topic: IntakeTopic) => (factSupports[topic] ?? []).some((field) =>
    facts.some((fact) => fact.field === field && fact.value !== "unknown" && fact.confidence !== "low")
  );
  const topics = TOPICS.filter((topic) =>
    TOPIC_PATTERNS[topic].test(text) || (extracted.includes(topic) && supportedByFact(topic))
  );
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
    /\bcurrent (?:f-?1|international) student\b/i.test(narrative) ||
    /\b(?:currently|now)\b[^.!?\n]{0,35}\b(?:doing|on|using)\s+(?:my\s+)?(?:post-completion\s+)?opt\b/i.test(narrative)
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

function assumption(field: IntakeCandidateFact["field"], value: string): IntakeCandidateFact {
  return {
    field,
    value,
    confidence: "medium",
    needsConfirmation: true
  };
}

function monthYear(monthName: string, year: string): string | undefined {
  const month = MONTHS.findIndex((item) => item.toLowerCase() === monthName.toLowerCase()) + 1;
  return month ? `${year}-${String(month).padStart(2, "0")}` : undefined;
}

function addFact(
  facts: IntakeCandidateFact[],
  field: IntakeCandidateFact["field"],
  value: string,
  needsConfirmation = false
) {
  if (facts.some((fact) => fact.field === field && fact.value !== "unknown")) return;
  facts.push({ field, value, confidence: needsConfirmation ? "medium" : "high", needsConfirmation });
}

function completionMonth(narrative: string): string | undefined {
  const monthPattern = MONTHS.join("|");
  const patterns = [
    new RegExp(`\\b(?:graduated|completed|finished)(?:\\s+from\\b[^.!?\\n]{0,45})?(?:\\s+(?:this|in|on))?\\s+(${monthPattern})\\s+(20\\d{2})\\b`, "i"),
    new RegExp(`\\b(?:program|i-?20)\\b[^.!?\\n]{0,35}\\b(?:ended|ends|completion)\\b(?:\\s+(?:in|on))?\\s+(${monthPattern})\\s+(20\\d{2})\\b`, "i")
  ];
  for (const pattern of patterns) {
    const match = narrative.match(pattern);
    if (match) return monthYear(match[1], match[2]);
  }
  return undefined;
}

function optEndMonth(narrative: string): string | undefined {
  const monthPattern = MONTHS.join("|");
  const patterns = [
    new RegExp(`\\b(?:opt|ead)\\b[^.!?\\n]{0,55}\\b(?:expires?|ends?)\\b(?:\\s+(?:in|on))?\\s+(${monthPattern})\\s+(20\\d{2})\\b`, "i"),
    new RegExp(`\\b(?:expires?|ends?)\\b(?:\\s+(?:in|on))?\\s+(${monthPattern})\\s+(20\\d{2})\\b[^.!?\\n]{0,35}\\b(?:opt|ead)\\b`, "i")
  ];
  for (const pattern of patterns) {
    const match = narrative.match(pattern);
    if (match) return monthYear(match[1], match[2]);
  }
  return undefined;
}

export function addExplicitNarrativeFacts(
  narrative: string,
  modelFacts: IntakeCandidateFact[]
): IntakeCandidateFact[] {
  const facts = [...modelFacts];
  const completed = completionMonth(narrative);
  const optEnd = optEndMonth(narrative);
  const onApprovedOpt = /\b(?:currently|now)\b[^.!?\n]{0,35}\b(?:doing|on|using)\s+(?:my\s+)?(?:post-completion\s+)?opt\b/i.test(narrative) ||
    /\bmy\s+(?:post-completion\s+)?opt\s+is\s+(?:currently\s+)?(?:active|approved|ongoing)\b/i.test(narrative);

  if (completed) addFact(facts, "currentProgramEndDate", completed, true);
  if (onApprovedOpt) {
    addFact(facts, "optIntent", "yes");
    addFact(facts, "optStage", /\bstem[ -]?opt\b/i.test(narrative) ? "stem_approved" : "post_completion_approved");
  }
  if (optEnd) {
    addFact(facts, "currentEadEndDate", optEnd, true);
    addFact(facts, "eadEndOnEffectiveDate", optEnd, true);
  }
  if (/\b(?:undergraduate|undergrad|ug student|bachelor'?s|associate)\b/i.test(narrative)) {
    addFact(facts, "educationLevel", "undergraduate");
  }
  if (/\b(?:graduate student|graduate program|master'?s|doctorate|doctoral|ph\.?d\.?)\b/i.test(narrative)) {
    addFact(facts, "educationLevel", "graduate");
  }
  if (/\b(?:college|university|bachelor'?s|master'?s|doctorate|doctoral|ph\.?d\.?)\b/i.test(narrative)) {
    addFact(facts, "programType", "college_or_university");
  }
  if (/\b(?:second|another|later|next|new)\s+(?:(?:bachelor'?s|master'?s|doctoral|graduate|undergraduate)\s+)?(?:degree|program)|\bsecond\s+(?:bachelor'?s|master'?s|doctorate|ph\.?d\.?)\b/i.test(narrative)) {
    addFact(facts, "nextProgramLevelPlan", /\b(?:second|same|lower)\b/i.test(narrative) ? "same_or_lower" : "unknown", true);
  }
  if (/\b(?:i-?140|eb-?[123]|immigrant visa petition)\b/i.test(narrative) && /\b(?:filed|pending|petition)\b/i.test(narrative)) {
    addFact(facts, "pendingEmploymentImmigrantPetition", "yes");
  }
  return facts;
}

export function addCurrentStudentAssumptions(narrative: string, facts: IntakeCandidateFact[]): IntakeCandidateFact[] {
  if (!currentStudentCue(narrative)) return facts;
  const next = [...facts];

  if (!hasField(next, "startingPosition")) {
    next.push(assumption("startingPosition", "current_ds_inside_us"));
  }
  if (!hasField(next, "admissionBasis") && !hasField(next, "i94AdmitUntilDate")) {
    next.push(assumption("admissionBasis", "duration_of_status"));
  }

  const presenceAlreadyKnown = hasField(next, "inUsOnEffectiveDate");
  if (!presenceAlreadyKnown && studyClearlyContinuesPastEffectiveDate(narrative) && !explicitlyAwayOnEffectiveDate(narrative)) {
    next.push(assumption("inUsOnEffectiveDate", "yes"));
  }
  if (!hasField(next, "maintainingStatusOnEffectiveDate") && next.some((fact) => fact.field === "inUsOnEffectiveDate" && fact.value === "yes")) {
    next.push(assumption("maintainingStatusOnEffectiveDate", "yes"));
  }

  return next;
}

function completionHighlight(narrative: string): string | undefined {
  const after = narrative.match(
    /\b(?:graduate|graduated|graduating|finish|finished|finishing|complete|completed|completing)\b[^.!?\n]{0,65}\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b/i
  );
  const before = narrative.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})\b[^.!?\n]{0,30}\b(?:graduate|graduated|graduating|finish|finished|finishing|complete|completed|completing)\b/i
  );
  const match = after ?? before;
  if (!match) return undefined;
  const month = MONTHS.find((item) => item.toLowerCase() === match[1].toLowerCase());
  if (!month) return undefined;
  return /\b(?:graduated|completed|finished)\b/i.test(narrative)
    ? `Program completed ${month} ${match[2]}`
    : `Graduating ${month} ${match[2]}`;
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
  const graduation = completionHighlight(narrative);
  if (graduation) generated.push(graduation);
  const eadEnd = fact("currentEadEndDate") ?? fact("eadEndOnEffectiveDate");
  const eadEndLabel = eadEnd ? (formatDateFact(eadEnd.value) ?? eadEnd.value) : undefined;
  if (fact("optStage")?.value.endsWith("approved")) {
    generated.push(`${fact("optStage")?.value.startsWith("stem") ? "Approved STEM OPT" : "Approved OPT"}${eadEndLabel ? ` through ${eadEndLabel}` : ""}`);
  } else if (fact("optIntent", "yes") || (fact("optStage") && fact("optStage")?.value !== "none")) generated.push(fact("optStage")?.value.startsWith("stem") ? "Plans STEM OPT" : "Plans post-completion OPT");
  else if ((topics.includes("opt") || topics.includes("stem_opt")) && !suppliedHas(/\bOPT\b/i)) generated.push("Has an OPT question");
  if (fact("travelPosture", "planned")) generated.push("Plans to travel");
  else if (topics.includes("travel") && !suppliedHas(/\b(?:travel|trip|return)\b/i)) generated.push("Has a travel question");
  if (topics.includes("cpt")) generated.push("Has a CPT question");
  if (topics.includes("school_transfer")) generated.push("Considering a school transfer");
  if (topics.includes("program_change")) generated.push("Considering a program change");
  if (/\bsecond\s+master'?s\b/i.test(narrative)) generated.push("Plans a second master's degree");
  else if (topics.includes("later_program")) generated.push("Considering another U.S. program");
  if (fact("pendingEmploymentImmigrantPetition", "yes")) generated.push("Pending employment-based immigrant petition");
  if (topics.includes("dependents")) generated.push("Has F-2 family questions");
  if (topics.includes("early_end")) generated.push("May finish early or withdraw");

  const category = (item: string): string | undefined => {
    if (/(?:^|[^a-z])opt(?:[^a-z]|$)/i.test(item)) return "opt";
    if (/\b(?:travel|trip|return|visit home)\b/i.test(item)) return "travel";
    if (/\b(?:current|incoming).*\bF-?1\b/i.test(item)) return "f1-position";
    if (/\b(?:first|second|third|fourth|fifth)[ -]?year\b/i.test(item)) return "year";
    if (/\b(?:undergraduate|graduate)\b/i.test(item)) return "education";
    if (/\b(?:graduat|complet|finish)/i.test(item)) return "graduation";
    if (/\bCPT\b/i.test(item)) return "cpt";
    if (/\b(?:I-?539|USCIS extension|extension of stay)\b/i.test(item)) return "extension";
    if (/\btransfer/i.test(item)) return "transfer";
    if (/\b(?:program|major) change/i.test(item)) return "program-change";
    if (/\b(?:second|another|later|next|same-level).*(?:degree|program|master|bachelor)|\bsecond master/i.test(item)) return "later-program";
    if (/\b(?:i-?140|eb-?[123]|immigrant|non-?immigrant intent)\b/i.test(item)) return "immigrant-intent";
    if (/\b(?:school|university).*(?:i-?539|filing support)|\bfiling support\b/i.test(item)) return "school-support";
    return undefined;
  };
  const covered = new Set(generated.map(category).filter((item): item is string => Boolean(item)));
  const additional = supplied.filter((item) => {
    const itemCategory = category(item);
    const categorySupported =
      (itemCategory === "f1-position" && Boolean(fact("startingPosition"))) ||
      (itemCategory === "education" && Boolean(education)) ||
      (itemCategory === "graduation" && Boolean(graduation)) ||
      (itemCategory === "year" && Boolean(year)) ||
      (itemCategory === "opt" && (topics.includes("opt") || topics.includes("stem_opt") || Boolean(fact("optIntent", "yes")))) ||
      (itemCategory === "travel" && (topics.includes("travel") || Boolean(fact("travelPosture", "planned")))) ||
      (itemCategory === "cpt" && topics.includes("cpt")) ||
      (itemCategory === "extension" && topics.includes("extension")) ||
      (itemCategory === "transfer" && topics.includes("school_transfer")) ||
      (itemCategory === "program-change" && topics.includes("program_change")) ||
      (itemCategory === "later-program" && topics.includes("later_program")) ||
      (itemCategory === "immigrant-intent" && topics.includes("immigrant_intent")) ||
      (itemCategory === "school-support" && topics.includes("school_filing_support"));
    if (!categorySupported) return false;
    if (!itemCategory || !covered.has(itemCategory)) {
      if (itemCategory) covered.add(itemCategory);
      return true;
    }
    return false;
  });
  const concise = [...generated, ...additional]
    .map((item) => item.replace(/[.]+$/, "").trim())
    .filter((item) => item.length > 0 && item.length <= 80);
  const seenCategories = new Set<string>();
  return unique(concise).filter((item) => {
    const itemCategory = category(item);
    if (!itemCategory) return true;
    if (seenCategories.has(itemCategory)) return false;
    seenCategories.add(itemCategory);
    return true;
  }).slice(0, 8);
}

function formatDateFact(value: string): string | undefined {
  const match = value.match(/^(20\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : undefined;
}

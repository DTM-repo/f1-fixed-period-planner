import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  HelpCircle,
  Info,
  Mic,
  RefreshCw,
  Sparkles,
  Square,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IntakeCandidateFact, IntakeExtractionResponse, IntakeFactField } from "./ai/intakePayload";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import { calculateScenario, DEFAULT_EFFECTIVE_DATE } from "./engine/calculateScenario";
import { compareDates, formatDate, isValidDateString } from "./engine/dateMath";
import type {
  AdmissionBasis,
  CptPlan,
  EducationLevel,
  Finding,
  NextProgramLevelPlan,
  OptStage,
  ReentryBasis,
  StartingPosition,
  StudentScenario,
  TravelPosture,
  YesNoUnknown
} from "./engine/types";
import { SOURCE_INDEX } from "./sources/sourceIndex";

type SpeechRecognitionResultItem = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionResultItem;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const yesNoOptions: Array<{ value: YesNoUnknown; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "I do not know yet" }
];

const startingPositionLabels: Record<StartingPosition, string> = {
  current_ds_inside_us: "F-1 before Sep. 15",
  prospective_outside_us: "Entering after Sep. 15",
  readmitted_fixed_period: "Returning after Sep. 15",
  transfer_or_program_change: "Transfer or change",
  unknown: "Not sure"
};

const admissionBasisLabels: Record<AdmissionBasis, string> = {
  duration_of_status: "D/S / no end date",
  fixed_period: "I-94 has an end date",
  unknown: "Not sure"
};

const optLabels: Record<OptStage, string> = {
  none: "No OPT/STEM plan yet",
  pre_completion: "Pre-completion OPT",
  post_completion_not_filed: "Post-completion OPT, not filed",
  post_completion_pending: "Post-completion OPT, pending",
  post_completion_approved: "Post-completion OPT, approved",
  stem_not_filed: "STEM OPT, not filed",
  stem_pending: "STEM OPT, pending",
  stem_approved: "STEM OPT, approved"
};

const travelLabels: Record<TravelPosture, string> = {
  none: "No travel planned",
  planned: "Planning to travel",
  completed: "Already traveled",
  automatic_visa_revalidation: "Automatic visa revalidation",
  unknown: "Not sure"
};

const reentryLabels: Record<ReentryBasis, string> = {
  same_i20_balance: "Return for the same I-20",
  new_f1_admission: "Regular F-1 return",
  longer_program_i20: "Return with longer I-20",
  automatic_visa_revalidation: "Automatic visa revalidation",
  unknown: "Not sure"
};

const cptLabels: Record<CptPlan, string> = {
  none: "No CPT plan",
  before_admission_end: "CPT before calculated end",
  after_admission_end: "CPT after calculated end",
  unknown: "Not sure"
};

const educationLevelLabels: Record<EducationLevel, string> = {
  undergraduate: "Undergraduate",
  graduate: "Graduate",
  other: "Other program type",
  unknown: "I do not know yet"
};

const nextProgramLevelLabels: Record<NextProgramLevelPlan, string> = {
  higher: "A higher level",
  same_or_lower: "Same or lower level",
  not_planning: "No next program planned",
  unknown: "I do not know yet"
};

const factFieldLabels: Record<IntakeFactField, string> = {
  startingPosition: "starting point",
  admissionBasis: "what the I-94 shows",
  i94AdmitUntilDate: "I-94 admit-until date",
  inUsOnEffectiveDate: "U.S. location on the rule date",
  maintainingStatusOnEffectiveDate: "status on the rule date",
  programEndOnEffectiveDate: "I-20 end on the rule date",
  currentProgramEndDate: "program end date",
  eadEndOnEffectiveDate: "EAD end on the rule date",
  currentEadEndDate: "EAD end date",
  optStage: "OPT/STEM situation",
  optFilingDate: "I-765 filing date",
  travelPosture: "travel plan",
  reentryDate: "return/admission date",
  reentryBasis: "return basis",
  pendingExtensionOnDeparture: "pending I-539 travel",
  transferOrProgramChange: "transfer/program change",
  educationLevel: "education level",
  nextProgramLevelPlan: "next program level",
  cptPlan: "CPT timing"
};

const draftFields = Object.keys(factFieldLabels) as IntakeFactField[];

function describeDraftChanges(before: StudentScenario, after: StudentScenario): string[] {
  return draftFields.flatMap((field) => (before[field] !== after[field] ? [factFieldLabels[field]] : []));
}

const enumFactValues: Partial<Record<IntakeFactField, readonly string[]>> = {
  startingPosition: Object.keys(startingPositionLabels),
  admissionBasis: Object.keys(admissionBasisLabels),
  inUsOnEffectiveDate: yesNoOptions.map((option) => option.value),
  maintainingStatusOnEffectiveDate: yesNoOptions.map((option) => option.value),
  optStage: Object.keys(optLabels),
  travelPosture: Object.keys(travelLabels),
  reentryBasis: Object.keys(reentryLabels),
  pendingExtensionOnDeparture: yesNoOptions.map((option) => option.value),
  transferOrProgramChange: yesNoOptions.map((option) => option.value),
  educationLevel: Object.keys(educationLevelLabels),
  nextProgramLevelPlan: Object.keys(nextProgramLevelLabels),
  cptPlan: Object.keys(cptLabels)
};

const dateFactFields = new Set<IntakeFactField>([
  "i94AdmitUntilDate",
  "programEndOnEffectiveDate",
  "currentProgramEndDate",
  "eadEndOnEffectiveDate",
  "currentEadEndDate",
  "optFilingDate",
  "reentryDate"
]);

function isSupportedFactValue(fact: IntakeCandidateFact): boolean {
  if (dateFactFields.has(fact.field)) {
    return isValidDateString(fact.value);
  }

  return enumFactValues[fact.field]?.includes(fact.value) ?? false;
}

function factDisplayValue(fact: IntakeCandidateFact): string {
  if (dateFactFields.has(fact.field) && isValidDateString(fact.value)) {
    return formatDate(fact.value);
  }

  const labelMap: Partial<Record<IntakeFactField, Record<string, string>>> = {
    startingPosition: startingPositionLabels,
    admissionBasis: admissionBasisLabels,
    optStage: optLabels,
    travelPosture: travelLabels,
    reentryBasis: reentryLabels,
    educationLevel: educationLevelLabels,
    nextProgramLevelPlan: nextProgramLevelLabels,
    cptPlan: cptLabels
  };

  if (fact.field === "inUsOnEffectiveDate" || fact.field === "maintainingStatusOnEffectiveDate" || fact.field === "pendingExtensionOnDeparture" || fact.field === "transferOrProgramChange") {
    return yesNoOptions.find((option) => option.value === fact.value)?.label ?? fact.value;
  }

  return labelMap[fact.field]?.[fact.value] ?? fact.value;
}

function readyFacts(facts: IntakeCandidateFact[]): IntakeCandidateFact[] {
  return facts.filter((fact) => fact.confidence !== "low" && fact.value !== "unknown" && isSupportedFactValue(fact));
}

function scenarioWithFacts(current: StudentScenario, facts: IntakeCandidateFact[]): StudentScenario {
  let next: StudentScenario = { ...current };
  for (const fact of readyFacts(facts)) {
    if (fact.field === "startingPosition") {
      const value = fact.value as StartingPosition;
      next = {
        ...next,
        startingPosition: value,
        admissionBasis:
          value === "current_ds_inside_us"
            ? next.admissionBasis === "fixed_period"
              ? next.admissionBasis
              : "duration_of_status"
            : value === "prospective_outside_us"
              ? "fixed_period"
              : next.admissionBasis,
        inUsOnEffectiveDate: value === "prospective_outside_us" ? "no" : next.inUsOnEffectiveDate,
        travelPosture: next.travelPosture ?? "unknown",
        returningAfterEffectiveDate: next.returningAfterEffectiveDate ?? "unknown",
        optIntent: next.optIntent ?? "unknown",
        schoolTransferPlan: next.schoolTransferPlan ?? "unknown",
        academicProgramChangePlan: next.academicProgramChangePlan ?? "unknown"
      };
      continue;
    }

    if (fact.field === "admissionBasis") {
      next = {
        ...next,
        admissionBasis: fact.value as AdmissionBasis,
        i94AdmitUntilDate: fact.value === "fixed_period" ? next.i94AdmitUntilDate : undefined
      };
      continue;
    }

    if (fact.field === "travelPosture") {
      const value = fact.value as TravelPosture;
      next = {
        ...next,
        travelPosture: value,
        returningAfterEffectiveDate: value === "none" ? "no" : next.returningAfterEffectiveDate ?? "unknown",
        reentryDate: value === "none" ? undefined : next.reentryDate,
        reentryBasis: value === "none" ? "unknown" : next.reentryBasis,
        pendingExtensionOnDeparture: value === "none" ? "no" : next.pendingExtensionOnDeparture
      };
      continue;
    }

    if (fact.field === "reentryDate") {
      next = {
        ...next,
        reentryDate: fact.value,
        travelPosture: next.travelPosture === "none" || next.travelPosture === "unknown" ? "planned" : next.travelPosture,
        returningAfterEffectiveDate: compareDates(fact.value, next.effectiveDate ?? DEFAULT_EFFECTIVE_DATE) > 0 ? "yes" : "no"
      };
      continue;
    }

    if (fact.field === "optStage") {
      next = {
        ...next,
        optStage: fact.value as OptStage,
        optIntent: fact.value === "none" ? "no" : "yes"
      };
      continue;
    }

    next = {
      ...next,
      [fact.field]: fact.value
    } as StudentScenario;
  }

  if (isCurrentTrack(next)) {
    next = {
      ...next,
      admissionBasis: next.admissionBasis === "unknown" ? "duration_of_status" : next.admissionBasis,
      programEndOnEffectiveDate: next.programEndOnEffectiveDate ?? next.currentProgramEndDate,
      currentProgramEndDate: next.currentProgramEndDate ?? next.programEndOnEffectiveDate
    };
  }

  if (next.reentryDate && hasTravelPlan(next)) {
    next = {
      ...next,
      returningAfterEffectiveDate: compareDates(next.reentryDate, next.effectiveDate ?? DEFAULT_EFFECTIVE_DATE) > 0 ? "yes" : "no"
    };
  }

  return {
    ...next,
    narrative: current.narrative
  };
}

const monthOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

interface DateParts {
  month: string;
  day: string;
  year: string;
}

function datePartsFromValue(value?: string): DateParts {
  const match = value?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return {
    month: match ? String(Number(match[2])) : "",
    day: match ? String(Number(match[3])) : "",
    year: match ? match[1] : ""
  };
}

function dateValueFromParts(parts: DateParts): string | undefined {
  const empty = !parts.month && !parts.day && !parts.year;
  if (empty) {
    return undefined;
  }
  if (!parts.month || !parts.day || !/^\d{4}$/.test(parts.year)) {
    return undefined;
  }

  const value = `${parts.year}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
  return isValidDateString(value) ? value : undefined;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel as string}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
}) {
  const [parts, setParts] = useState(() => datePartsFromValue(value));

  useEffect(() => {
    setParts(datePartsFromValue(value));
  }, [value]);

  function updatePart(part: keyof DateParts, nextValue: string) {
    const nextParts = { ...parts, [part]: nextValue };
    setParts(nextParts);

    const complete = Boolean(nextParts.month && nextParts.day && /^\d{4}$/.test(nextParts.year));
    const empty = !nextParts.month && !nextParts.day && !nextParts.year;
    if (empty) {
      onChange(undefined);
    } else if (complete) {
      const nextValue = dateValueFromParts(nextParts);
      if (nextValue) {
        onChange(nextValue);
      }
    }
  }

  return (
    <label className="field date-field">
      <span>{label}</span>
      <div className="date-triplet">
        <select aria-label={`${label} month`} value={parts.month} onChange={(event) => updatePart("month", event.currentTarget.value)}>
          <option value="">Month</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <input
          aria-label={`${label} day`}
          inputMode="numeric"
          min="1"
          max="31"
          placeholder="Day"
          type="number"
          value={parts.day}
          onChange={(event) => updatePart("day", event.currentTarget.value)}
        />
        <input
          aria-label={`${label} year`}
          inputMode="numeric"
          min="2020"
          max="2040"
          placeholder="Year"
          type="number"
          value={parts.year}
          onChange={(event) => updatePart("year", event.currentTarget.value)}
        />
      </div>
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function findingIcon(tone: Finding["tone"]) {
  if (tone === "good") {
    return <CheckCircle2 aria-hidden="true" />;
  }
  if (tone === "question") {
    return <HelpCircle aria-hidden="true" />;
  }
  return <AlertTriangle aria-hidden="true" />;
}

type PlannerView = ReturnType<typeof calculateScenario>;
type ImpactTone = "good" | "info" | "warning" | "question" | "danger";

interface ImpactCard {
  title: string;
  detail: string;
  tone: ImpactTone;
}

interface AdvisoryItem {
  title: string;
  body: string;
  tone: ImpactTone;
  sourceIds: string[];
}

interface StudentOutcome {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "good" | "manual" | "warning";
}

interface StudentTimelineEvent {
  label: string;
  date?: string;
  detail: string;
  tone: ImpactTone;
}

interface StudentTimeline {
  title: string;
  detail: string;
  events: StudentTimelineEvent[];
}

const yesNoOnlyOptions: Array<{ value: YesNoUnknown; label: string }> = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" }
];

const planningOptions: Array<{ value: YesNoUnknown; label: string }> = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "unknown", label: "I do not know yet" }
];

const pathOptions: Array<{ value: StartingPosition; label: string }> = [
  { value: "current_ds_inside_us", label: "Yes, before Sept. 15" },
  { value: "prospective_outside_us", label: "No, after Sept. 15" },
  { value: "unknown", label: "Not sure" }
];

const i94Options: Array<{ value: AdmissionBasis; label: string }> = [
  { value: "duration_of_status", label: "It says D/S" },
  { value: "fixed_period", label: "It has a date" },
  { value: "unknown", label: "Not sure" }
];

const travelDecisionOptions: Array<{ value: TravelPosture; label: string }> = [
  { value: "none", label: "No" },
  { value: "planned", label: "Yes" },
  { value: "unknown", label: "I do not know yet" }
];

const returnAfterRuleOptions: Array<{ value: YesNoUnknown; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "I do not know yet" }
];

type OptKind = "regular" | "stem";
type OptFilingStatus = "not_filed" | "pending" | "approved";

const optKindOptions: Array<{ value: OptKind; label: string }> = [
  { value: "regular", label: "Regular OPT" },
  { value: "stem", label: "STEM OPT" }
];

const optStatusOptions: Array<{ value: OptFilingStatus; label: string }> = [
  { value: "not_filed", label: "Not filed yet" },
  { value: "pending", label: "Filed, waiting" },
  { value: "approved", label: "Approved" }
];

const educationLevelOptions: Array<{ value: EducationLevel; label: string }> = [
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "I do not know yet" }
];

const nextProgramLevelOptions: Array<{ value: NextProgramLevelPlan; label: string }> = [
  { value: "not_planning", label: "No next program planned" },
  { value: "higher", label: "A higher level" },
  { value: "same_or_lower", label: "Same or lower level" },
  { value: "unknown", label: "I do not know yet" }
];

function isCurrentTrack(scenario: StudentScenario): boolean {
  return scenario.startingPosition === "current_ds_inside_us" || scenario.startingPosition === "transfer_or_program_change";
}

function hasTravelPlan(scenario: StudentScenario): boolean {
  return scenario.travelPosture === "planned" || scenario.travelPosture === "completed" || scenario.travelPosture === "automatic_visa_revalidation";
}

function needsOptDate(stage: OptStage): boolean {
  return stage !== "none" && stage !== "pre_completion";
}

function hasApprovedOpt(stage: OptStage): boolean {
  return stage === "post_completion_approved" || stage === "stem_approved";
}

function programEndBeforeRuleStarts(scenario: StudentScenario): boolean {
  return Boolean(scenario.programEndOnEffectiveDate && compareDates(scenario.programEndOnEffectiveDate, DEFAULT_EFFECTIVE_DATE) < 0);
}

function programRunsPastCoverage(scenario: StudentScenario, result: PlannerView): boolean {
  const testedEnd = scenario.currentProgramEndDate ?? scenario.programEndOnEffectiveDate;
  return Boolean(result.coverageEnd && testedEnd && compareDates(testedEnd, result.coverageEnd) > 0);
}

function travelCanExtendTimeline(result: PlannerView, travelResult: PlannerView | null): boolean {
  return Boolean(result.coverageEnd && travelResult?.coverageEnd && compareDates(travelResult.coverageEnd, result.coverageEnd) > 0);
}

function optKindFromStage(stage: OptStage): OptKind {
  return stage.startsWith("stem") ? "stem" : "regular";
}

function optStatusFromStage(stage: OptStage): OptFilingStatus {
  if (stage.endsWith("pending")) {
    return "pending";
  }
  if (stage.endsWith("approved")) {
    return "approved";
  }
  return "not_filed";
}

function optStageFromParts(kind: OptKind, status: OptFilingStatus): OptStage {
  if (kind === "stem") {
    return status === "approved" ? "stem_approved" : status === "pending" ? "stem_pending" : "stem_not_filed";
  }

  return status === "approved" ? "post_completion_approved" : status === "pending" ? "post_completion_pending" : "post_completion_not_filed";
}

function combinePlanAnswers(first?: YesNoUnknown, second?: YesNoUnknown): YesNoUnknown {
  if (first === "yes" || second === "yes") {
    return "yes";
  }
  if (first === "unknown" || second === "unknown") {
    return "unknown";
  }
  return "no";
}

function sortEvents(events: StudentTimelineEvent[]): StudentTimelineEvent[] {
  return [...events].sort((left, right) => {
    if (!left.date && !right.date) {
      return 0;
    }
    if (!left.date) {
      return 1;
    }
    if (!right.date) {
      return -1;
    }
    return compareDates(left.date, right.date);
  });
}

function SourceChips({ result, sourceIds }: { result: PlannerView; sourceIds: string[] }) {
  return (
    <span className="source-chips" aria-label="Sources">
      {sourceIds.map((sourceId) => {
        const citation = result.citations.find((item) => item.id === sourceId) ?? SOURCE_INDEX[sourceId];
        return citation ? (
          <a key={sourceId} href={citation.url} target="_blank" rel="noreferrer" title={citation.locator}>
            {sourceId}
          </a>
        ) : (
          <span key={sourceId}>{sourceId}</span>
        );
      })}
    </span>
  );
}

function RuleOverview({ result }: { result: PlannerView }) {
  const items: AdvisoryItem[] = [
    {
      title: "What changed",
      body:
        "Starting September 15, 2026, new F-1 entries and reentries move from open-ended D/S admission to a fixed I-94 period tied to the I-20 or training document, capped at four years.",
      tone: "info",
      sourceIds: ["FR-2026-FINAL-RULE", "8CFR-214-1-A4"]
    },
    {
      title: "Current students get a transition path",
      body:
        "If you are in the United States on September 15, 2026, staying in F-1 status, and your I-94 says D/S, the old D/S rules may keep covering this stay until the active I-20 or EAD date, capped at September 15, 2030.",
      tone: "good",
      sourceIds: ["8CFR-214-1-M1"]
    },
    {
      title: "The after-program period shrinks",
      body:
        "The old D/S transition path can still use the 60-day F-1 period after the protected end date. A new fixed-period admission uses 30 days instead.",
      tone: "warning",
      sourceIds: ["8CFR-214-1-M1", "8CFR-214-2-F5V"]
    },
    {
      title: "School changes are stricter",
      body:
        "The rule adds separate limits for transfers, graduate program changes, and starting another program at the same or a lower education level after completing a program.",
      tone: "warning",
      sourceIds: ["8CFR-214-2-F5II"]
    }
  ];

  return (
    <section className="band overview-panel" id="what-happened">
      <div className="section-title">
        <Info aria-hidden="true" />
        <h2>What happened</h2>
      </div>
      <div className="overview-grid">
        {items.map((item) => (
          <article key={item.title} className={`overview-card ${item.tone}`}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <SourceChips result={result} sourceIds={item.sourceIds} />
          </article>
        ))}
      </div>
    </section>
  );
}

function buildAdvisoryItems(scenario: StudentScenario, result: PlannerView, travelResult: PlannerView | null): AdvisoryItem[] {
  const items: AdvisoryItem[] = [];

  if (scenario.startingPosition === "unknown") {
    return [
      {
        title: "Start with the before-or-after question.",
        body:
          "Once you say whether you are already in F-1 status before September 15, 2026 or entering after that date, you can see the first real impact without reading every rule branch.",
        tone: "question",
        sourceIds: ["FR-2026-FINAL-RULE"]
      }
    ];
  }

  if (isCurrentTrack(scenario)) {
    const runsPastProtection = programRunsPastCoverage(scenario, result);
    const travelExtends = travelCanExtendTimeline(result, travelResult);

    if (!scenario.programEndOnEffectiveDate) {
      items.push({
        title: "You may be protected from the new fixed-date system.",
        body:
          "Because you are a current F-1 student, the first question is how long your current I-20 or EAD lasts. That date tells us whether staying in the United States keeps you under the old D/S rules or whether another step is needed later.",
        tone: "good",
        sourceIds: ["8CFR-214-1-M1"]
      });
    } else if (scenario.inUsOnEffectiveDate === "no" || scenario.maintainingStatusOnEffectiveDate === "no") {
      items.push({
        title: "September 15 changes your starting point.",
        body:
          "Your current-student protection depends on being inside the United States when the rule starts. If you are outside the country then, the next ordinary F-1 entry may be a new fixed-period admission instead of the old D/S transition path.",
        tone: "warning",
        sourceIds: ["8CFR-214-1-M1", "8CFR-214-1-A4"]
      });
    } else if (runsPastProtection && result.coverageEnd) {
      items.push({
        title: "You have a long-program timing issue.",
        body: `You have an important scenario here. Staying in the United States may keep you under the old D/S rules for now, but that protection stops on ${formatDate(
          result.coverageEnd
        )}. Your program or training date goes later than that, so the stay-in-the-U.S. path alone does not carry you to the end. The next question is whether OPT timing, school changes, travel, or an extension filing gives you the cleanest path.`,
        tone: "warning",
        sourceIds: ["8CFR-214-1-M1"]
      });
    } else if (result.coverageEnd && result.latestDepartureDate) {
      items.push({
        title: "Staying in the United States may preserve the old rules.",
        body: `Based on what you have entered so far, the stay-in-the-U.S. path may keep you under the old D/S rules through ${formatDate(
          result.coverageEnd
        )}. The 60-day F-1 period after that runs through ${formatDate(result.latestDepartureDate)}. Travel, OPT/STEM, or a school change can still change the answer.`,
        tone: "good",
        sourceIds: ["8CFR-214-1-M1"]
      });
    }

    if (hasTravelPlan(scenario)) {
      if (travelExtends && travelResult?.coverageEnd && result.coverageEnd) {
        items.push({
          title: "Travel may help, but only because it creates a new branch.",
          body: `This is the unusual but important part: travel does not extend your old D/S protection. Instead, returning after September 15 can create a new fixed-period admission. In this scenario, staying reaches ${formatDate(
            result.coverageEnd
          )}, while the tested return path reaches ${formatDate(
            travelResult.coverageEnd
          )}. That may avoid or delay an extension filing, but it also means a 30-day period after the fixed end date and ordinary travel/admission risk.`,
          tone: "good",
          sourceIds: ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
        });
      } else if (!scenario.reentryDate && scenario.returningAfterEffectiveDate !== "no") {
        items.push({
          title: "Do not treat travel as good or bad yet.",
          body:
            "You have said travel may happen, but the return date is not set. The return date decides whether travel starts a fixed-period I-94 after the rule begins, and it can also affect OPT timing. Keep answering the other questions even if the travel date is still uncertain.",
          tone: "question",
          sourceIds: ["8CFR-214-1-A4", "8CFR-214-1-M1-OPT"]
        });
      } else if (travelResult?.coverageEnd) {
        items.push({
          title: "Travel creates a second timeline.",
          body: `If you return after the rule starts, that return is tested as a fixed-period branch. With the dates entered so far, that branch reaches ${formatDate(
            travelResult.coverageEnd
          )} before the fixed-period 30-day period begins. Compare that against the stay-in-the-U.S. timeline before making a travel decision.`,
          tone: "info",
          sourceIds: ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
        });
      }
    } else {
      items.push({
        title: "Travel is worth testing before you book anything.",
        body:
          "If your program runs long, a later return can sometimes create a fixed-period admission that reaches farther than the current-student transition cap. It can also shorten a timeline or affect OPT. Compare both paths before treating travel as helpful.",
        tone: "info",
        sourceIds: ["8CFR-214-1-A4", "8CFR-214-1-M1-OPT"]
      });
    }

    if (scenario.optIntent === "yes" || scenario.optIntent === "unknown") {
      items.push({
        title: "OPT/STEM has a special early transition window.",
        body:
          "If you stay in the D/S transition path and file a qualifying post-completion OPT or STEM OPT I-765 on or before March 18, 2027, the rule may let you file the I-765 without adding an I-539 just because the D/S rule changed. Leaving before filing can move you into the fixed-period travel branch, so the order of filing and travel matters.",
        tone: scenario.optIntent === "yes" ? "warning" : "info",
        sourceIds: ["8CFR-214-1-M1-OPT", "8CFR-214-2-F11"]
      });
    }
  } else {
    if (result.coverageEnd && result.latestDepartureDate) {
      items.push({
        title: "You are in the new fixed-date system.",
        body: `For an F-1 entry after September 15, 2026, the I-94 period is tied to the I-20 end date or four years from entry, whichever is earlier. With the dates entered so far, the fixed period reaches ${formatDate(
          result.coverageEnd
        )}, followed by 30 days through ${formatDate(result.latestDepartureDate)}.`,
        tone: result.status === "ok" ? "info" : "warning",
        sourceIds: ["8CFR-214-1-A4", "8CFR-214-2-F5V"]
      });
    } else {
      items.push({
        title: "Your entry date and I-20 end date set the clock.",
        body:
          "For an incoming F-1 student, the rule does not start with old D/S protection. It starts with a fixed-date I-94 tied to the I-20 end date and the four-year limit.",
        tone: "info",
        sourceIds: ["8CFR-214-1-A4"]
      });
    }
  }

  if (result.extensionNeededBy) {
    items.push({
      title: "An extension is more than a date on a calendar.",
      body:
        "If this path needs an extension of stay, plan for a USCIS filing before the protected or fixed period ends. The current USCIS fee schedule lists Form I-539 at $420 online or $470 by paper. Biometrics may be required if USCIS sends an appointment notice. Do not assume premium processing is available for this new F-1 extension path; DHS said USCIS would announce any expansion through USCIS premium-processing guidance.",
      tone: "warning",
      sourceIds: ["USCIS-G1055-I539", "USCIS-I539-PREMIUM", "FR-2026-FINAL-RULE"]
    });
  }

  if (scenario.educationLevel === "graduate") {
    items.push({
      title: "Graduate students have special school-change limits.",
      body:
        "Because you selected graduate study, transfers and academic program changes need special care. The rule is much stricter for graduate-level students than for undergraduates, and a transfer may need an SEVP exception.",
      tone: "warning",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  } else if (scenario.educationLevel === "undergraduate") {
    items.push({
      title: "Undergraduate changes depend on timing.",
      body:
        "Because you selected undergraduate study, a transfer or program change may depend on whether you have completed one academic year. That is separate from the I-94 end-date calculation.",
      tone: "info",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  } else if (scenario.educationLevel === "unknown") {
    items.push({
      title: "Your program level may change the advice.",
      body:
        "Graduate, undergraduate, and other F-1 programs are not treated the same for school transfers and program changes. Add your level when you know it to narrow this part of the answer.",
      tone: "question",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  }

  if (scenario.nextProgramLevelPlan === "same_or_lower") {
    items.push({
      title: "A same-level or lower-level next program is a serious issue.",
      body:
        "You selected a possible next program at the same or a lower level. For programs completed after September 15, 2026, the rule generally blocks using F-1 status for a new program at the same or lower education level.",
      tone: "danger",
      sourceIds: ["8CFR-214-2-F5II"]
    });
  }

  return items;
}

function AdvisoryPanel({
  scenario,
  result,
  travelResult
}: {
  scenario: StudentScenario;
  result: PlannerView;
  travelResult: PlannerView | null;
}) {
  const items = buildAdvisoryItems(scenario, result, travelResult);

  return (
    <section className="band advisory-panel">
      <div className="section-title">
        <Sparkles aria-hidden="true" />
        <h2>Your advisement note</h2>
      </div>
      <div className="advisory-list">
        {items.map((item) => (
          <article key={item.title} className={`advisory-card ${item.tone}`}>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <SourceChips result={result} sourceIds={item.sourceIds} />
          </article>
        ))}
      </div>
    </section>
  );
}

function buildStudentOutcome(scenario: StudentScenario, result: PlannerView, travelResult: PlannerView | null): StudentOutcome {
  if (scenario.startingPosition === "unknown") {
    return {
      eyebrow: "Start here",
      title: "Answer one question to see what changes.",
      detail: "The biggest split is whether F-1 status starts before or after September 15, 2026.",
      tone: "manual"
    };
  }

  if (isCurrentTrack(scenario)) {
    const beyondProtectedPeriod = programRunsPastCoverage(scenario, result);

    if (!scenario.programEndOnEffectiveDate) {
      return {
        eyebrow: "Current F-1 student",
        title: "The new fixed-date I-94 does not automatically take over this stay.",
        detail:
          "If you are inside the U.S. on September 15, 2026 and your I-94 says D/S, the old D/S rules may keep covering your current stay. Your I-20 date, travel, OPT/STEM, and school changes tell us how far that protection goes.",
        tone: "good"
      };
    }

    if (scenario.inUsOnEffectiveDate === "no" || scenario.maintainingStatusOnEffectiveDate === "no") {
      return {
        eyebrow: "Current F-1 student",
        title: "Being outside the U.S. on September 15 changes the path.",
        detail:
          "The old-rule protection is for students who are physically in the U.S. when the rule starts. If you return after that date, your return may be treated as a new fixed-date F-1 admission.",
        tone: "warning"
      };
    }

    if (programEndBeforeRuleStarts(scenario) && scenario.optStage === "none" && !scenario.eadEndOnEffectiveDate) {
      return {
        eyebrow: "Before the new rule starts",
        title: "Your I-20 ends before September 15, 2026.",
        detail:
          "This I-20 alone does not show that you will still be in F-1 status when the new rule starts. Tell us whether you will have OPT, STEM OPT, or a later I-20.",
        tone: "manual"
      };
    }

    if (result.coverageEnd && result.latestDepartureDate) {
      return {
        eyebrow: "If you do not travel",
        title: beyondProtectedPeriod
          ? "You are partly exempt, but not through the whole program."
          : `You may stay under the old D/S rules until ${formatDate(result.coverageEnd)}.`,
        detail: beyondProtectedPeriod
          ? `The old-rule protection stops on ${formatDate(
              result.coverageEnd
            )}. To stay after that date for study or training, you likely need to file an extension of stay before the protected period ends.`
          : `After that date, the F-1 period to leave the U.S. or take another immigration step runs through ${formatDate(
              result.latestDepartureDate
            )}.`,
        tone: beyondProtectedPeriod ? "warning" : result.status === "ok" ? "good" : result.status === "manual" ? "manual" : "warning"
      };
    }

    return {
      eyebrow: "Need one more answer",
      title: "We can show the effect once the missing date is clear.",
      detail: result.followUpQuestions[0] ?? "Add the next answer in the question flow.",
      tone: "manual"
    };
  }

  if (!scenario.reentryDate) {
    return {
      eyebrow: "Future F-1 student",
      title: "Enter the date you expect to enter the U.S.",
      detail: "For students who enter after the rule starts, the U.S. entry date starts the fixed-date clock.",
      tone: "manual"
    };
  }

  if (!scenario.currentProgramEndDate) {
    return {
      eyebrow: "Future F-1 student",
      title: "Enter the program end date on the I-20.",
      detail: "The new rule compares that date with four years from U.S. entry.",
      tone: "manual"
    };
  }

  return {
    eyebrow: "New fixed-date system",
    title: result.coverageEnd ? `Your first fixed F-1 period may end on ${formatDate(result.coverageEnd)}.` : "One more date is needed.",
    detail: result.latestDepartureDate
      ? `After that, the 30-day period to leave the U.S. or take another immigration step runs through ${formatDate(result.latestDepartureDate)}.`
      : "Add the missing date to see the full timeline.",
    tone: result.status === "ok" ? "good" : result.status === "manual" ? "manual" : "warning"
  };
}

function buildImpactCards(scenario: StudentScenario, result: PlannerView, travelResult: PlannerView | null): ImpactCard[] {
  if (scenario.startingPosition === "unknown") {
    return [
      {
        title: "Before or after September 15?",
        detail: "That one fact decides whether we look first at the old D/S rules or the new fixed-date system.",
        tone: "question"
      }
    ];
  }

  if (isCurrentTrack(scenario)) {
    const cards: ImpactCard[] = [
      {
        title: "This stay may remain under the old D/S rules",
        detail:
          "Current F-1 students are not automatically switched to a fixed I-94 on September 15. If you are in the U.S. that day and your I-94 says D/S, this stay can remain in the old-rule path.",
        tone: "good"
      }
    ];

    if (scenario.inUsOnEffectiveDate === "no" || scenario.maintainingStatusOnEffectiveDate === "no") {
      cards.push({
        title: "The September 15 location answer changes this",
        detail:
          "The old-rule protection is for students physically in the U.S. when the rule starts. If you are outside the U.S. then, a later return may start a fixed-date admission instead.",
        tone: "warning"
      });
    }

    if (!scenario.programEndOnEffectiveDate) {
      cards.push({
        title: "I-20 end date comes first",
        detail: "The date on your current I-20 tells us how long the old-rule protection may last before travel, OPT/STEM, or a school change changes the answer.",
        tone: "question"
      });
    } else if (programEndBeforeRuleStarts(scenario) && scenario.optStage === "none" && !scenario.eadEndOnEffectiveDate) {
      cards.push({
        title: "This I-20 ends before the new rule starts",
        detail:
          "If your F-1 status also ends before September 15, this new rule may not change that timeline. If you will have OPT, STEM OPT, or a later I-20, answer those next.",
        tone: "question"
      });
    } else if (result.coverageEnd && result.latestDepartureDate) {
      cards.push({
        title: "If you do not travel",
        detail: programRunsPastCoverage(scenario, result)
          ? `The old-rule protection stops on ${formatDate(result.coverageEnd)}. Your program or training runs later than that, so staying after that date likely needs an extension of stay.`
          : `The old D/S rules may cover this path until ${formatDate(
              result.coverageEnd
            )}. The period to leave the U.S. or take another immigration step ends ${formatDate(result.latestDepartureDate)}.`,
        tone: programRunsPastCoverage(scenario, result) ? "warning" : result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning"
      });
    }

    if (hasTravelPlan(scenario)) {
      const travelExtends = travelCanExtendTimeline(result, travelResult);
      cards.push({
        title: travelExtends ? "Travel may extend your F-1 timeline" : travelResult?.coverageEnd ? "Travel creates a second timeline" : "Travel needs a return date",
        detail: travelResult?.coverageEnd
          ? travelExtends
            ? `If you stay in the U.S., this path reaches ${formatDate(result.coverageEnd)}. If you return on ${formatDate(
                scenario.reentryDate
              )}, the new fixed-date period may run through ${formatDate(
                travelResult.coverageEnd
              )}. That can be useful, but travel also creates visa and admission risk.`
            : `If you return on ${formatDate(scenario.reentryDate)}, the new fixed-date system may run through ${formatDate(
                travelResult.coverageEnd
              )}, with 30 days after that.`
          : "The return date matters because coming back after September 15 can start a new fixed-date I-94 period.",
        tone: travelExtends ? "good" : travelResult?.coverageEnd ? "info" : "question"
      });
    } else {
      cards.push({
        title: "Travel can change the answer",
        detail: "If you leave the U.S. and come back after September 15, your return may start a new fixed-date I-94 period.",
        tone: "info"
      });
    }

    if (needsOptDate(scenario.optStage)) {
      cards.push({
        title: "OPT or STEM OPT timing matters",
        detail:
          "The important facts are whether it is regular OPT or STEM OPT, whether you filed, whether it is approved, the filing date, EAD dates, and travel timing.",
        tone: "warning"
      });
    }

    if (scenario.transferOrProgramChange === "yes") {
      cards.push({
        title: "A school transfer or program change needs its own check",
        detail: "A later I-20 end date can run past the protected period. Add the new I-20 date before relying on the stay-in-the-U.S. timeline.",
        tone: "warning"
      });
    }

    if (scenario.nextProgramLevelPlan === "same_or_lower") {
      cards.push({
        title: "Same-level or lower-level next program risk",
        detail:
          "The new rule generally blocks F-1 status for another program at the same or a lower education level after you complete a program after September 15, 2026.",
        tone: "danger"
      });
    }

    return cards;
  }

  const cards: ImpactCard[] = [
    {
      title: "Fixed-period admission path",
      detail:
        "If you first enter F-1 after September 15, 2026, your I-94 will likely have an end date. It is tied to the I-20 program end, but cannot be more than four years from entry.",
      tone: "info"
    }
  ];

  if (!scenario.reentryDate) {
    cards.push({
      title: "Entry date starts the clock",
      detail: "Add the expected U.S. entry date so we can place the four-year limit.",
      tone: "question"
    });
  }

  if (!scenario.currentProgramEndDate) {
    cards.push({
      title: "I-20 end date controls the comparison",
      detail: "The new rule compares the I-20 end date with four years from the date you enter.",
      tone: "question"
    });
  } else if (result.coverageEnd && result.latestDepartureDate) {
    cards.push({
      title: "Your first I-94 end date is now visible",
      detail: `With the answers so far, the fixed-date period may end ${formatDate(
        result.coverageEnd
      )}, followed by 30 days through ${formatDate(result.latestDepartureDate)}.`,
      tone: result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning"
    });
  }

  if (scenario.educationLevel === "graduate") {
    cards.push({
      title: "Graduate transfers and program changes are restricted",
      detail: "For graduate students, transfers and academic program changes need special review before you rely on them as an F-1 plan.",
      tone: "warning"
    });
  } else if (scenario.educationLevel === "undergraduate") {
    cards.push({
      title: "Undergraduate changes depend on the one-year rule",
      detail: "For undergraduates, a school transfer or program change may depend on whether one academic year has been completed.",
      tone: "info"
    });
  } else {
    cards.push({
      title: "Program level can change the answer",
      detail: "Graduate, undergraduate, and same/lower-level next-program plans have different limits under the new rule.",
      tone: "question"
    });
  }

  if (scenario.nextProgramLevelPlan === "same_or_lower") {
    cards.push({
      title: "Same-level or lower-level next program risk",
      detail: "The new rule generally blocks F-1 status for another program at the same or a lower education level after you complete a program after September 15, 2026.",
      tone: "danger"
    });
  }

  return cards;
}

function ImpactCards({ cards }: { cards: ImpactCard[] }) {
  return (
    <div className="impact-grid">
      {cards.map((card) => (
        <article key={`${card.title}-${card.detail}`} className={`impact-card ${card.tone}`}>
          <strong>{card.title}</strong>
          <p>{card.detail}</p>
        </article>
      ))}
    </div>
  );
}

function buildStudentTimelines(scenario: StudentScenario, result: PlannerView, travelResult: PlannerView | null): StudentTimeline[] {
  const timelines: StudentTimeline[] = [];

  if (isCurrentTrack(scenario) && scenario.programEndOnEffectiveDate) {
    const events: StudentTimelineEvent[] = [
      {
        label: "I-20 ends",
        date: scenario.programEndOnEffectiveDate,
        detail: "The program end date printed on your current I-20.",
        tone: programEndBeforeRuleStarts(scenario) ? "warning" : "info"
      },
      {
        label: "New rule starts",
        date: result.effectiveDate,
        detail: "This is the date when the new fixed-date system starts.",
        tone: "info"
      }
    ];

    if (result.coverageEnd) {
      events.push({
        label: programEndBeforeRuleStarts(scenario) ? "Current I-20 path ends" : "Old D/S period ends",
        date: result.coverageEnd,
        detail: programEndBeforeRuleStarts(scenario)
          ? "This is before the new rule starts. We need to know what F-1 basis you will have on September 15."
          : "This is the last day from the current I-20/EAD dates, unless another rule or extension changes it.",
        tone: programEndBeforeRuleStarts(scenario) ? "warning" : "good"
      });
    }

    if (result.latestDepartureDate) {
      events.push({
        label: "60-day period ends",
        date: result.latestDepartureDate,
        detail: "This is time to leave the U.S. or take another immigration step. It is not extra study or work time.",
        tone: programEndBeforeRuleStarts(scenario) ? "warning" : "info"
      });
    }

    timelines.push({
      title: "If you do not leave the U.S.",
      detail: programEndBeforeRuleStarts(scenario)
        ? "This timeline explains why an I-20 ending before September 15 needs another F-1 fact."
        : "This is the current-student path if you stay in the U.S. after the new rule starts.",
      events: sortEvents(events)
    });
  }

  if (isCurrentTrack(scenario) && hasTravelPlan(scenario) && scenario.returningAfterEffectiveDate === "yes") {
    timelines.push({
      title: "If you leave and return after September 15",
      detail: "Coming back after the rule starts can create a new fixed-date I-94 period.",
      events: sortEvents([
        {
          label: "You return to the U.S.",
          date: scenario.reentryDate,
          detail: "This return date starts the travel comparison.",
          tone: scenario.reentryDate ? "info" : "question"
        },
        {
          label: "New fixed period may end",
          date: travelResult?.coverageEnd,
          detail: "For a regular F-1 return, this is based on the I-20 end date or four years from return, whichever comes first.",
          tone: travelResult?.coverageEnd ? "warning" : "question"
        },
        {
          label: "30-day period ends",
          date: travelResult?.latestDepartureDate,
          detail: "For the new fixed-date system, the period after the fixed end date is 30 days.",
          tone: travelResult?.latestDepartureDate ? "info" : "question"
        }
      ])
    });
  }

  if (scenario.startingPosition === "prospective_outside_us") {
    timelines.push({
      title: "Your first F-1 entry after the new rule starts",
      detail: "This is the new fixed-date system for future F-1 students.",
      events: sortEvents([
        {
          label: "You enter the U.S.",
          date: scenario.reentryDate,
          detail: "This starts the fixed-date clock.",
          tone: scenario.reentryDate ? "info" : "question"
        },
        {
          label: "I-20 program ends",
          date: scenario.currentProgramEndDate,
          detail: "The program end date on the I-20 used for entry.",
          tone: scenario.currentProgramEndDate ? "info" : "question"
        },
        {
          label: "Fixed period may end",
          date: result.coverageEnd,
          detail: "This is the I-20 end date or four years from entry, whichever comes first.",
          tone: result.coverageEnd ? "warning" : "question"
        },
        {
          label: "30-day period ends",
          date: result.latestDepartureDate,
          detail: "This is time to leave the U.S. or take another immigration step.",
          tone: result.latestDepartureDate ? "info" : "question"
        }
      ])
    });
  }

  return timelines;
}

function StudentTimelines({
  scenario,
  result,
  travelResult
}: {
  scenario: StudentScenario;
  result: PlannerView;
  travelResult: PlannerView | null;
}) {
  const timelines = buildStudentTimelines(scenario, result, travelResult);
  if (!timelines.length) {
    return null;
  }

  return (
    <div className="student-timelines">
      {timelines.map((timeline) => (
        <article key={timeline.title} className="student-timeline">
          <div>
            <h3>{timeline.title}</h3>
            <p>{timeline.detail}</p>
          </div>
          <ol>
            {timeline.events.map((event) => (
              <li key={`${event.label}-${event.date ?? "missing"}`} className={event.tone}>
                <span>{formatDate(event.date)}</span>
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}

export default function App() {
  const [scenario, setScenario] = useState<StudentScenario>(DEFAULT_SCENARIO);
  const [recording, setRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("Voice input is ready.");
  const [draftNotice, setDraftNotice] = useState("");
  const [intakeExtraction, setIntakeExtraction] = useState<IntakeExtractionResponse | null>(null);
  const [intakeState, setIntakeState] = useState<"idle" | "loading" | "failed" | "ready">("idle");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const result = useMemo(() => calculateScenario(scenario), [scenario]);
  const travelResult = useMemo(() => {
    if (!isCurrentTrack(scenario) || !hasTravelPlan(scenario) || !scenario.reentryDate) {
      return null;
    }

    return calculateScenario({
      ...scenario,
      startingPosition: "readmitted_fixed_period",
      admissionBasis: "fixed_period",
      inUsOnEffectiveDate: "no",
      maintainingStatusOnEffectiveDate: "unknown"
    });
  }, [scenario]);
  const impactCards = useMemo(() => buildImpactCards(scenario, result, travelResult), [scenario, result, travelResult]);
  const studentOutcome = useMemo(() => buildStudentOutcome(scenario, result, travelResult), [scenario, result, travelResult]);
  const currentTrack = isCurrentTrack(scenario);
  const futureTrack = scenario.startingPosition === "prospective_outside_us";
  const pathChosen = scenario.startingPosition !== "unknown";
  const septemberLocationAnswered = scenario.inUsOnEffectiveDate !== "unknown";
  const optReady = Boolean(scenario.programEndOnEffectiveDate && septemberLocationAnswered);
  const optAnswered = scenario.optIntent === "no" || scenario.optIntent === "yes";
  const schoolPlanningReady = Boolean(optReady && (optAnswered || scenario.optIntent === "unknown"));

  function update<K extends keyof StudentScenario>(key: K, value: StudentScenario[K]) {
    setScenario((current) => ({ ...current, [key]: value }));
    if (key === "narrative") {
      setIntakeExtraction(null);
      setIntakeState("idle");
    }
  }

  function patchScenario(patch: Partial<StudentScenario>) {
    setScenario((current) => ({ ...current, ...patch }));
  }

  function chooseStudentPath(value: StartingPosition) {
    if (value === "current_ds_inside_us") {
      patchScenario({
        startingPosition: "current_ds_inside_us",
        admissionBasis: "duration_of_status",
        inUsOnEffectiveDate: "unknown",
        maintainingStatusOnEffectiveDate: "unknown",
        i94AdmitUntilDate: undefined,
        travelPosture: "unknown",
        returningAfterEffectiveDate: "unknown",
        optIntent: "unknown",
        optStage: "none",
        schoolTransferPlan: "unknown",
        academicProgramChangePlan: "unknown",
        educationLevel: "unknown",
        nextProgramLevelPlan: "unknown"
      });
      return;
    }

    if (value === "prospective_outside_us") {
      patchScenario({
        startingPosition: "prospective_outside_us",
        admissionBasis: "fixed_period",
        inUsOnEffectiveDate: "no",
        maintainingStatusOnEffectiveDate: "unknown",
        programEndOnEffectiveDate: undefined,
        eadEndOnEffectiveDate: undefined,
        pendingExtensionOnDeparture: "no",
        returningAfterEffectiveDate: "unknown",
        optIntent: "unknown",
        optStage: "none",
        travelPosture: "unknown",
        schoolTransferPlan: "unknown",
        academicProgramChangePlan: "unknown",
        educationLevel: "unknown",
        nextProgramLevelPlan: "unknown"
      });
      return;
    }

    patchScenario({
      startingPosition: "unknown",
      admissionBasis: "unknown",
      inUsOnEffectiveDate: "unknown",
      maintainingStatusOnEffectiveDate: "unknown"
    });
  }

  function updateCurrentI20End(value: string | undefined) {
    setScenario((current) => ({
      ...current,
      programEndOnEffectiveDate: value,
      currentProgramEndDate: current.transferOrProgramChange === "yes" ? current.currentProgramEndDate : value
    }));
  }

  function updateTransferOrProgramChange(value: YesNoUnknown) {
    setScenario((current) => ({
      ...current,
      transferOrProgramChange: value,
      currentProgramEndDate: value === "yes" ? current.currentProgramEndDate : current.programEndOnEffectiveDate ?? current.currentProgramEndDate
    }));
  }

  function updateI94Basis(value: AdmissionBasis) {
    setScenario((current) => ({
      ...current,
      admissionBasis: value,
      i94AdmitUntilDate: value === "fixed_period" ? current.i94AdmitUntilDate : undefined
    }));
  }

  function updateLeavingUs(value: TravelPosture) {
    setScenario((current) => ({
      ...current,
      travelPosture: value,
      returningAfterEffectiveDate: value === "planned" ? current.returningAfterEffectiveDate ?? "unknown" : value === "unknown" ? "unknown" : "no",
      reentryDate: value === "planned" ? current.reentryDate : undefined,
      reentryBasis: value === "planned" ? current.reentryBasis : "unknown",
      pendingExtensionOnDeparture: value === "planned" ? current.pendingExtensionOnDeparture : "no"
    }));
  }

  function updateReturnAfterRule(value: YesNoUnknown) {
    setScenario((current) => ({
      ...current,
      returningAfterEffectiveDate: value,
      reentryDate: value === "yes" ? current.reentryDate : undefined,
      reentryBasis: value === "yes" ? current.reentryBasis : "unknown",
      pendingExtensionOnDeparture: value === "yes" ? current.pendingExtensionOnDeparture : "no"
    }));
  }

  function updateOptIntent(value: YesNoUnknown) {
    setScenario((current) => ({
      ...current,
      optIntent: value,
      optStage: value === "yes" ? (current.optStage === "none" || current.optStage === "pre_completion" ? "post_completion_not_filed" : current.optStage) : "none",
      optFilingDate: value === "yes" ? current.optFilingDate : undefined,
      currentEadEndDate: value === "yes" ? current.currentEadEndDate : undefined
    }));
  }

  function updateOptKind(value: OptKind) {
    setScenario((current) => ({
      ...current,
      optStage: optStageFromParts(value, optStatusFromStage(current.optStage))
    }));
  }

  function updateOptStatus(value: OptFilingStatus) {
    setScenario((current) => ({
      ...current,
      optStage: optStageFromParts(optKindFromStage(current.optStage), value)
    }));
  }

  function updateSchoolTransfer(value: YesNoUnknown) {
    setScenario((current) => {
      const combined = combinePlanAnswers(value, current.academicProgramChangePlan ?? "no");
      return {
        ...current,
        schoolTransferPlan: value,
        transferOrProgramChange: combined,
        currentProgramEndDate: combined === "yes" ? current.currentProgramEndDate : current.programEndOnEffectiveDate ?? current.currentProgramEndDate
      };
    });
  }

  function updateAcademicProgramChange(value: YesNoUnknown) {
    setScenario((current) => {
      const combined = combinePlanAnswers(current.schoolTransferPlan ?? "no", value);
      return {
        ...current,
        academicProgramChangePlan: value,
        transferOrProgramChange: combined,
        currentProgramEndDate: combined === "yes" ? current.currentProgramEndDate : current.programEndOnEffectiveDate ?? current.currentProgramEndDate
      };
    });
  }

  function updateCptIntent(value: YesNoUnknown) {
    update("cptPlan", value === "yes" ? "unknown" : "none");
  }

  async function applyNarrativeDraft() {
    const narrative = scenario.narrative?.trim() ?? "";
    if (!narrative) {
      setDraftNotice("Tell your story first, by typing or speaking, and then I can draft facts from it.");
      return;
    }

    setIntakeState("loading");
    setIntakeExtraction(null);
    setDraftNotice("Reading your story with GPT-5.6...");

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ narrative, currentScenario: scenario })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as IntakeExtractionResponse;
      setIntakeExtraction(payload);
      setIntakeState("ready");
      setDraftNotice(
        payload.facts.length
          ? `I found ${payload.facts.length} candidate fact${payload.facts.length === 1 ? "" : "s"}. Review what I understood before applying it.`
          : "I read the story but did not find facts I can safely apply yet. The follow-up questions below are the next best path."
      );
    } catch {
      setIntakeState("failed");
      setDraftNotice("OpenAI intake is not available yet, so I did not change your scenario facts.");
    }
  }

  function applyExtractedFacts() {
    if (!intakeExtraction) {
      return;
    }

    const factsToApply = readyFacts(intakeExtraction.facts);
    const nextScenario = scenarioWithFacts(scenario, intakeExtraction.facts);
    const changes = describeDraftChanges(scenario, nextScenario);
    setScenario(nextScenario);
    setDraftNotice(
      changes.length
        ? `Updated ${changes.length} scenario field${changes.length === 1 ? "" : "s"} from ${factsToApply.length} applied fact${factsToApply.length === 1 ? "" : "s"}: ${changes.join(", ")}.`
        : factsToApply.length
          ? "Those facts were already in your scenario. Nothing else changed."
          : "No facts are ready to apply yet. The remaining items need clarification or can be edited directly."
    );
  }

  function toggleSpeech() {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (recording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setRecording(false);
      setVoiceNotice("Stopped listening.");
      return;
    }

    if (!Recognition) {
      setRecording(false);
      setVoiceNotice("Voice input is not available in this browser. Typing your story works too.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          transcript += `${event.results[index][0].transcript} `;
        } else {
          interimTranscript += `${event.results[index][0].transcript} `;
        }
      }
      if (interimTranscript.trim()) {
        setVoiceNotice(`Listening: "${interimTranscript.trim()}"`);
      }
      if (transcript.trim()) {
        setScenario((current) => ({
          ...current,
          narrative: `${current.narrative ?? ""} ${transcript}`.trim()
        }));
        setVoiceNotice(`Added to your story: "${transcript.trim()}"`);
        setDraftNotice("Press Draft facts to turn the story into scenario answers.");
        setIntakeExtraction(null);
        setIntakeState("idle");
      }
    };
    recognition.onerror = (event) => {
      setRecording(false);
      setVoiceNotice(
        event.error === "not-allowed"
          ? "Microphone permission was blocked. Typing your story works too."
          : "Voice input stopped before adding text. You can try again or type your story."
      );
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setRecording(false);
      setVoiceNotice((current) => (current.startsWith("Listening") ? "Listening ended. Try speaking again or type your story." : current));
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
      setVoiceNotice("Listening. Speak naturally about your school, I-20 dates, travel, OPT/STEM, or transfer plans.");
    } catch {
      setRecording(false);
      setVoiceNotice("Voice input could not start. Typing your story works too.");
    }
  }

  const applicableFacts = intakeExtraction ? readyFacts(intakeExtraction.facts) : [];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">F-1 fixed-period planner</p>
          <h1>F-1 rule impact planner</h1>
        </div>
        <nav className="top-links" aria-label="Reference links">
          <a href="#what-happened">
            <Info aria-hidden="true" />
            What happened
          </a>
          <a href="https://www.nafsa.org/regulatory-information/dhs-final-rule-ending-duration-status" target="_blank" rel="noreferrer">
            <FileText aria-hidden="true" />
            NAFSA overview
          </a>
          <a
            href="https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant"
            target="_blank"
            rel="noreferrer"
          >
            <FileText aria-hidden="true" />
            Official rule
          </a>
        </nav>
      </header>

      <main className="workspace">
        <aside className="intake">
          <section className="panel">
            <div className="section-title">
              <CalendarClock aria-hidden="true" />
              <h2>Build your scenario</h2>
            </div>

            <div className="flow-step active">
              <span className="step-kicker">Start</span>
              <Segmented
                label="Are you already an F-1 student, or will you be one before September 15, 2026?"
                value={scenario.startingPosition}
                options={pathOptions}
                onChange={chooseStudentPath}
              />
              <p className="microcopy">For F-1 students and people planning to use F-1 status.</p>
            </div>

            {pathChosen && currentTrack && (
              <>
                <div className="flow-step active">
                  <span className="step-kicker">Current I-20</span>
                  <DateField label="What is the program end date on your current I-20?" value={scenario.programEndOnEffectiveDate} onChange={updateCurrentI20End} />
                  <p className="microcopy">Use the end date printed on the I-20 you have now.</p>
                  <details className="inline-correction">
                    <summary>My I-94 has an end date instead of D/S</summary>
                    <p className="microcopy">
                      Most current F-1 students have D/S on the I-94. Only change this if your CBP I-94 shows an actual end date.
                    </p>
                    <Segmented label="What does your I-94 show?" value={scenario.admissionBasis} options={i94Options} onChange={updateI94Basis} />
                    {scenario.admissionBasis === "fixed_period" && (
                      <DateField label="What end date is printed on your I-94?" value={scenario.i94AdmitUntilDate} onChange={(value) => update("i94AdmitUntilDate", value)} />
                    )}
                  </details>
                </div>

                {scenario.programEndOnEffectiveDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">September 15 check</span>
                    <Segmented
                      label="Will you be inside the United States on September 15, 2026?"
                      value={scenario.inUsOnEffectiveDate === "yes" && scenario.maintainingStatusOnEffectiveDate === "yes" ? "yes" : scenario.inUsOnEffectiveDate === "no" || scenario.maintainingStatusOnEffectiveDate === "no" ? "no" : "unknown"}
                      options={yesNoOptions}
                      onChange={(value) =>
                        patchScenario({
                          inUsOnEffectiveDate: value,
                          maintainingStatusOnEffectiveDate: value === "yes" ? "yes" : value
                        })
                      }
                    />
                    <p className="microcopy">This matters because the old-rule protection is only for students who are physically in the U.S. when the new rule starts.</p>
                  </div>
                )}

                {scenario.programEndOnEffectiveDate && septemberLocationAnswered && (
                  <div className="flow-step active">
                    <span className="step-kicker">Travel</span>
                    <Segmented
                      label="Are you planning to leave the U.S.?"
                      value={hasTravelPlan(scenario) ? "planned" : scenario.travelPosture === "unknown" ? "unknown" : "none"}
                      options={travelDecisionOptions}
                      onChange={updateLeavingUs}
                    />
                    {hasTravelPlan(scenario) && (
                      <>
                        <Segmented
                          label="Will you return to the U.S. after September 15, 2026?"
                          value={scenario.returningAfterEffectiveDate ?? "unknown"}
                          options={returnAfterRuleOptions}
                          onChange={updateReturnAfterRule}
                        />
                        {scenario.returningAfterEffectiveDate === "yes" && (
                          <>
                            <DateField label="What date would you come back to the U.S.?" value={scenario.reentryDate} onChange={(value) => update("reentryDate", value)} />
                            <SelectField label="How would you come back?" value={scenario.reentryBasis} options={reentryLabels} onChange={(value) => update("reentryBasis", value)} />
                            <Segmented
                              label="Will an F-1 extension request be pending when you leave?"
                              value={scenario.pendingExtensionOnDeparture}
                              options={yesNoOptions}
                              onChange={(value) => update("pendingExtensionOnDeparture", value)}
                            />
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {optReady && (
                  <div className="flow-step active">
                    <span className="step-kicker">OPT or STEM OPT</span>
                    <Segmented
                      label="Are you planning post-completion OPT or STEM OPT?"
                      value={scenario.optIntent ?? "unknown"}
                      options={planningOptions}
                      onChange={updateOptIntent}
                    />
                    {needsOptDate(scenario.optStage) && (
                      <>
                        <Segmented label="Which kind?" value={optKindFromStage(scenario.optStage)} options={optKindOptions} onChange={updateOptKind} />
                        <Segmented label="Have you filed the I-765?" value={optStatusFromStage(scenario.optStage)} options={optStatusOptions} onChange={updateOptStatus} />
                        <DateField label="When did you file, or when do you plan to file, the I-765?" value={scenario.optFilingDate} onChange={(value) => update("optFilingDate", value)} />
                        {hasApprovedOpt(scenario.optStage) && (
                          <DateField label="What end date is on the EAD card?" value={scenario.currentEadEndDate} onChange={(value) => update("currentEadEndDate", value)} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {schoolPlanningReady && (
                  <div className="flow-step active">
                    <span className="step-kicker">School changes</span>
                    <Segmented
                      label="Are you in an undergraduate or graduate program?"
                      value={scenario.educationLevel ?? "unknown"}
                      options={educationLevelOptions}
                      onChange={(value) => update("educationLevel", value)}
                    />
                    <Segmented
                      label="Are you planning to transfer to a different school?"
                      value={scenario.schoolTransferPlan ?? "unknown"}
                      options={planningOptions}
                      onChange={updateSchoolTransfer}
                    />
                    <Segmented
                      label="Are you planning to change your academic program?"
                      value={scenario.academicProgramChangePlan ?? "unknown"}
                      options={planningOptions}
                      onChange={updateAcademicProgramChange}
                    />
                    {scenario.transferOrProgramChange === "yes" && (
                      <DateField
                        label={
                          scenario.schoolTransferPlan === "yes" && scenario.academicProgramChangePlan === "yes"
                            ? "What end date is on the new school or new program I-20?"
                            : scenario.schoolTransferPlan === "yes"
                              ? "What program end date is on the I-20 from the new school?"
                              : "What end date is on the I-20 for the new academic program?"
                        }
                        value={scenario.currentProgramEndDate}
                        onChange={(value) => update("currentProgramEndDate", value)}
                      />
                    )}
                    <Segmented
                      label="After this program, are you considering another program at the same level or a lower level?"
                      value={scenario.nextProgramLevelPlan ?? "unknown"}
                      options={nextProgramLevelOptions}
                      onChange={(value) => update("nextProgramLevelPlan", value)}
                    />
                    <Segmented
                      label="Are you planning CPT?"
                      value={scenario.cptPlan === "none" ? "no" : "yes"}
                      options={yesNoOnlyOptions}
                      onChange={updateCptIntent}
                    />
                  </div>
                )}
              </>
            )}

            {pathChosen && futureTrack && (
              <>
                <div className="flow-step active">
                  <span className="step-kicker">Your entry</span>
                  <DateField label="When do you expect to first enter the U.S. in F-1 status?" value={scenario.reentryDate} onChange={(value) => update("reentryDate", value)} />
                </div>

                {scenario.reentryDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">Your I-20</span>
                    <DateField label="What program end date is on the I-20 you will use to enter?" value={scenario.currentProgramEndDate} onChange={(value) => update("currentProgramEndDate", value)} />
                  </div>
                )}

                {scenario.reentryDate && scenario.currentProgramEndDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">Future-student branches</span>
                    <Segmented
                      label="Are you entering an undergraduate or graduate program?"
                      value={scenario.educationLevel ?? "unknown"}
                      options={educationLevelOptions}
                      onChange={(value) => update("educationLevel", value)}
                    />
                    <Segmented
                      label="Are you already thinking about transferring schools?"
                      value={scenario.schoolTransferPlan ?? "unknown"}
                      options={planningOptions}
                      onChange={updateSchoolTransfer}
                    />
                    <Segmented
                      label="Are you already thinking about changing academic programs?"
                      value={scenario.academicProgramChangePlan ?? "unknown"}
                      options={planningOptions}
                      onChange={updateAcademicProgramChange}
                    />
                    <Segmented
                      label="After this program, are you considering another program at the same level or a lower level?"
                      value={scenario.nextProgramLevelPlan ?? "unknown"}
                      options={nextProgramLevelOptions}
                      onChange={(value) => update("nextProgramLevelPlan", value)}
                    />
                    <Segmented
                      label="Are you already thinking about post-completion OPT or STEM OPT?"
                      value={scenario.optIntent ?? "unknown"}
                      options={planningOptions}
                      onChange={updateOptIntent}
                    />
                    <Segmented
                      label="Are you already thinking about CPT?"
                      value={scenario.cptPlan === "none" ? "no" : "yes"}
                      options={yesNoOnlyOptions}
                      onChange={updateCptIntent}
                    />
                  </div>
                )}
              </>
            )}
          </section>

          <section className="panel narrative">
            <div className="section-title">
              <Mic aria-hidden="true" />
              <h2>Narrative intake</h2>
            </div>
            <textarea
              value={scenario.narrative ?? ""}
              onChange={(event) => update("narrative", event.currentTarget.value)}
              placeholder="Example: I am in the U.S. now on F-1 D/S. My I-20 ends May 15, 2031 and I may travel in August 2027."
            />
            <div className="button-row">
              <button type="button" onClick={toggleSpeech}>
                {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
                {recording ? "Stop" : "Speak"}
              </button>
              <button type="button" onClick={applyNarrativeDraft} disabled={intakeState === "loading"}>
                {intakeState === "loading" ? <RefreshCw aria-hidden="true" className="spin" /> : <Wand2 aria-hidden="true" />}
                {intakeState === "loading" ? "Reading" : "Draft facts"}
              </button>
            </div>
            <p className="muted status-line" aria-live="polite">
              {recording ? "Recording..." : voiceNotice}
            </p>
            {draftNotice && (
              <p className="muted status-line" aria-live="polite">
                {draftNotice}
              </p>
            )}
            {intakeExtraction && (
              <div className="understood">
                <div className="understood-heading">
                  <h3>What I understood</h3>
                  {intakeExtraction.model && <span>{intakeExtraction.model}</span>}
                </div>
                <p>{intakeExtraction.summary}</p>

                {intakeExtraction.facts.length > 0 && (
                  <div className="understood-list">
                    {intakeExtraction.facts.map((fact, index) => (
                      <div key={`${fact.field}-${fact.value}-${index}`} className={`understood-fact ${fact.confidence}`}>
                        <div>
                          <strong>{fact.label || factFieldLabels[fact.field]}</strong>
                          <span>{factDisplayValue(fact)}</span>
                        </div>
                        <p>{fact.evidence}</p>
                        <small>
                          {fact.confidence} confidence{fact.needsConfirmation ? " · check this" : ""}
                          {!isSupportedFactValue(fact) ? " · needs clarification" : ""}
                        </small>
                        {fact.note && <em>{fact.note}</em>}
                      </div>
                    ))}
                  </div>
                )}

                {(intakeExtraction.followUpQuestions.length > 0 || intakeExtraction.cautions.length > 0) && (
                  <div className="understood-followups">
                    {intakeExtraction.followUpQuestions.length > 0 && <strong>Next details to add</strong>}
                    {intakeExtraction.followUpQuestions.map((question) => (
                      <p key={question}>{question}</p>
                    ))}
                    {intakeExtraction.cautions.length > 0 && <strong>Things to double-check</strong>}
                    {intakeExtraction.cautions.map((caution) => (
                      <p key={caution}>{caution}</p>
                    ))}
                    <small>Answer these in the questions above, or edit your story and draft facts again.</small>
                  </div>
                )}

                <button type="button" onClick={applyExtractedFacts} disabled={applicableFacts.length === 0}>
                  <CheckCircle2 aria-hidden="true" />
                  {applicableFacts.length
                    ? `Apply ${applicableFacts.length} fact${applicableFacts.length === 1 ? "" : "s"} to my scenario`
                    : "No facts ready to apply"}
                </button>
              </div>
            )}
            {intakeState === "failed" && (
              <p className="muted status-line" aria-live="polite">
                The OpenAI intake endpoint is not available yet. No scenario facts were changed.
              </p>
            )}
          </section>
        </aside>

        <section className="results">
          <RuleOverview result={result} />

          <div className={`outcome ${studentOutcome.tone}`}>
            <p>{studentOutcome.eyebrow}</p>
            <h2>{studentOutcome.title}</h2>
            <span>{studentOutcome.detail}</span>
          </div>

          <AdvisoryPanel scenario={scenario} result={result} travelResult={travelResult} />

          <section className="band impact-surface">
            <div className="section-title">
              <Sparkles aria-hidden="true" />
              <h2>What this means so far</h2>
            </div>
            <ImpactCards cards={impactCards} />
            <StudentTimelines scenario={scenario} result={result} travelResult={travelResult} />
          </section>

          <details className="band technical-details">
            <summary>Calculate results</summary>
            <div className="technical-grid">
              <section>
                <h2>Findings</h2>
                <div className="finding-list">
                  {result.findings.map((item) => (
                    <article key={item.id} className={`finding ${item.tone}`}>
                      {findingIcon(item.tone)}
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.detail}</p>
                        <SourceChips result={result} sourceIds={item.sourceIds} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              {(result.followUpQuestions.length > 0 || result.nextActions.length > 0) && (
                <section className="split">
                  <div>
                    <h2>Questions to answer</h2>
                    {result.followUpQuestions.length ? (
                      <ul>
                        {result.followUpQuestions.map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No blocking fact gaps in this scenario.</p>
                    )}
                  </div>
                  <div>
                    <h2>Suggested next steps</h2>
                    {result.nextActions.length ? (
                      <ul>
                        {result.nextActions.map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No extra action flags from the deterministic engine.</p>
                    )}
                  </div>
                </section>
              )}

              <section className="sources">
                <h2>Sources</h2>
                <ul>
                  {result.citations.map((citation) => (
                    <li key={citation.id}>
                      <a href={citation.url} target="_blank" rel="noreferrer">
                        {citation.id}
                      </a>
                      <span>{citation.locator}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}

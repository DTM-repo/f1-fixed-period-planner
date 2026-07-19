import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  HelpCircle,
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
  Finding,
  OptStage,
  ReentryBasis,
  StartingPosition,
  StudentScenario,
  TravelPosture,
  YesNoUnknown
} from "./engine/types";

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
    cptPlan: cptLabels
  };

  if (fact.field === "inUsOnEffectiveDate" || fact.field === "maintainingStatusOnEffectiveDate" || fact.field === "pendingExtensionOnDeparture" || fact.field === "transferOrProgramChange") {
    return yesNoOptions.find((option) => option.value === fact.value)?.label ?? fact.value;
  }

  return labelMap[fact.field]?.[fact.value] ?? fact.value;
}

function readyFacts(facts: IntakeCandidateFact[]): IntakeCandidateFact[] {
  return facts.filter((fact) => fact.confidence !== "low" && isSupportedFactValue(fact));
}

function scenarioWithFacts(current: StudentScenario, facts: IntakeCandidateFact[]): StudentScenario {
  const patch: Partial<Record<IntakeFactField, string>> = {};
  for (const fact of readyFacts(facts)) {
    patch[fact.field] = fact.value;
  }

  return {
    ...current,
    ...patch,
    narrative: current.narrative
  } as StudentScenario;
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
        const citation = result.citations.find((item) => item.id === sourceId);
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
        title: "You may be partly exempt from the new fixed-date rule.",
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
        title: "You may be partly exempt from the new fixed-date rule",
        detail:
          "Current F-1 students are not automatically switched to a fixed I-94 on September 15. If you are in the U.S. that day and your I-94 says D/S, the old D/S rules may keep covering this stay.",
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

  cards.push({
    title: "Transfers and program changes need separate questions",
    detail:
      "The next version will break out first-year transfer limits, graduate program changes, and change of status inside the U.S.",
    tone: "warning"
  });

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
  const travelAnswered =
    scenario.travelPosture === "none" ||
    (hasTravelPlan(scenario) &&
      scenario.returningAfterEffectiveDate !== "unknown" &&
      (scenario.returningAfterEffectiveDate !== "yes" || Boolean(scenario.reentryDate)));
  const optReady = Boolean(
    scenario.programEndOnEffectiveDate &&
      septemberLocationAnswered &&
      travelAnswered
  );
  const optAnswered = scenario.optIntent === "no" || scenario.optIntent === "yes";
  const schoolPlanningReady = Boolean(optReady && optAnswered);

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
        academicProgramChangePlan: "unknown"
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
        academicProgramChangePlan: "unknown"
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
          : "I read the story but did not find calculator-ready facts yet. The follow-up questions below are the next best path."
      );
    } catch {
      setIntakeState("failed");
      setDraftNotice("OpenAI intake is not available yet, so I did not change the calculator facts.");
    }
  }

  function applyExtractedFacts() {
    if (!intakeExtraction) {
      return;
    }

    const nextScenario = scenarioWithFacts(scenario, intakeExtraction.facts);
    const changes = describeDraftChanges(scenario, nextScenario);
    setScenario(nextScenario);
    setDraftNotice(
      changes.length
        ? `Applied ${changes.length} confirmed fact${changes.length === 1 ? "" : "s"}: ${changes.join(", ")}.`
        : "No calculator facts changed. The remaining items need clarification or can be edited directly."
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
        setDraftNotice("Press Draft facts to turn the story into calculator inputs.");
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
        <a
          href="https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant"
          target="_blank"
          rel="noreferrer"
        >
          <FileText aria-hidden="true" />
          Official rule
        </a>
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
                  Apply understood facts
                </button>
              </div>
            )}
            {intakeState === "failed" && (
              <p className="muted status-line" aria-live="polite">
                The OpenAI intake endpoint is not available yet. No calculator facts were changed.
              </p>
            )}
          </section>
        </aside>

        <section className="results">
          <div className={`outcome ${studentOutcome.tone}`}>
            <p>{studentOutcome.eyebrow}</p>
            <h2>{studentOutcome.title}</h2>
            <span>{studentOutcome.detail}</span>
          </div>

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

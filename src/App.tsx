import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  HelpCircle,
  Mic,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExplanationResponse } from "./ai/explanationPayload";
import type { IntakeCandidateFact, IntakeExtractionResponse, IntakeFactField } from "./ai/intakePayload";
import { buildLocalExplanation } from "./ai/localExplanation";
import { DEMO_SCENARIOS, DEFAULT_SCENARIO } from "./content/demoScenarios";
import { calculateScenario } from "./engine/calculateScenario";
import { formatDate, isValidDateString } from "./engine/dateMath";
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
  { value: "unknown", label: "Unknown" }
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
  if (!parts.month || !parts.day || !parts.year) {
    return undefined;
  }

  return `${parts.year.padStart(4, "0")}-${parts.month.padStart(2, "0")}-${parts.day.padStart(2, "0")}`;
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

    const complete = Boolean(nextParts.month && nextParts.day && nextParts.year);
    const empty = !nextParts.month && !nextParts.day && !nextParts.year;
    if (complete || empty) {
      onChange(dateValueFromParts(nextParts));
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
  { value: "unknown", label: "Not sure" }
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

function buildImpactCards(scenario: StudentScenario, result: PlannerView, travelResult: PlannerView | null): ImpactCard[] {
  if (scenario.startingPosition === "unknown") {
    return [
      {
        title: "Start with the timing split",
        detail: "The biggest impact changes depending on whether F-1 status is in place before September 15, 2026 or starts after that date.",
        tone: "question"
      }
    ];
  }

  if (isCurrentTrack(scenario)) {
    const cards: ImpactCard[] = [
      {
        title: "Possible grandfathering path",
        detail:
          "For this path, the app assumes the usual current-student I-94 answer: D/S. The student can correct that under “what else could affect this.”",
        tone: "info"
      }
    ];

    if (!scenario.programEndOnEffectiveDate) {
      cards.push({
        title: "Next date controls the first result",
        detail: "The I-20 end date lets the app show the stay-put transition timeline instead of a general warning.",
        tone: "question"
      });
    } else if (result.coverageEnd && result.latestDepartureDate) {
      cards.push({
        title: "Stay-put timeline is now visible",
        detail: `With the facts entered so far, the tested status/admission point is ${formatDate(
          result.coverageEnd
        )}, followed by the F-1 departure period through ${formatDate(result.latestDepartureDate)}.`,
        tone: result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning"
      });
    }

    if (hasTravelPlan(scenario)) {
      cards.push({
        title: travelResult?.coverageEnd ? "Travel creates a second branch" : "Travel needs a return date",
        detail: travelResult?.coverageEnd
          ? `A regular return on ${formatDate(scenario.reentryDate)} tests a fixed-period branch through ${formatDate(
              travelResult.coverageEnd
            )}, with 30 days after that.`
          : "For travel, the return/admission date is the date that starts the new fixed-period comparison.",
        tone: travelResult?.coverageEnd ? "info" : "question"
      });
    } else {
      cards.push({
        title: "Travel is the big fork",
        detail: "If the student stays in the U.S., the transition branch may remain intact. Leaving and returning after the rule date can create a fixed-period branch.",
        tone: "info"
      });
    }

    if (needsOptDate(scenario.optStage)) {
      cards.push({
        title: "OPT/STEM timing matters",
        detail:
          "For this rule, the filing date, pending/approved posture, EAD dates, and travel timing matter more than the hoped-for OPT start date alone.",
        tone: "warning"
      });
    }

    if (scenario.transferOrProgramChange === "yes") {
      cards.push({
        title: "Later school or program changes may outgrow the transition period",
        detail: "The app compares the I-20 date in place on September 15 with the later program date being tested.",
        tone: "warning"
      });
    }

    return cards;
  }

  const cards: ImpactCard[] = [
    {
      title: "Fixed-period admission path",
      detail:
        "Students who first enter F-1 after September 15, 2026 are tested under a fixed admission period tied to the I-20 program end, capped at four years, plus 30 days.",
      tone: "info"
    }
  ];

  if (!scenario.reentryDate) {
    cards.push({
      title: "Entry date starts the clock",
      detail: "Add the expected U.S. entry date so the app can place the four-year cap on the timeline.",
      tone: "question"
    });
  }

  if (!scenario.currentProgramEndDate) {
    cards.push({
      title: "I-20 end date controls the comparison",
      detail: "The fixed-period result compares the I-20 end date with four years from admission.",
      tone: "question"
    });
  } else if (result.coverageEnd && result.latestDepartureDate) {
    cards.push({
      title: "Fixed-period date is now visible",
      detail: `With the facts entered so far, the tested admit-until point is ${formatDate(
        result.coverageEnd
      )}, followed by 30 days through ${formatDate(result.latestDepartureDate)}.`,
      tone: result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning"
    });
  }

  cards.push({
    title: "Transfers, program changes, and change of status need their own branch",
    detail:
      "This prototype flags those issues as possible rule impacts while we finish the dedicated question path for new students.",
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

function BranchTimeline({
  scenario,
  result,
  travelResult
}: {
  scenario: StudentScenario;
  result: PlannerView;
  travelResult: PlannerView | null;
}) {
  const rows: Array<{
    label: string;
    start?: string;
    activityEnd?: string;
    finalEnd?: string;
    tone: ImpactTone;
    note: string;
  }> = [];

  if (isCurrentTrack(scenario)) {
    rows.push({
      label: "If you stay in the U.S.",
      start: result.effectiveDate,
      activityEnd: result.coverageEnd,
      finalEnd: result.latestDepartureDate,
      tone: result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning",
      note: "Transition path based on the September 15 facts."
    });

    if (hasTravelPlan(scenario)) {
      rows.push({
        label: "If you leave and return",
        start: scenario.reentryDate,
        activityEnd: travelResult?.coverageEnd,
        finalEnd: travelResult?.latestDepartureDate,
        tone: travelResult?.status === "ok" ? "good" : travelResult ? "warning" : "question",
        note: "Fixed-period comparison after return."
      });
    }
  } else if (scenario.startingPosition === "prospective_outside_us") {
    rows.push({
      label: "First F-1 entry",
      start: scenario.reentryDate ?? result.effectiveDate,
      activityEnd: result.coverageEnd,
      finalEnd: result.latestDepartureDate,
      tone: result.status === "ok" ? "good" : result.status === "manual" ? "question" : "warning",
      note: "Fixed-period admission path."
    });
  }

  if (!rows.length) {
    return null;
  }

  return (
    <div className="branch-timeline">
      {rows.map((row) => (
        <article key={row.label} className={`branch-row ${row.tone}`}>
          <div className="branch-copy">
            <strong>{row.label}</strong>
            <span>{row.note}</span>
          </div>
          <div className="branch-track" aria-hidden="true">
            <span className="branch-dot" />
            <span className="branch-main" />
            <span className="branch-dot" />
            <span className="branch-grace" />
            <span className="branch-dot end" />
          </div>
          <div className="branch-dates">
            <span>{formatDate(row.start)}</span>
            <span>{formatDate(row.activityEnd)}</span>
            <span>{formatDate(row.finalEnd)}</span>
          </div>
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
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [aiState, setAiState] = useState<"idle" | "loading" | "failed" | "fallback" | "ready">("idle");
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
  const currentTrack = isCurrentTrack(scenario);
  const futureTrack = scenario.startingPosition === "prospective_outside_us";
  const pathChosen = scenario.startingPosition !== "unknown";

  function update<K extends keyof StudentScenario>(key: K, value: StudentScenario[K]) {
    setScenario((current) => ({ ...current, [key]: value }));
    if (key === "narrative") {
      setIntakeExtraction(null);
      setIntakeState("idle");
    }
    setAiExplanation("");
    setAiState("idle");
  }

  function patchScenario(patch: Partial<StudentScenario>) {
    setScenario((current) => ({ ...current, ...patch }));
    setAiExplanation("");
    setAiState("idle");
  }

  function chooseStudentPath(value: StartingPosition) {
    if (value === "current_ds_inside_us") {
      patchScenario({
        startingPosition: "current_ds_inside_us",
        admissionBasis: "duration_of_status",
        inUsOnEffectiveDate: "yes",
        maintainingStatusOnEffectiveDate: "yes",
        i94AdmitUntilDate: undefined
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
        pendingExtensionOnDeparture: "no"
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
    setAiExplanation("");
    setAiState("idle");
  }

  function updateTransferOrProgramChange(value: YesNoUnknown) {
    setScenario((current) => ({
      ...current,
      transferOrProgramChange: value,
      currentProgramEndDate: value === "yes" ? current.currentProgramEndDate : current.programEndOnEffectiveDate ?? current.currentProgramEndDate
    }));
    setAiExplanation("");
    setAiState("idle");
  }

  function loadDemo(id: string) {
    const demo = DEMO_SCENARIOS.find((item) => item.id === id);
    if (demo) {
      setScenario(demo.scenario);
      setDraftNotice("");
      setIntakeExtraction(null);
      setIntakeState("idle");
      setAiExplanation("");
      setAiState("idle");
    }
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
      setAiExplanation("");
      setAiState("idle");
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
    setAiExplanation("");
    setAiState("idle");
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
        setAiExplanation("");
        setAiState("idle");
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

  async function explainWithAi() {
    setAiState("loading");
    setAiExplanation("");
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario, result })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = (await response.json()) as ExplanationResponse;
      setAiExplanation(payload.explanation);
      setAiState("ready");
    } catch {
      setAiExplanation(buildLocalExplanation(result));
      setAiState("fallback");
    }
  }

  const statusTone = result.status === "ok" ? "good" : result.status === "manual" ? "manual" : "warning";
  const applicableFacts = intakeExtraction ? readyFacts(intakeExtraction.facts) : [];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">F-1 fixed-period planner</p>
          <h1>D/S transition and admission scenario calculator</h1>
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
              <span className="step-kicker">First split</span>
              <Segmented
                label="Are you already an F-1 student, or will you be one before September 15, 2026?"
                value={scenario.startingPosition}
                options={pathOptions}
                onChange={chooseStudentPath}
              />
              <p className="microcopy">This app is for F-1 students and people planning to use F-1 status.</p>
            </div>

            {pathChosen && currentTrack && (
              <>
                <div className="flow-step active">
                  <span className="step-kicker">Your current document</span>
                  <DateField label="What is the program end date on your current I-20?" value={scenario.programEndOnEffectiveDate} onChange={updateCurrentI20End} />
                  <p className="microcopy">This is the date printed on the I-20 that will be active on September 15, 2026.</p>
                </div>

                {scenario.programEndOnEffectiveDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">September 15 check</span>
                    <Segmented
                      label="Do you expect to be in the U.S. and following F-1 rules on September 15, 2026?"
                      value={scenario.inUsOnEffectiveDate === "yes" && scenario.maintainingStatusOnEffectiveDate === "yes" ? "yes" : scenario.inUsOnEffectiveDate === "no" || scenario.maintainingStatusOnEffectiveDate === "no" ? "no" : "unknown"}
                      options={yesNoOptions}
                      onChange={(value) =>
                        patchScenario({
                          inUsOnEffectiveDate: value,
                          maintainingStatusOnEffectiveDate: value === "yes" ? "yes" : value
                        })
                      }
                    />
                    <p className="microcopy">Most current F-1 students have D/S on the I-94 today. We assume that here, and you can correct it below.</p>
                  </div>
                )}

                {scenario.programEndOnEffectiveDate && scenario.inUsOnEffectiveDate !== "unknown" && (
                  <div className="flow-step active">
                    <span className="step-kicker">Plans that can change the impact</span>
                    <SelectField label="Are you planning OPT or STEM OPT?" value={scenario.optStage} options={optLabels} onChange={(value) => update("optStage", value)} />
                    {needsOptDate(scenario.optStage) && (
                      <>
                        <DateField label="When did you file, or when do you plan to file, the I-765?" value={scenario.optFilingDate} onChange={(value) => update("optFilingDate", value)} />
                        {hasApprovedOpt(scenario.optStage) && (
                          <DateField label="If you already have the EAD card, when does it end?" value={scenario.currentEadEndDate} onChange={(value) => update("currentEadEndDate", value)} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {scenario.programEndOnEffectiveDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">Travel fork</span>
                    <Segmented
                      label="Are you planning to leave the U.S. and come back after September 15, 2026?"
                      value={scenario.travelPosture}
                      options={travelDecisionOptions}
                      onChange={(value) => update("travelPosture", value)}
                    />
                    {hasTravelPlan(scenario) && (
                      <>
                        <DateField label="When would you come back to the U.S.?" value={scenario.reentryDate} onChange={(value) => update("reentryDate", value)} />
                        <SelectField label="How would you come back?" value={scenario.reentryBasis} options={reentryLabels} onChange={(value) => update("reentryBasis", value)} />
                      </>
                    )}
                  </div>
                )}

                {scenario.programEndOnEffectiveDate && (
                  <div className="flow-step active">
                    <span className="step-kicker">School and training plans</span>
                    <Segmented
                      label="Are you planning to transfer schools or change academic programs?"
                      value={scenario.transferOrProgramChange}
                      options={yesNoOptions}
                      onChange={updateTransferOrProgramChange}
                    />
                    {scenario.transferOrProgramChange === "yes" && (
                      <DateField
                        label="What later I-20 end date should we test?"
                        value={scenario.currentProgramEndDate}
                        onChange={(value) => update("currentProgramEndDate", value)}
                      />
                    )}
                    <SelectField label="Are you trying to understand CPT timing?" value={scenario.cptPlan} options={cptLabels} onChange={(value) => update("cptPlan", value)} />
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
                      label="Are you already thinking about transferring schools or changing programs?"
                      value={scenario.transferOrProgramChange}
                      options={yesNoOptions}
                      onChange={(value) => update("transferOrProgramChange", value)}
                    />
                    <SelectField label="Are you already thinking about OPT or STEM OPT?" value={scenario.optStage} options={optLabels} onChange={(value) => update("optStage", value)} />
                    <SelectField label="CPT timing, if you know it" value={scenario.cptPlan} options={cptLabels} onChange={(value) => update("cptPlan", value)} />
                  </div>
                )}
              </>
            )}

            <details className="edge-cases">
              <summary>What else could affect this?</summary>
              <div className="edge-grid">
                <article>
                  <h3>I-94 does not say D/S</h3>
                  <p>Most current F-1 students should see D/S. If yours shows a date, enter it here.</p>
                  <Segmented label="What does your I-94 show?" value={scenario.admissionBasis} options={i94Options} onChange={(value) => update("admissionBasis", value)} />
                  {scenario.admissionBasis === "fixed_period" && (
                    <DateField label="What is the I-94 admit-until date?" value={scenario.i94AdmitUntilDate} onChange={(value) => update("i94AdmitUntilDate", value)} />
                  )}
                </article>
                <article>
                  <h3>Travel with a pending extension</h3>
                  <p>This matters if an I-539 is pending when the student leaves the U.S.</p>
                  <Segmented
                    label="Will an extension request be pending when you depart?"
                    value={scenario.pendingExtensionOnDeparture}
                    options={yesNoOptions}
                    onChange={(value) => update("pendingExtensionOnDeparture", value)}
                  />
                </article>
                <article>
                  <h3>EAD active on September 15</h3>
                  <p>If an approved EAD is already active on the rule date, its end date may affect the transition calculation.</p>
                  <DateField label="EAD end date on September 15, 2026" value={scenario.eadEndOnEffectiveDate} onChange={(value) => update("eadEndOnEffectiveDate", value)} />
                </article>
                <article>
                  <h3>Passport or unusual travel facts</h3>
                  <p>Passport expiration, automatic visa revalidation, and unusual travel facts belong in the travel branch before relying on a final plan.</p>
                  <SelectField
                    label="Travel type, if unusual"
                    value={scenario.travelPosture}
                    options={travelLabels}
                    onChange={(value) => update("travelPosture", value)}
                  />
                </article>
              </div>
            </details>

            <details className="example-loader">
              <summary>Load testing examples</summary>
              <div className="demo-row">
                {DEMO_SCENARIOS.map((demo) => (
                  <button key={demo.id} type="button" onClick={() => loadDemo(demo.id)}>
                    {demo.label}
                  </button>
                ))}
              </div>
            </details>
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
                    {intakeExtraction.followUpQuestions.map((question) => (
                      <p key={question}>{question}</p>
                    ))}
                    {intakeExtraction.cautions.map((caution) => (
                      <p key={caution}>{caution}</p>
                    ))}
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
          <div className={`outcome ${statusTone}`}>
            <p>{result.classification.replaceAll("_", " ")}</p>
            <h2>{result.headline}</h2>
            <span>{result.summary}</span>
          </div>

          <section className="band impact-surface">
            <div className="section-title">
              <Sparkles aria-hidden="true" />
              <h2>What this answer changes</h2>
            </div>
            <ImpactCards cards={impactCards} />
            <BranchTimeline scenario={scenario} result={result} travelResult={travelResult} />
          </section>

          <div className="metric-grid">
            <div>
              <span>Rule effective date</span>
              <strong>{formatDate(result.effectiveDate)}</strong>
            </div>
            <div>
              <span>Transition cap</span>
              <strong>{formatDate(result.transitionCapDate)}</strong>
            </div>
            <div>
              <span>Status/admission end</span>
              <strong>{formatDate(result.coverageEnd)}</strong>
            </div>
            <div>
              <span>Departure-period end</span>
              <strong>{formatDate(result.latestDepartureDate)}</strong>
            </div>
          </div>

          <section className="band">
            <div className="section-title">
              <AlertTriangle aria-hidden="true" />
              <h2>Findings</h2>
            </div>
            <div className="finding-list">
              {result.findings.map((item) => (
                <article key={item.id} className={`finding ${item.tone}`}>
                  {findingIcon(item.tone)}
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.detail}</p>
                    <small>{item.sourceIds.join(" · ")}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="band">
            <div className="section-title">
              <CalendarClock aria-hidden="true" />
              <h2>Timeline</h2>
            </div>
            <ol className="timeline">
              {result.timeline.map((item, index) => (
                <li key={`${item.date}-${index}`} className={item.tone}>
                  <time>{formatDate(item.date)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {(result.followUpQuestions.length > 0 || result.nextActions.length > 0) && (
            <section className="band split">
              <div>
                <h2>Follow-ups</h2>
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
                <h2>Next actions</h2>
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

          <section className="band">
            <div className="section-title">
              <Sparkles aria-hidden="true" />
              <h2>Plain-language explanation</h2>
            </div>
            <div className="button-row">
              <button type="button" onClick={explainWithAi} disabled={aiState === "loading"}>
                {aiState === "loading" ? <RefreshCw aria-hidden="true" className="spin" /> : <Send aria-hidden="true" />}
                Explain
              </button>
            </div>
            {aiState === "failed" && (
              <p className="muted">The explanation call failed. The calculator result above is still available.</p>
            )}
            {aiState === "fallback" && (
              <p className="muted">The model endpoint is not connected in this local preview, so this explanation comes from the calculator result.</p>
            )}
            {aiExplanation && <div className="ai-output">{aiExplanation}</div>}
          </section>

          <section className="band sources">
            <div className="section-title">
              <FileText aria-hidden="true" />
              <h2>Sources</h2>
            </div>
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
        </section>
      </main>
    </div>
  );
}

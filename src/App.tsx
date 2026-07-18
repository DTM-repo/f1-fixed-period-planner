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
  current_ds_inside_us: "Current D/S",
  prospective_outside_us: "Incoming",
  readmitted_fixed_period: "Readmitted",
  transfer_or_program_change: "Transfer/change",
  unknown: "Unknown"
};

const admissionBasisLabels: Record<AdmissionBasis, string> = {
  duration_of_status: "D/S",
  fixed_period: "Fixed period",
  unknown: "Unknown"
};

const optLabels: Record<OptStage, string> = {
  none: "None",
  pre_completion: "Pre-completion",
  post_completion_not_filed: "Post-OPT not filed",
  post_completion_pending: "Post-OPT pending",
  post_completion_approved: "Post-OPT approved",
  stem_not_filed: "STEM not filed",
  stem_pending: "STEM pending",
  stem_approved: "STEM approved"
};

const travelLabels: Record<TravelPosture, string> = {
  none: "No travel",
  planned: "Planned",
  completed: "Completed",
  automatic_visa_revalidation: "AVR",
  unknown: "Unknown"
};

const reentryLabels: Record<ReentryBasis, string> = {
  same_i20_balance: "Same I-20 balance",
  new_f1_admission: "New F-1 admission",
  longer_program_i20: "Longer I-20",
  automatic_visa_revalidation: "AVR",
  unknown: "Unknown"
};

const cptLabels: Record<CptPlan, string> = {
  none: "No CPT",
  before_admission_end: "Before end",
  after_admission_end: "After end",
  unknown: "Unknown"
};

const factFieldLabels: Record<IntakeFactField, string> = {
  startingPosition: "starting point",
  admissionBasis: "I-94 basis",
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

  function update<K extends keyof StudentScenario>(key: K, value: StudentScenario[K]) {
    setScenario((current) => ({ ...current, [key]: value }));
    if (key === "narrative") {
      setIntakeExtraction(null);
      setIntakeState("idle");
    }
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
              <h2>Scenario</h2>
            </div>

            <div className="demo-row">
              {DEMO_SCENARIOS.map((demo) => (
                <button key={demo.id} type="button" onClick={() => loadDemo(demo.id)}>
                  {demo.label}
                </button>
              ))}
            </div>

            <SelectField
              label="Starting position"
              value={scenario.startingPosition}
              options={startingPositionLabels}
              onChange={(value) => update("startingPosition", value)}
            />
            <SelectField
              label="I-94 admission basis"
              value={scenario.admissionBasis}
              options={admissionBasisLabels}
              onChange={(value) => update("admissionBasis", value)}
            />

            <Segmented
              label="In the U.S. on Sep 15, 2026"
              value={scenario.inUsOnEffectiveDate}
              options={yesNoOptions}
              onChange={(value) => update("inUsOnEffectiveDate", value)}
            />
            <Segmented
              label="Maintaining F-1 status on Sep 15, 2026"
              value={scenario.maintainingStatusOnEffectiveDate}
              options={yesNoOptions}
              onChange={(value) => update("maintainingStatusOnEffectiveDate", value)}
            />

            <DateField
              label="I-20 end on Sep 15, 2026"
              value={scenario.programEndOnEffectiveDate}
              onChange={(value) => update("programEndOnEffectiveDate", value)}
            />
            <DateField
              label="Longest program end to test"
              value={scenario.currentProgramEndDate}
              onChange={(value) => update("currentProgramEndDate", value)}
            />
            <DateField
              label="EAD end on Sep 15, 2026"
              value={scenario.eadEndOnEffectiveDate}
              onChange={(value) => update("eadEndOnEffectiveDate", value)}
            />

            <SelectField label="OPT posture" value={scenario.optStage} options={optLabels} onChange={(value) => update("optStage", value)} />
            <DateField label="I-765 filing date" value={scenario.optFilingDate} onChange={(value) => update("optFilingDate", value)} />

            <SelectField
              label="Travel after effective date"
              value={scenario.travelPosture}
              options={travelLabels}
              onChange={(value) => update("travelPosture", value)}
            />
            <DateField label="Return/admission date" value={scenario.reentryDate} onChange={(value) => update("reentryDate", value)} />
            <SelectField
              label="Return basis"
              value={scenario.reentryBasis}
              options={reentryLabels}
              onChange={(value) => update("reentryBasis", value)}
            />

            <Segmented
              label="Pending I-539 when departing"
              value={scenario.pendingExtensionOnDeparture}
              options={yesNoOptions}
              onChange={(value) => update("pendingExtensionOnDeparture", value)}
            />
            <Segmented
              label="Transfer or program change"
              value={scenario.transferOrProgramChange}
              options={yesNoOptions}
              onChange={(value) => update("transferOrProgramChange", value)}
            />
            <SelectField label="CPT timing" value={scenario.cptPlan} options={cptLabels} onChange={(value) => update("cptPlan", value)} />
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

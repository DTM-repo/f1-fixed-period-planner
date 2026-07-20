import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardCopy,
  ExternalLink,
  FileText,
  Info,
  Keyboard,
  Mic,
  Pencil,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  Sparkles,
  Square
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExplanationResponse } from "./ai/explanationPayload";
import type { AdvisorTurn, FollowUpResponse } from "./ai/followUpPayload";
import type { IntakeCandidateFact, IntakeExtractionResponse, IntakeFactField, IntakeTopic } from "./ai/intakePayload";
import { applicableCaseTopics, buildStudentCase, type CaseEvent } from "./case/studentCase";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import { calculateScenario, DEFAULT_EFFECTIVE_DATE, OPT_TRANSITION_I765_DEADLINE, scenarioForFixedReentry } from "./engine/calculateScenario";
import { addDays, addYears, compareDates, formatDate, isValidDateString } from "./engine/dateMath";
import type {
  AdmissionBasis,
  EducationLevel,
  Finding,
  NextProgramLevelPlan,
  OptStage,
  ProgramType,
  ReentryBasis,
  StartingPosition,
  StudentScenario,
  TimelineItem,
  TravelPosture,
  YesNoUnknown
} from "./engine/types";
import {
  buildImpactMap,
  type ImpactClaim,
  type ImpactMap
} from "./impact/impactMap";
import {
  canonicalTopics,
  topicImpactLine,
  topicForQuestion,
  topicMeta,
  type CanonicalTopic
} from "./flow/advisingFlow";
import { SOURCE_INDEX, sourceLinkLabel } from "./sources/sourceIndex";

type SpeechRecognitionResultItem = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; 0: SpeechRecognitionResultItem };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
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

type Experience = "welcome" | "story" | "interview";
type InterviewMode = "focused" | "full";
type Page = "planner" | "overview";
type IntakeState = "idle" | "loading" | "ready" | "failed";
type ReportState = "idle" | "loading" | "ready" | "failed";
type QuestionKind = "choice" | "date";

interface Choice {
  value: string;
  label: string;
  description?: string;
}

interface Question {
  id: string;
  eyebrow: string;
  prompt: string;
  help?: string;
  kind: QuestionKind;
  choices?: Choice[];
  value?: string;
  answerLabel?: string;
  allowUnknownDate?: boolean;
}

const yesNoUnknown: Choice[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "I do not know yet" }
];

const topicLabels: Record<IntakeTopic, string> = {
  stay_length: "How long you can stay",
  travel: "Travel",
  opt: "OPT",
  stem_opt: "STEM OPT",
  cpt: "CPT",
  extension: "Extending your stay",
  school_transfer: "School transfer",
  program_change: "Program change",
  later_program: "Another U.S. program",
  dependents: "F-2 family",
  early_end: "Finishing early or withdrawing",
  change_of_status: "Change to F-1 status",
  immigrant_intent: "Pending immigrant petition",
  school_filing_support: "School filing support"
};

const factLabels: Record<IntakeFactField, string> = {
  startingPosition: "How you will become F-1",
  admissionBasis: "What your I-94 says",
  i94AdmitUntilDate: "I-94 admit-until date",
  inUsOnEffectiveDate: "In the U.S. in valid F-1 status on September 15, 2026",
  maintainingStatusOnEffectiveDate: "Valid F-1 status on September 15, 2026",
  departBeforeEffectiveDate: "Leaving before September 15, 2026",
  programStartDate: "I-20 program start date",
  programEndOnEffectiveDate: "I-20 end date on September 15, 2026",
  currentProgramEndDate: "Current I-20 end date",
  eadEndOnEffectiveDate: "EAD end date on September 15, 2026",
  currentEadEndDate: "Current EAD end date",
  optIntent: "OPT or STEM OPT plan",
  optStage: "OPT or STEM OPT stage",
  optFilingDate: "I-765 filing date",
  optFiledBeforeDeparture: "I-765 received before travel",
  travelPosture: "Travel plan",
  reentryDate: "Entry or return date",
  reentryBasis: "Return documents",
  returnProgramStartDate: "Returning I-20 program start date",
  returnProgramEndDate: "Returning I-20 program end date",
  pendingExtensionOnDeparture: "Pending I-539 during travel",
  transferOrProgramChange: "School or program change",
  schoolTransferPlan: "School transfer plan",
  academicProgramChangePlan: "Program change plan",
  educationLevel: "Education level",
  programType: "Program type",
  firstAcademicYearCompleted: "First academic year completed",
  nextProgramLevelPlan: "Later program level",
  nextProgramStartDate: "Later program start date",
  nextProgramEndDate: "Later program end date",
  dsoRecommendedOpt: "DSO OPT recommendation",
  hasF2Dependents: "F-2 dependents",
  earlyEndSituation: "Early end or withdrawal",
  earlyEndDate: "Actual end date",
  returningAfterEffectiveDate: "Return after September 15, 2026",
  cptPlan: "CPT plan",
  pendingEmploymentImmigrantPetition: "Pending employment-based immigrant petition"
};

const dateFacts = new Set<IntakeFactField>([
  "i94AdmitUntilDate",
  "programStartDate",
  "programEndOnEffectiveDate",
  "currentProgramEndDate",
  "eadEndOnEffectiveDate",
  "currentEadEndDate",
  "optFilingDate",
  "reentryDate",
  "returnProgramStartDate",
  "returnProgramEndDate",
  "nextProgramStartDate",
  "nextProgramEndDate",
  "earlyEndDate"
]);

const allowedFactValues: Partial<Record<IntakeFactField, readonly string[]>> = {
  startingPosition: ["current_ds_inside_us", "prospective_outside_us", "change_status_inside_us", "readmitted_fixed_period", "transfer_or_program_change", "unknown"],
  admissionBasis: ["duration_of_status", "fixed_period", "unknown"],
  inUsOnEffectiveDate: ["yes", "no", "unknown"],
  maintainingStatusOnEffectiveDate: ["yes", "no", "unknown"],
  departBeforeEffectiveDate: ["yes", "no", "unknown"],
  optStage: ["none", "pre_completion", "post_completion_not_filed", "post_completion_pending", "post_completion_approved", "stem_not_filed", "stem_pending", "stem_approved"],
  optFiledBeforeDeparture: ["yes", "no", "unknown"],
  travelPosture: ["none", "planned", "completed", "automatic_visa_revalidation", "unknown"],
  reentryBasis: ["same_i20_balance", "new_f1_admission", "longer_program_i20", "automatic_visa_revalidation", "unknown"],
  pendingExtensionOnDeparture: ["yes", "no", "unknown"],
  transferOrProgramChange: ["yes", "no", "unknown"],
  schoolTransferPlan: ["yes", "no", "unknown"],
  academicProgramChangePlan: ["yes", "no", "unknown"],
  optIntent: ["yes", "no", "unknown"],
  educationLevel: ["undergraduate", "graduate", "other", "unknown"],
  programType: ["college_or_university", "english_language_training", "public_high_school", "private_high_school", "other", "unknown"],
  firstAcademicYearCompleted: ["yes", "no", "unknown"],
  nextProgramLevelPlan: ["higher", "same_or_lower", "not_planning", "unknown"],
  dsoRecommendedOpt: ["yes", "no", "unknown"],
  hasF2Dependents: ["yes", "no", "unknown"],
  earlyEndSituation: ["none", "completed_early", "authorized_withdrawal", "status_violation", "unknown"],
  returningAfterEffectiveDate: ["yes", "no", "unknown"],
  cptPlan: ["none", "planned", "unknown"],
  pendingEmploymentImmigrantPetition: ["yes", "no", "unknown"]
};

const factValueLabels: Partial<Record<IntakeFactField, Record<string, string>>> = {
  startingPosition: {
    current_ds_inside_us: "Current F-1 student in the U.S.",
    prospective_outside_us: "Enter the U.S. in F-1 status",
    change_status_inside_us: "Change to F-1 status inside the U.S.",
    readmitted_fixed_period: "Return to the U.S. in F-1 status",
    transfer_or_program_change: "School or program change",
    unknown: "Not yet known"
  },
  admissionBasis: { duration_of_status: "D/S", fixed_period: "A date", unknown: "Not yet known" },
  inUsOnEffectiveDate: { yes: "Yes", no: "No", unknown: "Not yet known" },
  maintainingStatusOnEffectiveDate: { yes: "Yes", no: "No", unknown: "Not yet known" },
  departBeforeEffectiveDate: { yes: "Yes", no: "No", unknown: "Not yet known" },
  educationLevel: { undergraduate: "Undergraduate", graduate: "Graduate", other: "Another level", unknown: "Not yet known" },
  programType: {
    college_or_university: "College or university",
    english_language_training: "English-language training",
    public_high_school: "Public high school",
    private_high_school: "Private high school",
    other: "Another F-1 program",
    unknown: "Not yet known"
  },
  travelPosture: { none: "No travel planned", planned: "Travel planned", completed: "Already returned", automatic_visa_revalidation: "Automatic visa revalidation", unknown: "Not yet known" },
  firstAcademicYearCompleted: { yes: "Yes", no: "No", unknown: "Not yet known" },
  nextProgramLevelPlan: { higher: "Higher level", same_or_lower: "Same or lower level", not_planning: "No later program planned", unknown: "Not yet known" },
  dsoRecommendedOpt: { yes: "Yes", no: "No", unknown: "Not yet known" },
  optFiledBeforeDeparture: { yes: "Yes", no: "No", unknown: "Not yet known" },
  hasF2Dependents: { yes: "Yes", no: "No", unknown: "Not yet known" },
  earlyEndSituation: { none: "No", completed_early: "Completed early", authorized_withdrawal: "Authorized withdrawal", status_violation: "Possible status violation", unknown: "Not yet known" },
  cptPlan: { none: "No CPT planned", planned: "Plans to use CPT", unknown: "Not yet known" },
  pendingEmploymentImmigrantPetition: { yes: "Yes", no: "No", unknown: "Not yet known" }
};

function supportedFact(fact: IntakeCandidateFact): boolean {
  if (dateFacts.has(fact.field)) return isValidDateString(fact.value);
  return allowedFactValues[fact.field]?.includes(fact.value) ?? false;
}

function usableFacts(facts: IntakeCandidateFact[]): IntakeCandidateFact[] {
  return facts.filter((fact) => fact.confidence !== "low" && fact.value !== "unknown" && supportedFact(fact));
}

function displayFactValue(fact: IntakeCandidateFact): string {
  if (dateFacts.has(fact.field) && isValidDateString(fact.value)) return formatDate(fact.value);
  const partialDate = formatPartialDate(fact.value);
  if (dateFacts.has(fact.field) && partialDate) return partialDate;
  if (fact.value === "yes") return "Yes";
  if (fact.value === "no") return "No";
  if (fact.value === "unknown") return "Not yet known";
  return factValueLabels[fact.field]?.[fact.value] ?? fact.value.replaceAll("_", " ");
}

const MONTH_LABELS = [
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

function formatPartialDate(value?: string): string | undefined {
  if (!value) return undefined;
  const monthYear = value.match(/^(\d{4})-(\d{2})$/);
  if (monthYear) {
    const month = Number(monthYear[2]);
    if (month >= 1 && month <= 12) return `${MONTH_LABELS[month - 1]} ${monthYear[1]}`;
  }
  if (/^\d{4}$/.test(value)) return value;
  return undefined;
}

function dateIsDefinitelyBefore(value: string | undefined, comparison: string): boolean {
  if (!value) return false;
  if (isValidDateString(value)) return compareDates(value, comparison) < 0;
  const monthYear = value.match(/^(\d{4})-(\d{2})$/);
  if (monthYear) {
    return `${monthYear[1]}-${monthYear[2]}` < comparison.slice(0, 7);
  }
  return /^\d{4}$/.test(value) && value < comparison.slice(0, 4);
}

function dateIsDefinitelyOnOrAfter(value: string | undefined, comparison: string): boolean {
  if (!value) return false;
  if (isValidDateString(value)) return compareDates(value, comparison) >= 0;
  const monthYear = value.match(/^(\d{4})-(\d{2})$/);
  if (monthYear) return `${monthYear[1]}-${monthYear[2]}` > comparison.slice(0, 7);
  return /^\d{4}$/.test(value) && value > comparison.slice(0, 4);
}

function dateIsDefinitelyAfter(value: string | undefined, comparison: string): boolean {
  if (!value) return false;
  if (isValidDateString(value)) return compareDates(value, comparison) > 0;
  const monthYear = value.match(/^(\d{4})-(\d{2})$/);
  if (monthYear) return `${monthYear[1]}-${monthYear[2]}` > comparison.slice(0, 7);
  return /^\d{4}$/.test(value) && value > comparison.slice(0, 4);
}

function programEndHint(facts: IntakeCandidateFact[]): IntakeCandidateFact | undefined {
  return facts.find((fact) =>
    ["programEndOnEffectiveDate", "currentProgramEndDate"].includes(fact.field) &&
    (isValidDateString(fact.value) || Boolean(formatPartialDate(fact.value)))
  );
}

function coverageDateLabel(scenario: StudentScenario, facts: IntakeCandidateFact[]): string | undefined {
  const value = scenario.programEndOnEffectiveDate ?? scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint ?? programEndHint(facts)?.value;
  return isValidDateString(value) ? formatDate(value) : formatPartialDate(value);
}

function programEndPrecedesEffectiveDate(
  scenario: StudentScenario,
  facts: IntakeCandidateFact[] = []
): boolean {
  const programEnd = scenario.programEndOnEffectiveDate ?? scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint ?? programEndHint(facts)?.value;
  return dateIsDefinitelyBefore(programEnd, DEFAULT_EFFECTIVE_DATE);
}

export function hasEffectiveDateCoverageConflict(
  scenario: StudentScenario,
  facts: IntakeCandidateFact[] = []
): boolean {
  if (!isCurrent(scenario) || scenario.inUsOnEffectiveDate !== "yes") return false;
  if (!programEndPrecedesEffectiveDate(scenario, facts)) return false;
  const approvedEadEnd = scenario.optStage.endsWith("approved")
    ? scenario.eadEndOnEffectiveDate ?? scenario.currentEadEndDate ?? scenario.currentEadEndDateHint
    : undefined;
  return !dateIsDefinitelyOnOrAfter(approvedEadEnd, DEFAULT_EFFECTIVE_DATE);
}

export function mergeFacts(current: StudentScenario, facts: IntakeCandidateFact[], lockPresence = false): StudentScenario {
  let next = { ...current } as StudentScenario;
  for (const fact of facts) {
    if (fact.confidence === "low" || !formatPartialDate(fact.value)) continue;
    if (fact.field === "currentProgramEndDate" || fact.field === "programEndOnEffectiveDate") {
      next.currentProgramEndDateHint = fact.value;
    }
    if (fact.field === "currentEadEndDate" || fact.field === "eadEndOnEffectiveDate") {
      next.currentEadEndDateHint = fact.value;
    }
  }
  for (const fact of usableFacts(facts)) {
    if (lockPresence && ["inUsOnEffectiveDate", "maintainingStatusOnEffectiveDate", "admissionBasis"].includes(fact.field)) continue;
    if (
      lockPresence &&
      fact.field === "startingPosition" &&
      (current.inUsOnEffectiveDate === "yes" || !["prospective_outside_us", "change_status_inside_us"].includes(fact.value))
    ) continue;
    next = { ...next, [fact.field]: fact.value } as StudentScenario;
    if (fact.field === "optStage" && fact.value !== "none") next.optIntent = "yes";
    if (fact.field === "currentProgramEndDate" || fact.field === "programEndOnEffectiveDate") {
      next.currentProgramEndDateHint = undefined;
    }
    if (fact.field === "currentEadEndDate" || fact.field === "eadEndOnEffectiveDate") {
      next.currentEadEndDateHint = undefined;
    }
  }
  if (lockPresence && current.inUsOnEffectiveDate === "yes") {
    next.inUsOnEffectiveDate = "yes";
    next.startingPosition = "current_ds_inside_us";
    next.maintainingStatusOnEffectiveDate = "yes";
    next.admissionBasis = "duration_of_status";
  }
  if (lockPresence && current.inUsOnEffectiveDate === "no") {
    next.inUsOnEffectiveDate = "no";
    next.maintainingStatusOnEffectiveDate = "unknown";
    next.admissionBasis = "fixed_period";
    if (!["prospective_outside_us", "change_status_inside_us"].includes(next.startingPosition)) {
      next.startingPosition = "prospective_outside_us";
    }
  }
  if (next.inUsOnEffectiveDate === "yes") {
    next.startingPosition = "current_ds_inside_us";
    next.maintainingStatusOnEffectiveDate = "yes";
    if (next.admissionBasis === "unknown") next.admissionBasis = "duration_of_status";
    next.programEndOnEffectiveDate ??= next.currentProgramEndDate;
    next.currentProgramEndDate ??= next.programEndOnEffectiveDate;
  }
  if (next.inUsOnEffectiveDate === "no" && next.startingPosition === "unknown") {
    next.startingPosition = "prospective_outside_us";
    next.admissionBasis = "fixed_period";
  }
  if (next.currentProgramEndDate && next.startingPosition === "current_ds_inside_us") {
    next.programEndOnEffectiveDate ??= next.currentProgramEndDate;
  }
  if (
    ["undergraduate", "graduate"].includes(next.educationLevel ?? "unknown") &&
    (!next.programType || next.programType === "unknown")
  ) {
    next.programType = "college_or_university";
  }
  if (next.optStage.endsWith("approved") && next.currentEadEndDate) {
    next.eadEndOnEffectiveDate ??= next.currentEadEndDate;
  }
  return { ...next, narrative: current.narrative };
}

function isCurrent(scenario: StudentScenario): boolean {
  return scenario.startingPosition === "current_ds_inside_us";
}

function isFuture(scenario: StudentScenario): boolean {
  return scenario.startingPosition === "prospective_outside_us" || scenario.startingPosition === "change_status_inside_us";
}

const optStageLabels: Record<OptStage, string> = {
  none: "Planning OPT after graduation",
  pre_completion: "Pre-completion OPT",
  post_completion_not_filed: "Post-completion OPT not filed",
  post_completion_pending: "Post-completion OPT pending",
  post_completion_approved: "Post-completion OPT approved",
  stem_not_filed: "Preparing a STEM OPT extension",
  stem_pending: "STEM OPT extension pending",
  stem_approved: "STEM OPT extension approved"
};

function shouldAskOptApplicationQuestions(scenario: StudentScenario): boolean {
  if (!isCurrent(scenario)) return false;
  if (
    scenario.optFilingDate ||
    scenario.currentEadEndDate ||
    scenario.dsoRecommendedOpt === "yes" ||
    scenario.optStage.endsWith("pending") ||
    scenario.optStage.endsWith("approved") ||
    scenario.optStage.startsWith("stem")
  ) {
    return true;
  }
  const programEnd = scenario.programEndOnEffectiveDate ?? scenario.currentProgramEndDate;
  if (!programEnd) return false;
  const today = new Date().toISOString().slice(0, 10);
  const normalFilingWindowOpens = addDays(programEnd, -90);
  return compareDates(normalFilingWindowOpens, today) <= 0;
}

function appendTravelQuestions(
  scenario: StudentScenario,
  answered: Set<string>,
  questions: Question[],
  raisedByStudent: boolean,
  connectedToOpt: boolean
): boolean {
  questions.push({
    id: "travelIntent",
    eyebrow: connectedToOpt ? "Your travel and OPT question" : raisedByStudent ? "Your travel plans" : "Travel",
    prompt: "Are you planning to travel outside the United States?",
    help: connectedToOpt
      ? "A return after September 15 can change both your I-94 and whether your OPT period needs Form I-539."
      : "A return after September 15, 2026 moves you from the old rules to a dated I-94.",
    kind: "choice",
    choices: [{ value: "planned", label: "Yes" }, { value: "none", label: "No" }, { value: "unknown", label: "I do not know yet" }],
    value: scenario.travelPosture,
    answerLabel: factValueLabels.travelPosture?.[scenario.travelPosture]
  });
  if (!answered.has("travelIntent")) return false;

  if (scenario.travelPosture === "planned" || scenario.travelPosture === "completed") {
    questions.push({
      id: "returnAfterRule",
      eyebrow: "The date that changes the rule",
      prompt: "Will any trip bring you back to the United States after September 15, 2026?",
      help: "Any return after September 15 moves that return into the new fixed-period system, even if you also return from an earlier trip before that date.",
      kind: "choice",
      choices: yesNoUnknown,
      value: scenario.returningAfterEffectiveDate,
      answerLabel: scenario.returningAfterEffectiveDate === "yes"
        ? "At least one return after September 15"
        : scenario.returningAfterEffectiveDate === "no"
          ? "No return after September 15"
          : "Not yet known"
    });
    if (!answered.has("returnAfterRule")) return false;
    if (scenario.returningAfterEffectiveDate === "yes") {
      questions.push({
        id: "returnDate",
        eyebrow: "Return date",
        prompt: "When do you expect to return from that trip?",
        help: "CBP issues the controlling I-94 when you return.",
        kind: "date",
        value: scenario.reentryDate,
        answerLabel: scenario.reentryDate ? formatDate(scenario.reentryDate) : "I do not know yet",
        allowUnknownDate: true
      });
      if (!answered.has("returnDate")) return false;
      questions.push({
        id: "travelI20",
        eyebrow: "The I-20 you will use to return",
        prompt: "Will you return using the same I-20 for the same program?",
        help: "A new or updated I-20 can produce a different I-94 end date.",
        kind: "choice",
        choices: [
          { value: "same_i20_balance", label: "Yes, the same I-20" },
          { value: "longer_program_i20", label: "No, a new or updated I-20" },
          { value: "unknown", label: "I do not know yet" }
        ],
        value: scenario.reentryBasis,
        answerLabel: scenario.reentryBasis === "same_i20_balance"
          ? "Same I-20"
          : scenario.reentryBasis === "longer_program_i20"
            ? "New or updated I-20"
            : "Not yet known"
      });
      if (!answered.has("travelI20")) return false;

      if (scenario.reentryBasis === "same_i20_balance") {
        questions.push({
          id: "travelProgramStart",
          eyebrow: "One different date on the same I-20",
          prompt: "What program start date is printed on that I-20?",
          help: "The new four-year maximum is measured from the I-20 program start date, not from the day you return.",
          kind: "date",
          value: scenario.programStartDate,
          answerLabel: scenario.programStartDate ? formatDate(scenario.programStartDate) : "I do not know yet",
          allowUnknownDate: true
        });
        if (!answered.has("travelProgramStart")) return false;
      }

      if (scenario.reentryBasis === "longer_program_i20") {
        questions.push({
          id: "travelProgramStart",
          eyebrow: "Your new or updated I-20",
          prompt: "What program start date is printed on the I-20 you will use to return?",
          help: "The four-year maximum is measured from this date, not from the day you return.",
          kind: "date",
          value: scenario.returnProgramStartDate,
          answerLabel: scenario.returnProgramStartDate ? formatDate(scenario.returnProgramStartDate) : "I do not know yet",
          allowUnknownDate: true
        });
        if (!answered.has("travelProgramStart")) return false;
        questions.push({
          id: "travelProgramEnd",
          eyebrow: "Your new or updated I-20",
          prompt: "What program end date is printed on that I-20?",
          help: "This I-20 end date controls the new admission period instead of the earlier program end date.",
          kind: "date",
          value: scenario.returnProgramEndDate,
          answerLabel: scenario.returnProgramEndDate ? formatDate(scenario.returnProgramEndDate) : "I do not know yet",
          allowUnknownDate: true
        });
        if (!answered.has("travelProgramEnd")) return false;
      }
    }
  }
  return true;
}

export function buildCoreQuestions(
  scenario: StudentScenario,
  answered: Set<string>,
  intakeFacts: IntakeCandidateFact[] = []
): Question[] {
  const questions: Question[] = [
    {
      id: "presence",
      eyebrow: "First, one date",
      prompt: "Will you be in the United States in valid F-1 status on September 15, 2026?",
      help: "You keep the old rules only if you are in the United States in valid F-1 status on that date.",
      kind: "choice",
      choices: yesNoUnknown,
      value: scenario.inUsOnEffectiveDate,
      answerLabel: scenario.inUsOnEffectiveDate === "yes"
        ? "In the U.S. in valid F-1 status"
        : scenario.inUsOnEffectiveDate === "no"
          ? "Not in the U.S. in valid F-1 status"
          : "Not yet known"
    }
  ];
  if (!answered.has("presence")) return questions;

  if (scenario.inUsOnEffectiveDate === "no") {
    questions.push({
      id: "futureMethod",
      eyebrow: "How you will become F-1",
      prompt: "After September 15, how do you expect to get F-1 status?",
      kind: "choice",
      choices: [
        { value: "prospective_outside_us", label: "Enter the U.S. in F-1 status" },
        { value: "change_status_inside_us", label: "Change status inside the U.S." },
        { value: "unknown", label: "I do not know yet" }
      ],
      value: scenario.startingPosition,
      answerLabel: factValueLabels.startingPosition?.[scenario.startingPosition]
    });
    if (!answered.has("futureMethod")) return questions;
    if (scenario.startingPosition === "prospective_outside_us") {
      questions.push({
        id: "entryDate",
        eyebrow: "Your F-1 entry",
        prompt: scenario.departBeforeEffectiveDate === "yes"
          ? "When will you next enter the United States in F-1 status after September 15, 2026?"
          : "When do you expect to enter the United States in F-1 status?",
        help: "Use the month name, day, and year so the date cannot be read in the wrong order.",
        kind: "date",
        value: scenario.reentryDate,
        answerLabel: scenario.reentryDate ? formatDate(scenario.reentryDate) : "I do not know yet",
        allowUnknownDate: true
      });
      if (!answered.has("entryDate")) return questions;
      if (scenario.reentryDate && isValidDateString(scenario.reentryDate) && compareDates(scenario.reentryDate, DEFAULT_EFFECTIVE_DATE) <= 0) {
        questions.push({
          id: "departBeforeRule",
          eyebrow: "These dates need clarification",
          prompt: "Will you leave the United States before September 15, 2026?",
          help: "An F-1 entry before September 15 would place you in the United States that day unless you leave again first.",
          kind: "choice",
          choices: yesNoUnknown,
          value: scenario.departBeforeEffectiveDate,
          answerLabel: factValueLabels.departBeforeEffectiveDate?.[scenario.departBeforeEffectiveDate ?? "unknown"]
        });
        if (!answered.has("departBeforeRule")) return questions;
      }
    }
  }

  if (isFuture(scenario)) {
    questions.push({
      id: "educationLevel",
      eyebrow: "Your program",
      prompt: "What level will you study?",
      kind: "choice",
      choices: [
        { value: "undergraduate", label: "Undergraduate" },
        { value: "graduate", label: "Graduate" },
        { value: "other", label: "Another level" },
        { value: "unknown", label: "I do not know yet" }
      ],
      value: scenario.educationLevel,
      answerLabel: factValueLabels.educationLevel?.[scenario.educationLevel ?? "unknown"]
    });
    if (!answered.has("educationLevel")) return questions;

    questions.push({
      id: "programType",
      eyebrow: "Program type",
      prompt: "What kind of F-1 program will this be?",
      kind: "choice",
      choices: [
        { value: "college_or_university", label: "College or university" },
        { value: "english_language_training", label: "English-language training" },
        { value: "public_high_school", label: "Public high school" },
        { value: "private_high_school", label: "Private high school" },
        { value: "other", label: "Another F-1 program" },
        { value: "unknown", label: "I do not know yet" }
      ],
      value: scenario.programType,
      answerLabel: factValueLabels.programType?.[scenario.programType ?? "unknown"]
    });
    if (!answered.has("programType")) return questions;

    questions.push({ id: "programStart", eyebrow: "I-20 program start", prompt: "What program start date will be on your I-20?", kind: "date", value: scenario.programStartDate, answerLabel: scenario.programStartDate ? formatDate(scenario.programStartDate) : "I do not know yet", allowUnknownDate: true });
    if (!answered.has("programStart")) return questions;
  }

  const programEndBeforeRule = isCurrent(scenario) && programEndPrecedesEffectiveDate(scenario, intakeFacts);
  const coverageConflict = hasEffectiveDateCoverageConflict(scenario, intakeFacts);
  const statedCoverageDate = coverageDateLabel(scenario, intakeFacts);
  const currentApprovedOpt = isCurrent(scenario) && scenario.optStage.endsWith("approved");
  if (coverageConflict && !scenario.optStage.endsWith("approved")) {
    questions.push({
      id: "effectiveDateCoverage",
      eyebrow: "These dates do not fit yet",
      prompt: "What will keep your F-1 status active on September 15, 2026?",
      help: statedCoverageDate
        ? `You entered ${statedCoverageDate} as your program end. That I-20 does not by itself cover September 15.`
        : "An I-20 ending before September 15 does not by itself cover that day.",
      kind: "choice",
      choices: [
        { value: "correct_i20", label: "My I-20 end date should be later" },
        { value: "post_completion_approved", label: "Approved regular OPT will cover that day" },
        { value: "stem_approved", label: "Approved STEM OPT will cover that day" },
        { value: "correct_presence", label: "I need to change my September 15 answer" }
      ]
    });
    if (!answered.has("effectiveDateCoverage")) return questions;
  }

  if (currentApprovedOpt) {
    const eadEnd = scenario.eadEndOnEffectiveDate ?? scenario.currentEadEndDate;
    const eadHint = scenario.currentEadEndDateHint;
    const eadIsTooEarly = Boolean(eadEnd && isValidDateString(eadEnd) && compareDates(eadEnd, DEFAULT_EFFECTIVE_DATE) < 0);
    questions.push({
      id: "effectiveEadEnd",
      eyebrow: "Your status on September 15",
      prompt: `What expiration date ${scenario.optStage === "stem_approved" ? "will be" : "is"} on your approved ${scenario.optStage === "stem_approved" ? "STEM OPT" : "regular OPT"} EAD?`,
      help: eadIsTooEarly
        ? "That EAD also ends before September 15. Enter the approved EAD date that will cover that day, or change an earlier answer."
        : eadHint
          ? `You said ${formatPartialDate(eadHint)}. Enter the day printed on the EAD so your exact dates can be calculated.`
          : "The approved EAD must cover September 15 for your F-1 status to remain active after your program ends.",
      kind: "date",
      value: eadEnd,
      answerLabel: eadEnd && isValidDateString(eadEnd) ? formatDate(eadEnd) : undefined
    });
    if (!answered.has("effectiveEadEnd")) return questions;
  }

  if (!currentApprovedOpt) {
    const exactProgramEnd = isCurrent(scenario) ? scenario.programEndOnEffectiveDate : scenario.currentProgramEndDate;
    const programEndHint = scenario.currentProgramEndDateHint;
    questions.push({
      id: "programEnd",
      eyebrow: "I-20 program end",
      prompt: isCurrent(scenario)
        ? "What program end date do you expect to have on your I-20 on September 15, 2026?"
        : "What program end date will be on your I-20?",
      help: !exactProgramEnd && programEndHint
        ? `You said ${formatPartialDate(programEndHint)}. Enter the day printed on your I-20.`
        : undefined,
      kind: "date",
      value: exactProgramEnd ?? programEndHint,
      answerLabel: exactProgramEnd
        ? formatDate(exactProgramEnd)
        : programEndHint
          ? formatPartialDate(programEndHint)
          : "I do not know yet",
      allowUnknownDate: true
    });
    if (!answered.has("programEnd")) return questions;
  }

  if (isCurrent(scenario)) {
    questions.push({
      id: "educationLevel",
      eyebrow: "Your program",
      prompt: "What level are you studying?",
      kind: "choice",
      choices: [
        { value: "undergraduate", label: "Undergraduate" },
        { value: "graduate", label: "Graduate" },
        { value: "other", label: "Another level" },
        { value: "unknown", label: "I do not know yet" }
      ],
      value: scenario.educationLevel,
      answerLabel: factValueLabels.educationLevel?.[scenario.educationLevel ?? "unknown"]
    });
    if (!answered.has("educationLevel")) return questions;

    questions.push({
      id: "programType",
      eyebrow: "Program type",
      prompt: "What kind of F-1 program is this?",
      kind: "choice",
      choices: [
        { value: "college_or_university", label: "College or university" },
        { value: "english_language_training", label: "English-language training" },
        { value: "public_high_school", label: "Public high school" },
        { value: "private_high_school", label: "Private high school" },
        { value: "other", label: "Another F-1 program" },
        { value: "unknown", label: "I do not know yet" }
      ],
      value: scenario.programType,
      answerLabel: factValueLabels.programType?.[scenario.programType ?? "unknown"]
    });
    if (!answered.has("programType")) return questions;
  }

  return questions;
}

export function buildQuestions(
  scenario: StudentScenario,
  answered: Set<string>,
  selectedTopics: IntakeTopic[],
  protectedStudyEnd?: string
): Question[] {
  const questions = buildCoreQuestions(scenario, answered);
  const coreIncomplete = questions.some((question) => !answered.has(question.id));
  if (coreIncomplete) return questions;

  const wantsOpt = selectedTopics.includes("opt") || selectedTopics.includes("stem_opt");
  const optTravelOrderStillOpen = ["none", "post_completion_not_filed", "stem_not_filed"].includes(scenario.optStage);
  const wantsTravel = selectedTopics.includes("travel") || (isCurrent(scenario) && wantsOpt && optTravelOrderStillOpen);

  if (isCurrent(scenario) && wantsTravel && !appendTravelQuestions(scenario, answered, questions, selectedTopics.includes("travel"), wantsOpt)) {
    return questions;
  }

  if (wantsOpt) {
    questions.push({
      id: "optIntent",
      eyebrow: "Work after your program",
      prompt: "Are you planning to apply for post-completion OPT after this program?",
      help: "Regular post-completion OPT comes first. STEM OPT is a possible extension later if your degree and job qualify.",
      kind: "choice",
      choices: yesNoUnknown,
      value: scenario.optIntent,
      answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.optIntent ?? "unknown"]
    });
    if (!answered.has("optIntent")) return questions;

    if (scenario.optIntent === "yes" && scenario.optStage !== "pre_completion" && shouldAskOptApplicationQuestions(scenario)) {
      questions.push({
        id: "optStatus",
        eyebrow: "Your OPT timing",
        prompt: "Where are you in the regular OPT process now?",
        help: "Choose STEM OPT only if you are already in regular post-completion OPT.",
        kind: "choice",
        choices: [
          { value: "post_completion_not_filed", label: "I have not filed for regular OPT" },
          { value: "post_completion_pending", label: "My regular OPT application is pending" },
          { value: "post_completion_approved", label: "My regular OPT is approved" },
          { value: "stem_not_filed", label: "I am on OPT and preparing a STEM extension" },
          { value: "stem_pending", label: "My STEM OPT extension is pending" },
          { value: "stem_approved", label: "My STEM OPT extension is approved" }
        ],
        value: scenario.optStage,
        answerLabel: optStageLabels[scenario.optStage]
      });
      if (!answered.has("optStatus")) return questions;
      if (scenario.optStage.endsWith("not_filed")) {
        questions.push({ id: "dsoRecommendation", eyebrow: "Before Form I-765", prompt: "Has your DSO recommended this OPT in SEVIS?", help: "Your international student advisor completes this step before you file Form I-765.", kind: "choice", choices: yesNoUnknown, value: scenario.dsoRecommendedOpt, answerLabel: factValueLabels.dsoRecommendedOpt?.[scenario.dsoRecommendedOpt ?? "unknown"] });
        if (!answered.has("dsoRecommendation")) return questions;
      }
      if (scenario.optStage.endsWith("not_filed") || scenario.optStage.endsWith("pending")) {
        questions.push({ id: "optFilingDate", eyebrow: "Form I-765", prompt: "When did you file, or when do you plan to file?", help: isCurrent(scenario) ? "The one-time OPT option requires USCIS to receive Form I-765 by March 18, 2027 while the old rules still cover you." : undefined, kind: "date", value: scenario.optFilingDate, answerLabel: scenario.optFilingDate ? formatDate(scenario.optFilingDate) : "I do not know yet", allowUnknownDate: true });
        if (!answered.has("optFilingDate")) return questions;
      }
      if (scenario.optStage.endsWith("approved")) {
        questions.push({ id: "eadEndDate", eyebrow: "Your EAD", prompt: "What expiration date is on your EAD?", kind: "date", value: scenario.currentEadEndDate, answerLabel: scenario.currentEadEndDate ? formatDate(scenario.currentEadEndDate) : "I do not know yet", allowUnknownDate: true });
        if (!answered.has("eadEndDate")) return questions;
      }
    }

    const programEnd = scenario.programEndOnEffectiveDate ?? scenario.currentProgramEndDate;
    const normalOptWindowOpens = programEnd ? addDays(programEnd, -90) : undefined;
    const tripCanAffectTransitionOpt = Boolean(
      isCurrent(scenario) &&
      scenario.optIntent === "yes" &&
      ["planned", "completed"].includes(scenario.travelPosture) &&
      scenario.returningAfterEffectiveDate === "yes" &&
      normalOptWindowOpens &&
      compareDates(normalOptWindowOpens, OPT_TRANSITION_I765_DEADLINE) <= 0
    );
    const filingAlreadyPrecedesPlannedTravel = scenario.travelPosture === "planned" && (
      scenario.optStage.endsWith("pending") ||
      scenario.optStage.endsWith("approved")
    );
    if (tripCanAffectTransitionOpt && !filingAlreadyPrecedesPlannedTravel) {
      questions.push({
        id: "optBeforeTravel",
        eyebrow: "OPT and travel order",
        prompt: scenario.travelPosture === "completed"
          ? "Did you submit your Form I-765 before you left the United States?"
          : "Will you submit your Form I-765 before you leave the United States?",
        help: "For the one-time OPT option, submit Form I-765 before your trip and no later than March 18, 2027.",
        kind: "choice",
        choices: yesNoUnknown,
        value: scenario.optFiledBeforeDeparture,
        answerLabel: factValueLabels.optFiledBeforeDeparture?.[scenario.optFiledBeforeDeparture ?? "unknown"]
      });
      if (!answered.has("optBeforeTravel")) return questions;
    }
  }

  if (selectedTopics.includes("school_transfer")) {
    questions.push({ id: "schoolTransfer", eyebrow: "School transfer", prompt: "Are you planning to transfer to a different school?", kind: "choice", choices: yesNoUnknown, value: scenario.schoolTransferPlan, answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.schoolTransferPlan ?? "unknown"] });
    if (!answered.has("schoolTransfer")) return questions;
  }

  if (selectedTopics.includes("program_change")) {
    questions.push({ id: "programChange", eyebrow: "Program change", prompt: "Are you planning to change your major or education level during this program?", kind: "choice", choices: yesNoUnknown, value: scenario.academicProgramChangePlan, answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.academicProgramChangePlan ?? "unknown"] });
    if (!answered.has("programChange")) return questions;
  }

  if (
    scenario.educationLevel === "undergraduate" &&
    (scenario.schoolTransferPlan === "yes" || scenario.academicProgramChangePlan === "yes") &&
    (selectedTopics.includes("school_transfer") || selectedTopics.includes("program_change"))
  ) {
    questions.push({ id: "firstAcademicYear", eyebrow: "Timing", prompt: "Will you finish your first academic year before that change?", help: "The new restriction applies during the first academic year.", kind: "choice", choices: yesNoUnknown, value: scenario.firstAcademicYearCompleted, answerLabel: factValueLabels.firstAcademicYearCompleted?.[scenario.firstAcademicYearCompleted ?? "unknown"] });
    if (!answered.has("firstAcademicYear")) return questions;
  }

  if (selectedTopics.includes("later_program")) {
    questions.push({
      id: "nextProgram",
      eyebrow: "A later program",
      prompt: "After this program, are you considering another U.S. program at the same education level or a lower level?",
      kind: "choice",
      choices: [{ value: "same_or_lower", label: "Yes" }, { value: "not_planning", label: "No" }, { value: "higher", label: "Only a higher level" }, { value: "unknown", label: "I do not know yet" }],
      value: scenario.nextProgramLevelPlan,
      answerLabel: factValueLabels.nextProgramLevelPlan?.[scenario.nextProgramLevelPlan ?? "unknown"]
    });
    if (!answered.has("nextProgram")) return questions;
    const priorProgramClearlyTriggersBar = scenario.nextProgramLevelPlan === "same_or_lower" &&
      dateIsDefinitelyAfter(scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint, DEFAULT_EFFECTIVE_DATE);
    if (!["not_planning", "unknown"].includes(scenario.nextProgramLevelPlan ?? "unknown") && !priorProgramClearlyTriggersBar) {
      questions.push({
        id: "nextProgramStart",
        eyebrow: "Your next program",
        prompt: "When would your next program start?",
        help: "This shows whether your current F-1 stay reaches the new program.",
        kind: "date",
        value: scenario.nextProgramStartDate,
        answerLabel: scenario.nextProgramStartDate ? formatDate(scenario.nextProgramStartDate) : "I do not know yet",
        allowUnknownDate: true
      });
      if (!answered.has("nextProgramStart")) return questions;
      questions.push({
        id: "nextProgramEnd",
        eyebrow: "Your next I-20",
        prompt: "What program end date would be on that I-20?",
        help: "This date shows how much additional F-1 time the program needs.",
        kind: "date",
        value: scenario.nextProgramEndDate,
        answerLabel: scenario.nextProgramEndDate ? formatDate(scenario.nextProgramEndDate) : "I do not know yet",
        allowUnknownDate: true
      });
      if (!answered.has("nextProgramEnd")) return questions;
    }
  }

  if (selectedTopics.includes("cpt")) {
    const admissionEndsBeforeProgram = Boolean(
      protectedStudyEnd && scenario.currentProgramEndDate && compareDates(protectedStudyEnd, scenario.currentProgramEndDate) < 0
    );
    questions.push({
      id: "cptIntent",
      eyebrow: "Work during your program",
      prompt: "Are you planning to use CPT during this program?",
      help: admissionEndsBeforeProgram && protectedStudyEnd
        ? `Your current study period ends ${formatDate(protectedStudyEnd)} before your I-20 program ends. Filing early can protect already-authorized CPT while an extension is pending.`
        : "This rule does not eliminate Day 1 CPT. Existing CPT eligibility rules still apply.",
      kind: "choice",
      choices: yesNoUnknown,
      value: scenario.cptPlan === "planned" ? "yes" : scenario.cptPlan === "unknown" ? "unknown" : "no",
      answerLabel: factValueLabels.cptPlan?.[scenario.cptPlan]
    });
    if (!answered.has("cptIntent")) return questions;
  }

  if (selectedTopics.includes("dependents")) {
    questions.push({ id: "f2Dependents", eyebrow: "Your family", prompt: "Do you have an F-2 spouse or child in the United States with you?", kind: "choice", choices: yesNoUnknown, value: scenario.hasF2Dependents, answerLabel: factValueLabels.hasF2Dependents?.[scenario.hasF2Dependents ?? "unknown"] });
    if (!answered.has("f2Dependents")) return questions;
  }

  if (selectedTopics.includes("early_end")) {
    questions.push({
      id: "earlyEnd",
      eyebrow: "Ending before the I-20 date",
      prompt: "Will you finish early, withdraw with permission, or stop maintaining F-1 status?",
      kind: "choice",
      choices: [
        { value: "none", label: "None of these" },
        { value: "completed_early", label: "Finish early" },
        { value: "authorized_withdrawal", label: "Withdraw with school approval" },
        { value: "status_violation", label: "I may have stopped maintaining status" },
        { value: "unknown", label: "I am not sure" }
      ],
      value: scenario.earlyEndSituation,
      answerLabel: factValueLabels.earlyEndSituation?.[scenario.earlyEndSituation ?? "unknown"]
    });
    if (!answered.has("earlyEnd")) return questions;
    if (["completed_early", "authorized_withdrawal"].includes(scenario.earlyEndSituation ?? "")) {
      questions.push({ id: "earlyEndDate", eyebrow: "Actual end date", prompt: "On what date will your study end?", kind: "date", value: scenario.earlyEndDate, answerLabel: scenario.earlyEndDate ? formatDate(scenario.earlyEndDate) : "I do not know yet", allowUnknownDate: true });
      if (!answered.has("earlyEndDate")) return questions;
    }
  }

  return questions;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function DateAnswer({ value, onComplete, onUnknown }: { value?: string; onComplete: (value: string) => void; onUnknown?: () => void }) {
  const initialDay = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const initialMonth = value?.match(/^(\d{4})-(\d{2})$/);
  const initialYear = value?.match(/^(\d{4})$/);
  const [month, setMonth] = useState(initialDay ? String(Number(initialDay[2])) : initialMonth ? String(Number(initialMonth[2])) : "");
  const [day, setDay] = useState(initialDay ? String(Number(initialDay[3])) : "");
  const [year, setYear] = useState(initialDay?.[1] ?? initialMonth?.[1] ?? initialYear?.[1] ?? "");
  const [error, setError] = useState("");
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!month || !day || year.length !== 4) return;
    const candidate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (isValidDateString(candidate)) {
      setError("");
      onCompleteRef.current(candidate);
    } else {
      setError("That is not a calendar date. Check the day, month, and year.");
    }
  }, [month, day, year]);

  return (
    <div className="date-answer">
      <div className="date-fields">
        <label>
          <span>Month</span>
          <select value={month} onChange={(event) => setMonth(event.currentTarget.value)}>
            <option value="">Select month</option>
            {months.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Day</span>
          <input inputMode="numeric" autoComplete="off" value={day} onChange={(event) => setDay(event.currentTarget.value.replace(/\D/g, "").slice(0, 2))} placeholder="Day" aria-label="Day" />
        </label>
        <label>
          <span>Year</span>
          <input inputMode="numeric" autoComplete="off" value={year} onChange={(event) => setYear(event.currentTarget.value.replace(/\D/g, "").slice(0, 4))} placeholder="Year" aria-label="Year" />
        </label>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      {onUnknown && <button type="button" className="text-action" onClick={onUnknown}>I do not know this date yet</button>}
    </div>
  );
}

function QuestionCard({ question, onAnswer, onDate, onUnknownDate }: { question: Question; onAnswer: (value: string) => void; onDate: (value: string) => void; onUnknownDate: () => void }) {
  return (
    <section className="question-card" aria-labelledby={`question-${question.id}`}>
      <p className="question-kicker">{question.eyebrow}</p>
      <h2 id={`question-${question.id}`}>{question.prompt}</h2>
      {question.help && <p className="question-help">{question.help}</p>}
      {question.kind === "choice" ? (
        <div className="choice-group">
          {question.choices?.map((choice) => (
            <button type="button" key={choice.value} onClick={() => onAnswer(choice.value)}>
              <span>{choice.label}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <DateAnswer value={question.value} onComplete={onDate} onUnknown={question.allowUnknownDate ? onUnknownDate : undefined} />
      )}
      <p className="answer-prompt">Answer to receive the next question.</p>
    </section>
  );
}

function I94Correction({ scenario, onPatch }: { scenario: StudentScenario; onPatch: (patch: Partial<StudentScenario>) => void }) {
  return (
    <details className="uncommon-details inline-uncommon">
      <summary>My I-94 does not say D/S <ChevronDown aria-hidden="true" /></summary>
      <div className="uncommon-grid">
        <div className="uncommon-field">
          <label>
            <span>Most current F-1 records say D/S. If yours shows a date, enter it here.</span>
            <select value={scenario.admissionBasis} onChange={(event) => onPatch({ admissionBasis: event.currentTarget.value as AdmissionBasis, i94AdmitUntilDate: event.currentTarget.value === "fixed_period" ? scenario.i94AdmitUntilDate : undefined })}>
              <option value="duration_of_status">It says D/S</option>
              <option value="fixed_period">It has a date</option>
              <option value="unknown">I need to check</option>
            </select>
          </label>
          {scenario.admissionBasis === "fixed_period" && <DateAnswer value={scenario.i94AdmitUntilDate} onComplete={(value) => onPatch({ i94AdmitUntilDate: value })} />}
        </div>
      </div>
    </details>
  );
}

function ConcernTracker({ topics }: { topics: IntakeTopic[] }) {
  const visibleTopics = topics.filter((topic, index) => {
    if (topic === "opt" && topics.includes("stem_opt")) return false;
    return topics.indexOf(topic) === index;
  });
  if (!visibleTopics.length) return null;

  return (
    <section className="concern-tracker" aria-label="Your priority topics">
      <strong>Your priorities</strong>
      <ul>
        {visibleTopics.map((topic) => <li key={topic}>{topicLabels[topic]}</li>)}
      </ul>
    </section>
  );
}

function FindingIcon({ tone }: { tone: Finding["tone"] }) {
  if (tone === "good") return <CheckCircle2 aria-hidden="true" />;
  if (tone === "warning" || tone === "danger") return <AlertTriangle aria-hidden="true" />;
  if (tone === "question") return <CircleHelp aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

function SourceLink({ sourceId }: { sourceId: string }) {
  const citation = SOURCE_INDEX[sourceId];
  if (!citation) return null;
  return (
    <a className="source-link" href={citation.url} title={citation.locator}>
      {sourceLinkLabel(citation)}
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function ImpactClaimList({ claims }: { claims: ImpactClaim[] }) {
  return (
    <div className="impact-list">
      {claims.map((item) => (
        <article key={item.id} className={`impact-item ${item.tone}`}>
          <FindingIcon tone={item.tone} />
          <div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            {item.sourceIds[0] && <SourceLink sourceId={item.sourceIds[0]} />}
          </div>
        </article>
      ))}
    </div>
  );
}

function ImpactIndex({
  map,
  scenario,
  topics,
  prominentTopics,
  completedTopics,
  activeTopic,
  fullInterview,
  onExplore
}: {
  map: ImpactMap;
  scenario: StudentScenario;
  topics: CanonicalTopic[];
  prominentTopics: CanonicalTopic[];
  completedTopics: CanonicalTopic[];
  activeTopic: CanonicalTopic | null;
  fullInterview: boolean;
  onExplore: (topic: CanonicalTopic) => void;
}) {
  const prominent = new Set(prominentTopics);
  const completed = new Set(completedTopics);
  return (
    <section className="impact-index" aria-labelledby="impact-index-title">
      <header>
        <p>Every issue this rule raises for you</p>
        <h3 id="impact-index-title">Click any issue to explore deeper</h3>
      </header>
      <div className="impact-index-list">
        {topics.map((topic) => {
          const meta = topicMeta(topic);
          const isProminent = prominent.has(topic);
          const isActive = activeTopic === topic;
          const state = isActive
            ? "Exploring"
            : completed.has(topic)
              ? fullInterview ? "Covered" : "Explored"
              : fullInterview && isProminent
                ? "In interview"
                : isProminent
                  ? "Priority"
                  : "Explore";
          return (
            <button
              type="button"
              key={topic}
              className={`${isProminent ? "prominent" : ""} ${isActive ? "active" : ""}`.trim()}
              onClick={() => onExplore(topic)}
              aria-pressed={isActive}
            >
              <span className="impact-index-icon" aria-hidden="true">{isProminent ? <Check /> : <ArrowRight />}</span>
              <span className="impact-index-copy"><strong>{meta.title}</strong><small>{topicImpactLine(map, topic, scenario)}</small></span>
              <span className="impact-index-state">{state}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ImpactList({
  map,
  scenario,
  topics,
  prominentTopics,
  completedTopics,
  activeTopic,
  fullInterview = false,
  onExplore
}: {
  map: ImpactMap;
  scenario?: StudentScenario;
  topics?: CanonicalTopic[];
  prominentTopics?: CanonicalTopic[];
  completedTopics?: CanonicalTopic[];
  activeTopic?: CanonicalTopic | null;
  fullInterview?: boolean;
  onExplore?: (topic: CanonicalTopic) => void;
}) {
  return (
    <section className="impact-area" aria-live="polite">
      <div className="impact-heading">
        <div>
          <p>How this affects you</p>
          <h2>{map.headline}</h2>
        </div>
      </div>
      <p className="impact-summary">{map.summary} {map.sourceIds[0] && <SourceLink sourceId={map.sourceIds[0]} />}</p>
      {map.focusClaims.length > 0 && (
        <section className="impact-group">
          <h3>Your priorities</h3>
          <ImpactClaimList claims={map.focusClaims} />
        </section>
      )}
      {scenario && topics && prominentTopics && completedTopics && onExplore && (
        <ImpactIndex
          map={map}
          scenario={scenario}
          topics={topics}
          prominentTopics={prominentTopics}
          completedTopics={completedTopics}
          activeTopic={activeTopic ?? null}
          fullInterview={fullInterview}
          onExplore={onExplore}
        />
      )}
      {map.ruleStatus && <p className="impact-status">{map.ruleStatus}</p>}
    </section>
  );
}

function AdvisementAction({
  state,
  disabled,
  onCreate
}: {
  state: ReportState;
  disabled: boolean;
  onCreate: () => void;
}) {
  return (
    <section className="advisement-action" aria-label="Create your advisement">
      <div><Sparkles aria-hidden="true" /><span><strong>Ready when you are</strong><small>Your advisement brings your situation and priorities together.</small></span></div>
      <button type="button" onClick={onCreate} disabled={state === "loading" || disabled}>
        {state === "loading" ? <RefreshCw className="spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
        {state === "loading" ? "Writing your advisement" : "I'm ready for my advisement"}
      </button>
      {disabled && <p className="field-error">Resolve the highlighted date conflict first.</p>}
    </section>
  );
}

function ExplorationHome({ fullInterview }: { fullInterview: boolean }) {
  return (
    <section className="question-card exploration-home">
      <p className="question-kicker">{fullInterview ? "Full interview" : "You choose what comes next"}</p>
      <h2>{fullInterview ? "Your full interview is complete" : "Explore another issue, or create your advisement"}</h2>
      <p className="question-help">
        {fullInterview
          ? "Every area shown in your impact map is included. You can still open any issue before creating your advisement."
          : "Use the impact list to open only the areas you want. Your original priorities stay at the top."}
      </p>
    </section>
  );
}

interface DisplayTimelineItem {
  date?: string;
  dateLabel: string;
  sortKey: string;
  title: string;
  detail: string;
  tone: TimelineItem["tone"];
}

function displayTimelineItems(events: TimelineItem[]): DisplayTimelineItem[] {
  return events.map((event) => ({
    ...event,
    dateLabel: formatDate(event.date),
    sortKey: event.date
  }));
}

export function buildDisplayTimeline(
  scenario: StudentScenario,
  events: TimelineItem[],
  caseEvents: CaseEvent[] = []
): DisplayTimelineItem[] {
  const displayed = displayTimelineItems(events);
  const approvedOpt = scenario.optStage.endsWith("approved");
  const programEnd = scenario.currentProgramEndDate ?? scenario.currentProgramEndDateHint;
  const eadEnd = scenario.currentEadEndDate ?? scenario.currentEadEndDateHint;

  if (programEnd && approvedOpt && !displayed.some((event) => event.date === scenario.currentProgramEndDate && /program/i.test(event.title))) {
    const label = isValidDateString(programEnd) ? formatDate(programEnd) : formatPartialDate(programEnd);
    if (label) {
      displayed.push({
        date: isValidDateString(programEnd) ? programEnd : undefined,
        dateLabel: label,
        sortKey: isValidDateString(programEnd) ? programEnd : `${programEnd}-15`,
        title: "Your previous program ended",
        detail: "Your approved OPT, rather than that completed I-20, covers September 15.",
        tone: "neutral"
      });
    }
  }

  if (approvedOpt && !scenario.currentEadEndDate && eadEnd) {
    const label = formatPartialDate(eadEnd);
    if (label) {
      displayed.push({
        dateLabel: label,
        sortKey: `${eadEnd}-15`,
        title: "Your approved OPT ends",
        detail: "The exact day on your EAD sets the next deadline.",
        tone: "good"
      });
      displayed.push({
        dateLabel: "60 days later",
        sortKey: `${eadEnd}-99`,
        title: "Your old-rule period ends",
        detail: "The exact date appears as soon as you confirm the day on your EAD.",
        tone: "neutral"
      });
    }
  }

  for (const event of caseEvents) {
    const milestones = event.role === "future_program"
      ? [
          { point: event.start, title: "Your next program may begin", detail: "The exact day will determine how this program connects to your current stay." },
          { point: event.end, title: "Your next program may end", detail: "The exact day will determine whether you need additional F-1 time." }
        ]
      : event.role === "active_program"
        ? [{ point: event.end, title: "Your program is expected to end", detail: "Confirm the day printed on your I-20 to calculate the exact OPT and departure dates." }]
        : event.role === "completed_program"
          ? [{ point: event.end, title: "Your previous program ended", detail: "A later document or approved training can control your September 15 status." }]
          : [];
    for (const milestone of milestones) {
      if (!milestone.point || milestone.point.precision === "day") continue;
      const dateLabel = formatPartialDate(milestone.point.value);
      if (!dateLabel || displayed.some((item) => item.dateLabel === dateLabel && item.title === milestone.title)) continue;
      displayed.push({
        dateLabel,
        sortKey: milestone.point.precision === "month" ? `${milestone.point.value}-15` : `${milestone.point.value}-06-30`,
        title: milestone.title,
        detail: milestone.detail,
        tone: "neutral"
      });
    }
  }

  return displayed.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}

function Timeline({ title, subtitle, events }: { title: string; subtitle: string; events: DisplayTimelineItem[] }) {
  if (!events.length) return null;
  return (
    <section className="visual-timeline">
      <header>
        <CalendarDays aria-hidden="true" />
        <div><h3>{title}</h3><p>{subtitle}</p></div>
      </header>
      <div className="timeline-track" style={{ "--event-count": events.length } as React.CSSProperties}>
        {events.map((event, index) => (
          <div className={`timeline-event ${event.tone}`} key={`${event.sortKey}-${event.title}-${index}`}>
            <time dateTime={event.date}>{event.dateLabel}</time>
            <span className="timeline-dot" aria-hidden="true" />
            <h4>{event.title}</h4>
            <p>{event.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdvisorFollowUp({
  turns,
  question,
  state,
  onQuestion,
  onSubmit
}: {
  turns: AdvisorTurn[];
  question: string;
  state: ReportState;
  onQuestion: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="advisor-follow-up" aria-labelledby="advisor-follow-up-title">
      <p className="section-eyebrow">Continue with the rule advisor</p>
      <h2 id="advisor-follow-up-title">What else would you like to ask?</h2>
      {turns.length > 0 && (
        <div className="advisor-turns" aria-live="polite">
          {turns.map((turn, index) => (
            <article key={`${turn.role}-${index}`} className={`advisor-turn ${turn.role}`}>
              <strong>{turn.role === "user" ? "You" : "Advisor"}</strong>
              {turn.text.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {turn.role === "assistant" && turn.sourceIds?.[0] && <SourceLink sourceId={turn.sourceIds[0]} />}
            </article>
          ))}
        </div>
      )}
      <form onSubmit={onSubmit}>
        <label htmlFor="advisor-question">Ask about travel, OPT, extensions, school changes, or another part of this rule.</label>
        <div>
          <textarea id="advisor-question" value={question} onChange={(event) => onQuestion(event.currentTarget.value)} placeholder="For example: Can I visit home before I file for OPT?" />
          <button type="submit" title="Ask the rule advisor" disabled={state === "loading" || question.trim().length < 3}>
            {state === "loading" ? <RefreshCw className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          </button>
        </div>
        {state === "failed" && <p className="field-error">That answer did not finish. Your question is still here; try again.</p>}
      </form>
    </section>
  );
}

function WhatHappened({ onBack }: { onBack: () => void }) {
  return (
    <main className="overview-page">
      <button type="button" className="back-action" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to your answers</button>
      <article>
        <p className="article-kicker">Effective September 15, 2026</p>
        <h1>Major changes to how long F-1 students may stay</h1>
        <p className="article-deck">DHS has replaced the open-ended “duration of status” system with fixed periods of admission and a new USCIS extension process.</p>
        <p>On July 17, 2026, the Department of Homeland Security published a final rule that changes the basic time structure of F-1 status. For most new admissions and changes to F-1 status beginning September 15, the I-94 will show a specific date instead of D/S.</p>
        <h2>Many current students keep the old rules</h2>
        <p>If you are in the United States in valid F-1 status with D/S on September 15, 2026, you can remain under the old rules through the later I-20 or EAD end date in place that day, up to September 15, 2030, followed by 60 days. Leaving and returning after the rule begins moves you into the fixed-period system.</p>
        <h2>New admissions receive a dated I-94</h2>
        <p>The normal fixed period covers the I-20 program dates for no more than four years. The four-year maximum starts with the I-20 program start date, not the date you physically enter. The I-94 also includes 30 days after the study or training period, reducing the ordinary post-completion period from 60 days to 30.</p>
        <h2>Longer plans may require Form I-539</h2>
        <p>If your program or authorized training continues beyond the first fixed period, you may need to ask USCIS for an extension of stay. The filing can require a new DSO-endorsed I-20, financial evidence, a fee, and biometrics. USCIS must receive a timely filing by the I-94 date, but work authorization can be interrupted if the request arrives only during the final 30 days.</p>
        <h2>Travel can change the answer</h2>
        <p>For a current student with D/S, returning after September 15 ends the old-rule path and creates a fixed admission period. Travel can also provide an alternative to Form I-539 when you need more time: you may leave and ask CBP for a new F-1 admission period with an updated I-20 and valid travel documents. The I-20 program dates limit that period, and CBP makes the admission decision.</p>
        <h2>Some current students receive a one-time OPT option</h2>
        <p>If your normal post-completion OPT filing window opens soon enough, a DSO-recommended Form I-765 received by USCIS by March 18, 2027 can avoid a separate Form I-539 solely because D/S ended. Travel before filing can change that route, so the order of the OPT filing and the trip matters.</p>
        <h2>School and program choices also change</h2>
        <p>The rule adds limits on first-year undergraduate transfers and program changes, graduate transfers and changes of educational objective, and later programs at the same or a lower education level. DHS can delay these particular provisions through September 14, 2028 and must announce a delay publicly.</p>
        <div className="article-links">
          <a href={SOURCE_INDEX["FR-2026-FINAL-RULE"].url}><FileText aria-hidden="true" /><span><strong>Read the official final rule</strong><small>Federal Register, July 17, 2026</small></span><ExternalLink aria-hidden="true" /></a>
          <a href={SOURCE_INDEX["NAFSA-DS-FINAL-RULE-HUB"].url}><Info aria-hidden="true" /><span><strong>Read NAFSA's public overview</strong><small>Regulatory analysis and updates</small></span><ExternalLink aria-hidden="true" /></a>
        </div>
        <p className="status-note">Rule status last checked July 19, 2026. A court order, congressional action, or DHS notice could change implementation.</p>
      </article>
    </main>
  );
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

const PLANNER_SESSION_KEY = "f1-stay-map-session-v1";

interface PlannerSession {
  version: 1;
  experience: Experience;
  scenario: StudentScenario;
  answered: string[];
  intake: IntakeExtractionResponse | null;
  understoodNarrative: string;
  focusTopics: IntakeTopic[];
  focusCaptured: boolean;
  interviewMode: InterviewMode;
  exploreTopics: IntakeTopic[];
  storyFinished: boolean;
  report: ExplanationResponse | null;
  followUpTurns: AdvisorTurn[];
}

function readPlannerSession(): PlannerSession | null {
  try {
    const stored = window.sessionStorage.getItem(PLANNER_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<PlannerSession>;
    if (parsed.version !== 1 || !parsed.scenario || !parsed.experience) return null;
    return parsed as PlannerSession;
  } catch {
    return null;
  }
}

function writePlannerSession(session: PlannerSession): void {
  try {
    window.sessionStorage.setItem(PLANNER_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session recovery is optional; the planner must still work when storage is blocked.
  }
}

function clearPlannerSession(): void {
  try {
    window.sessionStorage.removeItem(PLANNER_SESSION_KEY);
  } catch {
    // Nothing needs clearing when storage is unavailable.
  }
}

export default function App() {
  const restoredSession = useMemo(readPlannerSession, []);
  const [page, setPage] = useState<Page>(() => window.location.hash === "#what-happened" ? "overview" : "planner");
  const [experience, setExperience] = useState<Experience>(restoredSession?.experience ?? "welcome");
  const [scenario, setScenario] = useState<StudentScenario>(() => restoredSession?.scenario ? { ...DEFAULT_SCENARIO, ...restoredSession.scenario } : DEFAULT_SCENARIO);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set(restoredSession?.answered ?? []));
  const [intake, setIntake] = useState<IntakeExtractionResponse | null>(restoredSession?.intake ?? null);
  const [intakeState, setIntakeState] = useState<IntakeState>(restoredSession?.intake ? "ready" : "idle");
  const [intakeNotice, setIntakeNotice] = useState("");
  const [understoodNarrative, setUnderstoodNarrative] = useState(restoredSession?.understoodNarrative ?? "");
  const [focusTopics, setFocusTopics] = useState<IntakeTopic[]>(restoredSession?.focusTopics ?? []);
  const [focusCaptured, setFocusCaptured] = useState(restoredSession?.focusCaptured ?? false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>(restoredSession?.interviewMode ?? "focused");
  const [exploreTopics, setExploreTopics] = useState<IntakeTopic[]>(restoredSession?.exploreTopics ?? []);
  const [recording, setRecording] = useState(false);
  const [storyFinished, setStoryFinished] = useState(restoredSession?.storyFinished ?? false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [report, setReport] = useState<ExplanationResponse | null>(restoredSession?.report ?? null);
  const [reportState, setReportState] = useState<ReportState>(restoredSession?.report ? "ready" : "idle");
  const [reportError, setReportError] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [followUpTurns, setFollowUpTurns] = useState<AdvisorTurn[]>(restoredSession?.followUpTurns ?? []);
  const [followUpState, setFollowUpState] = useState<ReportState>("idle");
  const [shareNotice, setShareNotice] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const reportAbortRef = useRef<AbortController | null>(null);
  const latestScenarioRef = useRef(scenario);
  const recordingRef = useRef(recording);
  const interimTranscriptRef = useRef("");
  const intakeControllerRef = useRef<AbortController | null>(null);
  const intakeInFlightRef = useRef(false);
  const activeIntakeNarrativeRef = useRef("");
  const queuedIntakeNarrativeRef = useRef<string | null>(null);
  const lastUnderstoodNarrativeRef = useRef("");
  const storyResultsRef = useRef<HTMLElement | null>(null);
  const preserveReportForScenarioUpdateRef = useRef(false);
  const restoringReportRef = useRef(Boolean(restoredSession?.report));

  useEffect(() => {
    const onHash = () => setPage(window.location.hash === "#what-happened" ? "overview" : "planner");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => () => {
    intakeControllerRef.current?.abort();
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    latestScenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    const session: PlannerSession = {
      version: 1,
      experience,
      scenario,
      answered: Array.from(answered),
      intake,
      understoodNarrative,
      focusTopics,
      focusCaptured,
      interviewMode,
      exploreTopics,
      storyFinished,
      report,
      followUpTurns
    };
    writePlannerSession(session);
  }, [answered, experience, exploreTopics, focusCaptured, focusTopics, followUpTurns, intake, interviewMode, report, scenario, storyFinished, understoodNarrative]);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    if (restoringReportRef.current) {
      restoringReportRef.current = false;
      return;
    }
    if (preserveReportForScenarioUpdateRef.current) {
      preserveReportForScenarioUpdateRef.current = false;
      return;
    }
    reportAbortRef.current?.abort();
    setReport(null);
    setReportState("idle");
    setReportError("");
  }, [scenario]);

  async function understandNarrative(rawNarrative: string) {
    const narrative = rawNarrative.trim();
    if (narrative.length < 12) return;
    if (/\bN\d{10}\b/i.test(narrative)) {
      setIntakeState("failed");
      setIntakeNotice("Please remove the SEVIS ID before continuing. We do not need it.");
      return;
    }
    if (lastUnderstoodNarrativeRef.current === narrative) {
      setIntakeState("ready");
      return;
    }
    if (intakeInFlightRef.current) {
      if (activeIntakeNarrativeRef.current !== narrative) queuedIntakeNarrativeRef.current = narrative;
      setIntakeState("loading");
      setIntakeNotice(recordingRef.current ? "I have a first pass underway and will add your latest words next." : "I am finishing the latest part of your story.");
      return;
    }

    const controller = new AbortController();
    intakeControllerRef.current = controller;
    intakeInFlightRef.current = true;
    activeIntakeNarrativeRef.current = narrative;
    setIntakeState("loading");
    setIntakeNotice(recordingRef.current ? "I am building your first results while you speak." : "I am reading your story now.");
    let succeeded = false;
    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ narrative, currentScenario: { ...latestScenarioRef.current, narrative } }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Intake failed: ${response.status}`);
      const body = await response.json() as IntakeExtractionResponse;
      if (controller.signal.aborted) return;
      setIntake(body);
      setUnderstoodNarrative(narrative);
      lastUnderstoodNarrativeRef.current = narrative;
      succeeded = true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setIntakeState("failed");
      setIntakeNotice("Your words are saved, but I could not understand them yet. Try again.");
    } finally {
      if (intakeControllerRef.current !== controller) return;
      intakeControllerRef.current = null;
      intakeInFlightRef.current = false;
      activeIntakeNarrativeRef.current = "";
      if (controller.signal.aborted) return;

      const queuedNarrative = queuedIntakeNarrativeRef.current;
      queuedIntakeNarrativeRef.current = null;
      if (queuedNarrative && queuedNarrative !== lastUnderstoodNarrativeRef.current) {
        setIntakeState("loading");
        setIntakeNotice("I found the first details. Now I am adding the rest.");
        window.setTimeout(() => void understandNarrative(queuedNarrative), 0);
        return;
      }
      if (succeeded) {
        setIntakeState("ready");
        setIntakeNotice("");
      }
    }
  }

  useEffect(() => {
    if (experience !== "story") return;
    const narrative = scenario.narrative?.trim() ?? "";
    if (narrative.length < 12) {
      intakeControllerRef.current?.abort();
      intakeControllerRef.current = null;
      intakeInFlightRef.current = false;
      activeIntakeNarrativeRef.current = "";
      queuedIntakeNarrativeRef.current = null;
      lastUnderstoodNarrativeRef.current = "";
      setIntake(null);
      setUnderstoodNarrative("");
      setIntakeState("idle");
      return;
    }
    if (/\bN\d{10}\b/i.test(narrative)) {
      setIntakeState("failed");
      setIntakeNotice("Please remove the SEVIS ID before continuing. We do not need it.");
      return;
    }
    const timer = window.setTimeout(() => void understandNarrative(narrative), recording ? 1200 : 500);
    return () => window.clearTimeout(timer);
  }, [experience, recording, scenario.narrative]);

  useEffect(() => {
    if (experience !== "story" || !storyFinished || !currentNarrative) return;
    const timer = window.setTimeout(() => storyResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => window.clearTimeout(timer);
  }, [experience, storyFinished, intakeState, scenario.narrative]);

  const initialPresenceAnswered = answered.has("presence") && scenario.inUsOnEffectiveDate !== "unknown";
  const draftScenario = useMemo(
    () => intake ? mergeFacts(scenario, intake.facts, answered.has("presence")) : scenario,
    [answered, intake, scenario]
  );
  const activeScenario = experience === "story" ? draftScenario : scenario;
  const raisedTopics = useMemo(() => intake?.topics ?? [], [intake]);
  const priorityTopics = useMemo(
    () => canonicalTopics([...focusTopics, ...exploreTopics]),
    [exploreTopics, focusTopics]
  );
  const caseTopics = experience === "story" ? raisedTopics : priorityTopics;
  const studentCase = useMemo(
    () => buildStudentCase(activeScenario, intake?.facts ?? [], caseTopics, intake?.events ?? []),
    [activeScenario, caseTopics, intake]
  );
  const impactTopics = useMemo(
    () => applicableCaseTopics(studentCase) as CanonicalTopic[],
    [studentCase]
  );
  const result = useMemo(() => calculateScenario(activeScenario), [activeScenario]);
  const travelResult = useMemo(() => {
    if (
      !isCurrent(activeScenario) ||
      (activeScenario.travelPosture !== "planned" && activeScenario.travelPosture !== "completed") ||
      activeScenario.returningAfterEffectiveDate !== "yes" ||
      !["same_i20_balance", "longer_program_i20"].includes(activeScenario.reentryBasis)
    ) return null;
    return calculateScenario(scenarioForFixedReentry(activeScenario));
  }, [activeScenario]);
  const primaryResult = travelResult ?? result;
  const stayTimeline = useMemo(
    () => buildDisplayTimeline(activeScenario, result.timeline, studentCase.events),
    [activeScenario, result.timeline, studentCase.events]
  );
  const returnTimeline = useMemo(
    () => travelResult ? displayTimelineItems(travelResult.timeline) : [],
    [travelResult]
  );
  const coreQuestions = useMemo(
    () => buildCoreQuestions(scenario, answered, intake?.facts ?? []),
    [scenario, answered, intake]
  );
  const coreQuestionIds = useMemo(() => new Set(coreQuestions.map((question) => question.id)), [coreQuestions]);
  const coreQuestion = coreQuestions.find((question) => !answered.has(question.id));
  const completedTopics = useMemo(() => {
    if (coreQuestion) return [];
    const topicsToCheck = interviewMode === "full" ? impactTopics : priorityTopics;
    return topicsToCheck.filter((topic) => !buildQuestions(scenario, answered, [topic], result.activityEnd)
      .some((question) => !coreQuestionIds.has(question.id) && !answered.has(question.id)));
  }, [answered, coreQuestion, coreQuestionIds, impactTopics, interviewMode, priorityTopics, result.activityEnd, scenario]);
  const selectedProminentTopics = useMemo(
    () => interviewMode === "full"
      ? canonicalTopics(completedTopics)
      : priorityTopics,
    [completedTopics, interviewMode, priorityTopics]
  );
  const visibleFocusTopics = experience === "story"
    ? raisedTopics
    : selectedProminentTopics;
  const coverageConflict = hasEffectiveDateCoverageConflict(activeScenario, intake?.facts ?? []);
  const contradiction = coverageConflict || result.findings.some((item) =>
    ["future-entry-before-effective-date-contradiction", "document-ends-before-effective-date"].includes(item.id)
  );
  const impactMap = useMemo(
    () => buildImpactMap(
      activeScenario,
      result,
      travelResult,
      visibleFocusTopics
    ),
    [activeScenario, coreQuestion, experience, result, travelResult, visibleFocusTopics]
  );
  const displayedImpactMap: ImpactMap = coverageConflict
    ? {
        ...impactMap,
        headline: "These dates do not fit yet",
        summary: `An I-20 ending ${coverageDateLabel(activeScenario, intake?.facts ?? []) ?? "before September 15"} does not by itself cover September 15, 2026. Confirm a later I-20 or an approved OPT or STEM OPT EAD.`,
        unresolved: []
      }
    : impactMap;
  const focusedQuestion = interviewMode === "focused" && !coreQuestion
    ? buildQuestions(scenario, answered, priorityTopics, result.activityEnd)
      .find((question) => !coreQuestionIds.has(question.id) && !answered.has(question.id))
    : undefined;
  const fullInterviewQuestion = interviewMode === "full" && !coreQuestion
    ? buildQuestions(scenario, answered, impactTopics, result.activityEnd)
      .find((question) => !coreQuestionIds.has(question.id) && !answered.has(question.id))
    : undefined;
  const activeQuestion = coreQuestion ?? focusedQuestion ?? fullInterviewQuestion;
  const activeImpactTopic = activeQuestion ? topicForQuestion(activeQuestion.id) ?? null : null;
  const historyTopics = useMemo(
    () => interviewMode === "full"
      ? impactTopics
      : priorityTopics,
    [impactTopics, interviewMode, priorityTopics]
  );
  const questions = useMemo(
    () => buildQuestions(scenario, answered, historyTopics, result.activityEnd),
    [scenario, answered, historyTopics, result.activityEnd]
  );
  const completedQuestions = questions.filter((question) => answered.has(question.id));
  const currentNarrative = scenario.narrative?.trim() ?? "";
  const storyReady = Boolean(intake && intakeState === "ready" && understoodNarrative === currentNarrative);
  const storyHighlights = intake?.highlights?.length
    ? intake.highlights
    : intake
      ? usableFacts(intake.facts).slice(0, 6).map((fact) => `${factLabels[fact.field]}: ${displayFactValue(fact)}`)
      : [];
  const assumesEffectiveDatePresence = !answered.has("presence") && Boolean(intake?.facts.some((fact) => fact.field === "inUsOnEffectiveDate" && fact.value === "yes" && fact.needsConfirmation));
  const storyActionLabel = recording
    ? "I am done talking"
    : intakeState === "loading"
      ? "Finishing your results"
      : storyReady
        ? "Continue to your results"
        : intakeState === "failed"
          ? "Try understanding again"
          : "Understand my story";

  function navigateOverview(show: boolean) {
    window.location.hash = show ? "what-happened" : "";
  }

  function startFullInterview() {
    setInterviewMode("full");
    setFocusCaptured(true);
    setFocusTopics([]);
    setExploreTopics([]);
    setExperience("interview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exploreImpact(topic: CanonicalTopic) {
    setExploreTopics((current) => canonicalTopics([...current, topic]));
    if (!activeQuestion) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function patchScenario(patch: Partial<StudentScenario>) {
    setScenario((current) => ({ ...current, ...patch }));
  }

  function answerInitialPresence(value: "yes" | "no") {
    patchScenario({
      inUsOnEffectiveDate: value,
      startingPosition: value === "yes" ? "current_ds_inside_us" : "prospective_outside_us",
      maintainingStatusOnEffectiveDate: value === "yes" ? "yes" : "unknown",
      admissionBasis: value === "yes" ? "duration_of_status" : "fixed_period"
    });
    setAnswered((current) => new Set(current).add("presence"));
  }

  function answer(question: Question, value: string) {
    if (question.id === "effectiveDateCoverage" && value === "correct_i20") {
      setScenario((current) => ({
        ...current,
        programEndOnEffectiveDate: undefined,
        currentProgramEndDate: undefined
      }));
      setAnswered((current) => {
        const next = new Set(current);
        next.add("effectiveDateCoverage");
        next.delete("programEnd");
        next.delete("effectiveEadEnd");
        return next;
      });
      return;
    }
    if (question.id === "effectiveDateCoverage" && value === "correct_presence") {
      setScenario((current) => ({
        ...resetQuestionValue("presence", current),
        programEndOnEffectiveDate: undefined,
        currentProgramEndDate: undefined
      }));
      setAnswered((current) => {
        const next = new Set(current);
        next.delete("presence");
        next.delete("programEnd");
        next.delete("effectiveDateCoverage");
        next.delete("effectiveEadEnd");
        return next;
      });
      return;
    }
    const patch: Partial<StudentScenario> = {};
    switch (question.id) {
      case "presence":
        patch.inUsOnEffectiveDate = value as YesNoUnknown;
        patch.startingPosition = value === "yes"
          ? "current_ds_inside_us"
          : value === "no" && ["prospective_outside_us", "change_status_inside_us"].includes(scenario.startingPosition)
            ? scenario.startingPosition
            : value === "no"
              ? "prospective_outside_us"
              : "unknown";
        patch.maintainingStatusOnEffectiveDate = value === "yes" ? "yes" : "unknown";
        patch.admissionBasis = value === "yes" ? "duration_of_status" : value === "no" ? "fixed_period" : "unknown";
        break;
      case "futureMethod": patch.startingPosition = value as StartingPosition; patch.admissionBasis = "fixed_period"; break;
      case "departBeforeRule":
        patch.departBeforeEffectiveDate = value as YesNoUnknown;
        if (value === "yes") patch.reentryDate = undefined;
        if (value === "no") {
          patch.inUsOnEffectiveDate = "yes";
          patch.startingPosition = "current_ds_inside_us";
          patch.maintainingStatusOnEffectiveDate = "yes";
          patch.admissionBasis = "duration_of_status";
        }
        break;
      case "programType": patch.programType = value as ProgramType; break;
      case "educationLevel": patch.educationLevel = value as EducationLevel; break;
      case "optIntent":
        patch.optIntent = value as YesNoUnknown;
        if (value !== "yes") patch.optStage = "none";
        break;
      case "optStatus":
        patch.optStage = value as OptStage;
        if (value.endsWith("pending") || value.endsWith("approved")) patch.dsoRecommendedOpt = "yes";
        break;
      case "effectiveDateCoverage":
        patch.optIntent = "yes";
        patch.optStage = value as OptStage;
        patch.dsoRecommendedOpt = "yes";
        break;
      case "dsoRecommendation": patch.dsoRecommendedOpt = value as YesNoUnknown; break;
      case "optBeforeTravel": patch.optFiledBeforeDeparture = value as YesNoUnknown; break;
      case "travelIntent":
        patch.travelPosture = value as TravelPosture;
        break;
      case "returnAfterRule": patch.returningAfterEffectiveDate = value as YesNoUnknown; break;
      case "travelI20": patch.reentryBasis = value as ReentryBasis; break;
      case "schoolTransfer": patch.schoolTransferPlan = value as YesNoUnknown; patch.transferOrProgramChange = value === "yes" || scenario.academicProgramChangePlan === "yes" ? "yes" : "no"; break;
      case "programChange": patch.academicProgramChangePlan = value as YesNoUnknown; patch.transferOrProgramChange = value === "yes" || scenario.schoolTransferPlan === "yes" ? "yes" : "no"; break;
      case "firstAcademicYear": patch.firstAcademicYearCompleted = value as YesNoUnknown; break;
      case "nextProgram": patch.nextProgramLevelPlan = value as NextProgramLevelPlan; break;
      case "cptIntent": patch.cptPlan = value === "yes" ? "planned" : value === "no" ? "none" : "unknown"; break;
      case "f2Dependents": patch.hasF2Dependents = value as YesNoUnknown; break;
      case "earlyEnd":
        patch.earlyEndSituation = value as StudentScenario["earlyEndSituation"];
        if (value === "none" || value === "status_violation") patch.earlyEndDate = undefined;
        break;
    }
    patchScenario(patch);
    setAnswered((current) => {
      const next = new Set(current);
      next.add(question.id);
      if (question.id === "departBeforeRule" && value === "yes") next.delete("entryDate");
      if (question.id === "travelI20" && value === "same_i20_balance" && !scenario.programStartDate) next.delete("travelProgramStart");
      if (question.id === "travelI20" && value === "longer_program_i20") {
        if (!scenario.returnProgramStartDate) next.delete("travelProgramStart");
        if (!scenario.returnProgramEndDate) next.delete("travelProgramEnd");
      }
      return next;
    });
  }

  function answerDate(question: Question, value?: string) {
    const patch: Partial<StudentScenario> = {};
    switch (question.id) {
      case "entryDate":
      case "returnDate": patch.reentryDate = value; break;
      case "programStart":
        patch.programStartDate = value;
        break;
      case "travelProgramStart":
        if (scenario.reentryBasis === "longer_program_i20") patch.returnProgramStartDate = value;
        else patch.programStartDate = value;
        break;
      case "travelProgramEnd": patch.returnProgramEndDate = value; break;
      case "programEnd":
        patch.currentProgramEndDate = value;
        patch.currentProgramEndDateHint = undefined;
        if (isCurrent(scenario)) patch.programEndOnEffectiveDate = value;
        break;
      case "effectiveEadEnd":
        patch.currentEadEndDate = value;
        patch.eadEndOnEffectiveDate = value;
        patch.currentEadEndDateHint = undefined;
        break;
      case "optFilingDate": patch.optFilingDate = value; break;
      case "eadEndDate": patch.currentEadEndDate = value; break;
      case "earlyEndDate": patch.earlyEndDate = value; break;
      case "nextProgramStart": patch.nextProgramStartDate = value; break;
      case "nextProgramEnd": patch.nextProgramEndDate = value; break;
    }
    patchScenario(patch);
    setAnswered((current) => {
      const next = new Set(current);
      if (question.id === "effectiveEadEnd" && value && compareDates(value, DEFAULT_EFFECTIVE_DATE) < 0) {
        next.delete("effectiveEadEnd");
        return next;
      }
      next.add(question.id);
      if (question.id === "effectiveEadEnd") next.add("eadEndDate");
      if (question.id === "programEnd") {
        next.delete("effectiveDateCoverage");
        next.delete("effectiveEadEnd");
      }
      return next;
    });
  }

  function resetQuestionValue(id: string, draft: StudentScenario): StudentScenario {
    const next = { ...draft };
    if (id === "presence") {
      next.inUsOnEffectiveDate = "unknown";
      next.maintainingStatusOnEffectiveDate = "unknown";
      next.admissionBasis = "unknown";
      next.startingPosition = "unknown";
    }
    if (id === "futureMethod") next.startingPosition = "unknown";
    if (id === "entryDate" || id === "returnDate") next.reentryDate = undefined;
    if (id === "departBeforeRule") next.departBeforeEffectiveDate = "unknown";
    if (id === "programStart") next.programStartDate = undefined;
    if (id === "travelProgramStart") {
      if (next.reentryBasis === "longer_program_i20") next.returnProgramStartDate = undefined;
      else next.programStartDate = undefined;
    }
    if (id === "travelProgramEnd") next.returnProgramEndDate = undefined;
    if (id === "programEnd") { next.programEndOnEffectiveDate = undefined; next.currentProgramEndDate = undefined; next.currentProgramEndDateHint = undefined; }
    if (id === "effectiveEadEnd") { next.eadEndOnEffectiveDate = undefined; next.currentEadEndDate = undefined; next.currentEadEndDateHint = undefined; }
    if (id === "programType") next.programType = "unknown";
    if (id === "educationLevel") next.educationLevel = "unknown";
    if (id === "optIntent") next.optIntent = "unknown";
    if (id === "optStatus") next.optStage = "none";
    if (id === "dsoRecommendation") next.dsoRecommendedOpt = "unknown";
    if (id === "optFilingDate") next.optFilingDate = undefined;
    if (id === "optBeforeTravel") next.optFiledBeforeDeparture = "unknown";
    if (id === "eadEndDate") next.currentEadEndDate = undefined;
    if (id === "travelIntent") next.travelPosture = "unknown";
    if (id === "returnAfterRule") next.returningAfterEffectiveDate = "unknown";
    if (id === "travelI20") next.reentryBasis = "unknown";
    if (id === "schoolTransfer") next.schoolTransferPlan = "unknown";
    if (id === "programChange") next.academicProgramChangePlan = "unknown";
    if (id === "firstAcademicYear") next.firstAcademicYearCompleted = "unknown";
    if (id === "nextProgram") next.nextProgramLevelPlan = "unknown";
    if (id === "nextProgramStart") next.nextProgramStartDate = undefined;
    if (id === "nextProgramEnd") next.nextProgramEndDate = undefined;
    if (id === "cptIntent") next.cptPlan = "none";
    if (id === "f2Dependents") next.hasF2Dependents = "unknown";
    if (id === "earlyEnd") { next.earlyEndSituation = "unknown"; next.earlyEndDate = undefined; }
    if (id === "earlyEndDate") next.earlyEndDate = undefined;
    return next;
  }

  function editQuestion(id: string) {
    setScenario((current) => resetQuestionValue(id, current));
    setAnswered((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    const topic = topicForQuestion(id);
    if (topic) {
      const affectedTopics = id === "firstAcademicYear"
        ? ["school_transfer", "program_change"] as CanonicalTopic[]
        : [topic];
      setExploreTopics((current) => canonicalTopics([...current, ...affectedTopics]));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markFactsAnswered(facts: IntakeCandidateFact[]) {
    const mapping: Partial<Record<IntakeFactField, string[]>> = {
      inUsOnEffectiveDate: ["presence"],
      startingPosition: ["futureMethod"],
      reentryDate: [isCurrent(draftScenario) ? "returnDate" : "entryDate"],
      departBeforeEffectiveDate: ["departBeforeRule"],
      programStartDate: [isCurrent(draftScenario) ? "travelProgramStart" : "programStart"],
      currentProgramEndDate: ["programEnd"],
      programEndOnEffectiveDate: ["programEnd"],
      programType: ["programType"],
      educationLevel: ["educationLevel"],
      optIntent: ["optIntent"],
      dsoRecommendedOpt: ["dsoRecommendation"],
      optFilingDate: ["optFilingDate"],
      optFiledBeforeDeparture: ["optBeforeTravel"],
      currentEadEndDate: ["eadEndDate"],
      travelPosture: ["travelIntent"],
      returningAfterEffectiveDate: ["returnAfterRule"],
      reentryBasis: ["travelI20"],
      returnProgramStartDate: ["travelProgramStart"],
      returnProgramEndDate: ["travelProgramEnd"],
      schoolTransferPlan: ["schoolTransfer"],
      academicProgramChangePlan: ["programChange"],
      firstAcademicYearCompleted: ["firstAcademicYear"],
      nextProgramLevelPlan: ["nextProgram"],
      nextProgramStartDate: ["nextProgramStart"],
      nextProgramEndDate: ["nextProgramEnd"],
      cptPlan: ["cptIntent"],
      hasF2Dependents: ["f2Dependents"],
      earlyEndSituation: ["earlyEnd"],
      earlyEndDate: ["earlyEndDate"]
    };
    const mapped = usableFacts(facts).flatMap((fact) => {
      if (fact.field === "optStage") {
        const explicitFutureOpt = fact.value === "none" && facts.some((item) =>
          item.field === "optIntent" && item.value === "yes" && item.confidence !== "low"
        );
        return fact.value === "none" && !explicitFutureOpt ? [] : ["optIntent", "optStatus"];
      }
      if ((fact.field === "currentEadEndDate" || fact.field === "eadEndOnEffectiveDate") && draftScenario.optStage.endsWith("approved")) {
        return ["effectiveEadEnd", "eadEndDate"];
      }
      if (answered.has("presence") && ["inUsOnEffectiveDate", "maintainingStatusOnEffectiveDate", "admissionBasis"].includes(fact.field)) {
        return [];
      }
      if (answered.has("presence") && fact.field === "startingPosition" && scenario.inUsOnEffectiveDate === "yes") {
        return [];
      }
      return mapping[fact.field] ?? [];
    });
    setAnswered((current) => new Set([...current, ...mapped]));
  }

  function finishStory() {
    if (!intake || !storyReady) {
      void understandNarrative(currentNarrative);
      return;
    }
    setScenario(draftScenario);
    markFactsAnswered(intake.facts);
    const storyTopics: IntakeTopic[] = intake.topics.length ? intake.topics : ["stay_length"];
    setFocusTopics(storyTopics);
    setInterviewMode("focused");
    setExploreTopics([]);
    setFocusCaptured(true);
    recognitionRef.current?.stop();
    recordingRef.current = false;
    setRecording(false);
    setExperience("interview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function stopTalking() {
    recognitionRef.current?.stop();
    recordingRef.current = false;
    setRecording(false);
    setStoryFinished(true);
    setIntakeState("loading");
    setIntakeNotice("Got it. I am finishing what I heard.");
    const narrative = latestScenarioRef.current.narrative?.trim() ?? "";
    if (narrative.length >= 12) void understandNarrative(narrative);
  }

  function handleStoryAction() {
    if (recording) {
      stopTalking();
      return;
    }
    if (storyReady) {
      finishStory();
      return;
    }
    setStoryFinished(true);
    void understandNarrative(currentNarrative);
  }

  function resultSnapshot(value: ReturnType<typeof calculateScenario>) {
    return {
      classification: value.classification,
      headline: value.headline,
      summary: value.summary,
      activityEnd: value.activityEnd,
      i94AdmitUntilDate: value.i94AdmitUntilDate,
      latestDepartureDate: value.latestDepartureDate,
      findings: value.findings.map(({ id, tone, title, detail }) => ({ id, tone, title, detail })),
      followUpQuestions: value.followUpQuestions
    };
  }

  async function copyTestCase() {
    const { narrative: _privateNarrative, ...scenarioWithoutNarrative } = scenario;
    const payload = {
      purpose: "F-1 Stay Map test case for review",
      privacy: "The voice or typed narrative and personal identifiers are excluded.",
      scenario: scenarioWithoutNarrative,
      primaryResult: resultSnapshot(primaryResult),
      caseEvents: studentCase.events,
      applicableRuleAreas: studentCase.topicEvaluations,
      impactMap,
      stayInUnitedStatesResult: travelResult ? resultSnapshot(result) : undefined,
      advisorReport: report ? { title: report.title, paragraphs: report.paragraphs } : undefined
    };
    try {
      await writeClipboard(JSON.stringify(payload, null, 2));
      setShareNotice("Test case copied. Paste it into Codex with your comments.");
    } catch {
      setShareNotice("The test case could not be copied in this browser.");
    }
  }

  async function shareSummary() {
    const claims = [...impactMap.focusClaims, ...impactMap.otherClaims].flatMap((claim) => [claim.title, claim.detail]);
    const text = [impactMap.headline, impactMap.summary, ...claims, report?.title, ...(report?.paragraphs ?? [])].filter(Boolean).join("\n\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "My F-1 Stay Map", text, url: window.location.href });
        setShareNotice("");
      } else {
        await writeClipboard(text);
        setShareNotice("Summary copied to your clipboard.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareNotice("The summary could not be shared in this browser.");
    }
  }

  function toggleSpeech() {
    if (recording) {
      stopTalking();
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setIntakeNotice("Voice input is not available in this browser. You can type your story here instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += `${text} `;
        else interim += text;
      }
      interimTranscriptRef.current = interim;
      setInterimTranscript(interim);
      if (finalText.trim()) {
        setScenario((current) => {
          const next = { ...current, narrative: `${current.narrative ?? ""} ${finalText}`.trim() };
          latestScenarioRef.current = next;
          return next;
        });
      }
    };
    recognition.onerror = () => {
      recordingRef.current = false;
      setRecording(false);
      setIntakeNotice("Voice input stopped. Your transcript is saved below.");
    };
    recognition.onend = () => {
      recordingRef.current = false;
      setRecording(false);
      const unfinishedPhrase = interimTranscriptRef.current.trim();
      if (unfinishedPhrase) {
        const current = latestScenarioRef.current;
        const next = { ...current, narrative: `${current.narrative ?? ""} ${unfinishedPhrase}`.trim() };
        latestScenarioRef.current = next;
        setScenario(next);
      }
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      const narrative = latestScenarioRef.current.narrative?.trim() ?? "";
      if (narrative.length >= 12) void understandNarrative(narrative);
    };
    recognitionRef.current = recognition;
    recognition.start();
    recordingRef.current = true;
    setRecording(true);
    setStoryFinished(false);
    setIntakeNotice("I am listening. Speak naturally; pauses are fine.");
  }

  async function createReport(
    reportScenario: StudentScenario = scenario,
    conversation: AdvisorTurn[] = followUpTurns,
    reportFocusTopics: IntakeTopic[] = interviewMode === "full" ? impactTopics : focusTopics,
    reportExploreTopics: IntakeTopic[] = interviewMode === "full" ? impactTopics : exploreTopics
  ) {
    reportAbortRef.current?.abort();
    const controller = new AbortController();
    reportAbortRef.current = controller;
    setReportState("loading");
    setReportError("");
    try {
      const reportTopics = canonicalTopics([...reportFocusTopics, ...reportExploreTopics]);
      const reportCase = buildStudentCase(reportScenario, intake?.facts ?? [], reportTopics, intake?.events ?? []);
      const requestBody = JSON.stringify({
        scenario: reportScenario,
        caseEvents: reportCase.events,
        applicableRuleAreas: reportCase.topicEvaluations,
        focusTopics: reportFocusTopics,
        exploredTopics: reportExploreTopics,
        conversation,
        confirmedFacts: completedQuestions.map((question) => ({
          question: question.prompt,
          answer: question.answerLabel ?? "Confirmed"
        }))
      });

      for (let generation = 0; generation < 2; generation += 1) {
        const response = await fetch("/api/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: requestBody,
          signal: controller.signal
        });
        if (!response.ok && response.status !== 202) {
          const errorBody = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          const message = errorBody.detail || errorBody.error || `Report failed: ${response.status}`;
          if (generation === 0) continue;
          throw new Error(message);
        }
        let body = await response.json() as ExplanationResponse | { responseId: string; status: string };
        let shouldRegenerate = false;

        for (let attempt = 0; "responseId" in body && attempt < 120; attempt += 1) {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(resolve, 1500);
            controller.signal.addEventListener("abort", () => {
              window.clearTimeout(timeout);
              reject(new DOMException("Aborted", "AbortError"));
            }, { once: true });
          });
          const poll = await fetch(`/api/explain?responseId=${encodeURIComponent(body.responseId)}`, {
            signal: controller.signal
          });
          if (!poll.ok && poll.status !== 202) {
            const errorBody = await poll.json().catch(() => ({})) as { error?: string; detail?: string };
            const message = errorBody.detail || errorBody.error || `Report failed: ${poll.status}`;
            shouldRegenerate = generation === 0;
            if (shouldRegenerate) break;
            throw new Error(message);
          }
          body = await poll.json() as ExplanationResponse | { responseId: string; status: string };
        }

        if (shouldRegenerate) continue;
        if ("responseId" in body) throw new Error("Report timed out");
        setReport(body);
        setReportState("ready");
        setReportError("");
        return;
      }
      throw new Error("Report did not pass quality checks");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setReportError(error instanceof Error ? error.message : "The advisement request did not complete.");
      setReportState("failed");
    }
  }

  async function askFollowUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = followUpQuestion.trim();
    if (question.length < 3 || followUpState === "loading") return;
    const userTurn: AdvisorTurn = { role: "user", text: question };
    const requestHistory = [...followUpTurns, userTurn];
    setFollowUpTurns(requestHistory);
    setFollowUpState("loading");
    try {
      const advisorTopics: IntakeTopic[] = interviewMode === "full" ? impactTopics : visibleFocusTopics;
      let body: FollowUpResponse | null = null;
      for (let attempt = 0; attempt < 2 && !body; attempt += 1) {
        const response = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scenario,
            question,
            focusTopics: advisorTopics,
            history: followUpTurns,
            caseEvents: studentCase.events,
            applicableRuleAreas: studentCase.topicEvaluations
          })
        });
        if (response.ok) body = await response.json() as FollowUpResponse;
        else if (attempt === 1) throw new Error(`Follow-up failed: ${response.status}`);
      }
      if (!body) throw new Error("Follow-up failed");
      const explicitFacts = body.facts.filter((fact) => !fact.needsConfirmation);
      const nextScenario = mergeFacts(scenario, explicitFacts, true);
      const assistantTurn: AdvisorTurn = { role: "assistant", text: body.answer, sourceIds: body.sourceIds };
      const nextTurns = [...requestHistory, assistantTurn];
      const nextFocusTopics: IntakeTopic[] = interviewMode === "full"
        ? impactTopics
        : [...new Set([...focusTopics, ...body.topics])];
      setFollowUpTurns(nextTurns);
      setFollowUpQuestion("");
      setFollowUpState("ready");
      if (interviewMode === "focused") setFocusTopics(nextFocusTopics);
      if (explicitFacts.length) {
        preserveReportForScenarioUpdateRef.current = true;
        setScenario(nextScenario);
        markFactsAnswered(explicitFacts);
      }
      window.setTimeout(() => void createReport(
        nextScenario,
        nextTurns,
        nextFocusTopics,
        interviewMode === "full" ? impactTopics : exploreTopics
      ), 0);
    } catch {
      setFollowUpState("failed");
    }
  }

  function restart() {
    intakeControllerRef.current?.abort();
    intakeControllerRef.current = null;
    intakeInFlightRef.current = false;
    activeIntakeNarrativeRef.current = "";
    queuedIntakeNarrativeRef.current = null;
    lastUnderstoodNarrativeRef.current = "";
    interimTranscriptRef.current = "";
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recordingRef.current = false;
    clearPlannerSession();
    setScenario(DEFAULT_SCENARIO);
    setAnswered(new Set());
    setIntake(null);
    setUnderstoodNarrative("");
    setIntakeState("idle");
    setIntakeNotice("");
    setFocusTopics([]);
    setFocusCaptured(false);
    setInterviewMode("focused");
    setExploreTopics([]);
    setRecording(false);
    setStoryFinished(false);
    setReport(null);
    setReportState("idle");
    setReportError("");
    setFollowUpQuestion("");
    setFollowUpTurns([]);
    setFollowUpState("idle");
    setShareNotice("");
    setExperience("welcome");
  }

  if (page === "overview") return <WhatHappened onBack={() => navigateOverview(false)} />;

  if (experience === "welcome") {
    return (
      <main className="welcome-screen">
        <nav className="welcome-nav"><strong>F-1 Stay Map</strong><button type="button" onClick={() => navigateOverview(true)}>What happened?</button></nav>
        <section className="welcome-copy">
          <p className="reveal-line line-one">The world has changed for F-1 students.</p>
          <h1 className="reveal-line line-two">An F-1 visa no longer means an open-ended stay.</h1>
          <p className="welcome-detail reveal-line line-three">Tell us your story, and we will show what the new rules mean for you.</p>
          <section className="welcome-gate reveal-line line-four" aria-labelledby="welcome-gate-question">
            <p>One question first</p>
            <h2 id="welcome-gate-question">Will you be in the United States in valid F-1 status on September 15, 2026?</h2>
            <span>This means you will be physically in the United States and your F-1 status will be active that day.</span>
            <div className="presence-options" role="group" aria-label="Your September 15 situation">
              <button type="button" className={scenario.inUsOnEffectiveDate === "yes" ? "selected" : ""} aria-pressed={scenario.inUsOnEffectiveDate === "yes"} onClick={() => answerInitialPresence("yes")}>Yes, I will</button>
              <button type="button" className={scenario.inUsOnEffectiveDate === "no" ? "selected" : ""} aria-pressed={scenario.inUsOnEffectiveDate === "no"} onClick={() => answerInitialPresence("no")}>No, I will not</button>
            </div>
          </section>
          {initialPresenceAnswered && (
            <div className="welcome-actions intake-options">
              <button type="button" className="voice-start" onClick={() => { setExperience("story"); window.setTimeout(toggleSpeech, 0); }}><span className="listening-light" aria-hidden="true" /><Mic aria-hidden="true" /> Start talking</button>
              <button type="button" className="secondary-start" onClick={() => setExperience("story")}><Keyboard aria-hidden="true" /> Type your story</button>
              <button type="button" className="quiet-start" onClick={startFullInterview}>Take the full interview <ArrowRight aria-hidden="true" /></button>
            </div>
          )}
        </section>
        <footer><span>Private by design: no SEVIS ID, passport number, or document upload is needed.</span><span>Rule status checked July 19, 2026</span></footer>
      </main>
    );
  }

  if (experience === "story") {
    return (
      <main className={`story-screen ${currentNarrative ? "has-live-results" : ""} ${storyFinished ? "is-finished" : ""}`}>
        <header className="app-header"><button type="button" className="brand" onClick={restart}>F-1 Stay Map</button><button type="button" className="header-link" onClick={() => navigateOverview(true)}>What happened?</button></header>
        <section className={`story-listening ${recording ? "is-recording" : ""}`}>
          <div className="waveform" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <span key={index} style={{ animationDelay: `${index * 55}ms` }} />)}</div>
          <p className="story-state">{recording ? "Listening" : "Tell me what is happening"}</p>
          <h1>{recording ? "Speak in your own words." : "Talk or type. You do not need to know the legal terms."}</h1>
          <textarea
            autoFocus={!recording}
            value={scenario.narrative ?? ""}
            onChange={(event) => patchScenario({ narrative: event.currentTarget.value })}
            placeholder="For example: I am in the U.S. now. My I-20 ends in May 2031, I hope to use OPT, and I may travel next summer..."
            aria-label="Your F-1 story"
          />
          {interimTranscript && <p className="interim-text">{interimTranscript}</p>}
          <div className="story-controls">
            <button type="button" className="round-control" onClick={toggleSpeech} title={recording ? "Stop listening" : "Start listening"}>{recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}</button>
            <span aria-live="polite">{recording ? (intake ? "Your results are updating as you speak." : "Listening and building your first results...") : intakeNotice || "Do not include a SEVIS ID or passport number."}</span>
            <button type="button" className="finish-story" onClick={handleStoryAction} disabled={!recording && (!currentNarrative || intakeState === "loading")}>
              {storyActionLabel}
              {recording ? <Square aria-hidden="true" /> : intakeState === "loading" ? <RefreshCw className="spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </div>
        </section>
        {scenario.narrative && (
          <section className="story-understanding" ref={storyResultsRef}>
            {intake ? (
              <>
                <div className="understood-facts">
                  <p className="section-eyebrow">What I understand</p>
                  <h2>The details that matter for this rule</h2>
                  <ul className="story-highlights">
                    {storyHighlights.map((highlight) => <li key={highlight}><Check aria-hidden="true" /><span>{highlight}</span></li>)}
                  </ul>
                  {assumesEffectiveDatePresence && (
                    <div className="working-assumption">
                      <CircleHelp aria-hidden="true" />
                      <div><strong>Assuming for now</strong><span>Because your studies continue beyond September 15, I am assuming you will be in the United States in valid F-1 status that day. You can correct this on the next screen.</span></div>
                    </div>
                  )}
                </div>
                <ImpactList map={displayedImpactMap} />
              </>
            ) : (
              <div className="understanding-waiting">
                <RefreshCw className={intakeState === "loading" ? "spin" : ""} aria-hidden="true" />
                <p className="section-eyebrow">Your results will appear here</p>
                <h2>I am listening for dates, plans, travel, work, and study details.</h2>
                <p>The first facts will appear while you are still speaking.</p>
              </div>
            )}
          </section>
        )}
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="brand" onClick={restart}>F-1 Stay Map</button>
        <div><button type="button" className="header-link" onClick={() => navigateOverview(true)}>What happened?</button><button type="button" className="icon-action" onClick={restart} title="Start over"><RotateCcw aria-hidden="true" /></button></div>
      </header>

      <main className="planner-layout">
        <section className="interview-column">
          {interviewMode === "focused" && <ConcernTracker topics={selectedProminentTopics} />}
          {completedQuestions.length > 0 && (
            <div className="answer-history" aria-label="Your answers">
              {completedQuestions.map((question) => (
                <button type="button" key={question.id} onClick={() => editQuestion(question.id)}>
                  <Check aria-hidden="true" />
                  <span><small>{question.eyebrow}</small><strong>{question.answerLabel}</strong></span>
                  <Pencil aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {activeQuestion ? (
            <QuestionCard
              key={activeQuestion.id}
              question={activeQuestion}
              onAnswer={(value) => answer(activeQuestion, value)}
              onDate={(value) => answerDate(activeQuestion, value)}
              onUnknownDate={() => answerDate(activeQuestion, undefined)}
            />
          ) : focusCaptured ? <ExplorationHome fullInterview={interviewMode === "full"} /> : null}

          {focusCaptured && !coreQuestion && (
            <AdvisementAction state={reportState} disabled={contradiction} onCreate={() => void createReport()} />
          )}

          {focusCaptured && !coreQuestion && (
            isCurrent(scenario) && !activeQuestion ? <I94Correction scenario={scenario} onPatch={patchScenario} /> : null
          )}
        </section>

        <aside className="results-column">
          <ImpactList
            map={displayedImpactMap}
            scenario={scenario}
            topics={impactTopics}
            prominentTopics={selectedProminentTopics}
            completedTopics={completedTopics}
            activeTopic={activeImpactTopic}
            fullInterview={interviewMode === "full"}
            onExplore={exploreImpact}
          />
          <div className="result-actions" aria-label="Save or share your results">
            <button type="button" onClick={() => window.print()}><Printer aria-hidden="true" /> Print or save PDF</button>
            <button type="button" onClick={() => void copyTestCase()}><ClipboardCopy aria-hidden="true" /> Copy test case</button>
            <button type="button" onClick={() => void shareSummary()}><Share2 aria-hidden="true" /> Share</button>
          </div>
          {shareNotice && <p className="share-notice" role="status">{shareNotice}</p>}
        </aside>
      </main>

      <section className="timeline-band">
        <div className="band-heading"><p>Your dates, in order</p><h2>See where each rule changes your path</h2></div>
        <Timeline
          title={
            travelResult || result.classification === "transition_ds"
              ? "If you stay in the United States"
              : result.classification === "manual_review"
                ? "September 15 determines which rules apply"
                : "Your dated I-94 timeline"
          }
          subtitle={
            result.classification === "transition_ds"
              ? "This is how long the old rules continue if you do not travel."
              : result.classification === "manual_review"
                ? "Your September 15 location and F-1 status determine which rules apply."
                : "The final point is the date shown on the projected or actual I-94."
          }
          events={stayTimeline}
        />
        {travelResult && <Timeline title="If you leave and return after September 15" subtitle="Your return creates a separate dated I-94. The I-94 issued by CBP controls." events={returnTimeline} />}
      </section>

      {(report || reportState === "loading" || reportState === "failed") && (
        <section className="report-band" aria-live="polite">
          {reportState === "loading" && <div className="report-loading"><RefreshCw className="spin" aria-hidden="true" /><p>Writing your advisement.</p></div>}
          {reportState === "failed" && <div className="report-error"><AlertTriangle aria-hidden="true" /><div><h2>The advisement did not finish.</h2><p>Your work is still here. Try the advisor again without re-entering anything.</p>{reportError && <details><summary>Why this attempt failed</summary><p>{reportError}</p></details>}<button type="button" onClick={() => void createReport()}><RefreshCw aria-hidden="true" /> Try the advisor again</button></div></div>}
          {report && (
            <>
              <article className="advisor-report"><p className="section-eyebrow">Your advisement</p><h2>{report.title}</h2>{report.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<footer><span>Rule status checked July 19, 2026</span></footer></article>
              <AdvisorFollowUp turns={followUpTurns} question={followUpQuestion} state={followUpState} onQuestion={setFollowUpQuestion} onSubmit={askFollowUp} />
            </>
          )}
        </section>
      )}

      <section className="source-band">
        <details>
          <summary>Official sources <ChevronDown aria-hidden="true" /></summary>
          <div className="source-list">{primaryResult.citations.map((citation) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer"><span><strong>{citation.title}</strong><small>{citation.locator}</small></span><ExternalLink aria-hidden="true" /></a>)}</div>
        </details>
      </section>
    </div>
  );
}

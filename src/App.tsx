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
import type { IntakeCandidateFact, IntakeExtractionResponse, IntakeFactField, IntakeTopic } from "./ai/intakePayload";
import { DEFAULT_SCENARIO } from "./content/demoScenarios";
import { calculateScenario, DEFAULT_EFFECTIVE_DATE, scenarioForFixedReentry } from "./engine/calculateScenario";
import { addYears, compareDates, formatDate, isValidDateString } from "./engine/dateMath";
import type {
  AdmissionBasis,
  CptPlan,
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
import { SOURCE_INDEX } from "./sources/sourceIndex";

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
  travel: "Travel",
  opt: "OPT",
  stem_opt: "STEM OPT",
  cpt: "CPT",
  extension: "Extending your stay",
  school_transfer: "School transfer",
  program_change: "Program change",
  change_of_status: "Change to F-1 status"
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
  dsoRecommendedOpt: "DSO OPT recommendation",
  hasF2Dependents: "F-2 dependents",
  earlyEndSituation: "Early end or withdrawal",
  earlyEndDate: "Actual end date",
  returningAfterEffectiveDate: "Return after September 15, 2026",
  cptPlan: "CPT timing"
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
  "earlyEndDate"
]);

const allowedFactValues: Partial<Record<IntakeFactField, readonly string[]>> = {
  startingPosition: ["current_ds_inside_us", "prospective_outside_us", "change_status_inside_us", "readmitted_fixed_period", "transfer_or_program_change", "unknown"],
  admissionBasis: ["duration_of_status", "fixed_period", "unknown"],
  inUsOnEffectiveDate: ["yes", "no", "unknown"],
  maintainingStatusOnEffectiveDate: ["yes", "no", "unknown"],
  departBeforeEffectiveDate: ["yes", "no", "unknown"],
  optStage: ["none", "pre_completion", "post_completion_not_filed", "post_completion_pending", "post_completion_approved", "stem_not_filed", "stem_pending", "stem_approved"],
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
  cptPlan: ["none", "before_admission_end", "after_admission_end", "unknown"]
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
  hasF2Dependents: { yes: "Yes", no: "No", unknown: "Not yet known" },
  earlyEndSituation: { none: "No", completed_early: "Completed early", authorized_withdrawal: "Authorized withdrawal", status_violation: "Possible status violation", unknown: "Not yet known" },
  cptPlan: { none: "No CPT", before_admission_end: "CPT before the study period ends", after_admission_end: "CPT near or after the study period ends", unknown: "Timing not yet known" }
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
  if (fact.value === "yes") return "Yes";
  if (fact.value === "no") return "No";
  if (fact.value === "unknown") return "Not yet known";
  return factValueLabels[fact.field]?.[fact.value] ?? fact.value.replaceAll("_", " ");
}

export function mergeFacts(current: StudentScenario, facts: IntakeCandidateFact[], lockPresence = false): StudentScenario {
  let next = { ...current } as StudentScenario;
  for (const fact of usableFacts(facts)) {
    if (lockPresence && ["inUsOnEffectiveDate", "maintainingStatusOnEffectiveDate", "admissionBasis"].includes(fact.field)) continue;
    if (
      lockPresence &&
      fact.field === "startingPosition" &&
      (current.inUsOnEffectiveDate === "yes" || !["prospective_outside_us", "change_status_inside_us"].includes(fact.value))
    ) continue;
    next = { ...next, [fact.field]: fact.value } as StudentScenario;
    if (fact.field === "optStage" && fact.value !== "none") next.optIntent = "yes";
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
  return { ...next, narrative: current.narrative };
}

function isCurrent(scenario: StudentScenario): boolean {
  return scenario.startingPosition === "current_ds_inside_us";
}

function isFuture(scenario: StudentScenario): boolean {
  return scenario.startingPosition === "prospective_outside_us" || scenario.startingPosition === "change_status_inside_us";
}

const optStageLabels: Record<OptStage, string> = {
  none: "Future OPT plan",
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
  return compareDates(programEnd, addYears(today, 1)) <= 0;
}

function appendTravelQuestions(scenario: StudentScenario, answered: Set<string>, questions: Question[], raisedByStudent: boolean): boolean {
  questions.push({
    id: "travelIntent",
    eyebrow: raisedByStudent ? "Your travel question" : "Travel",
    prompt: raisedByStudent ? "You mentioned travel. Are you planning to leave the United States?" : "Are you planning to travel outside the United States?",
    help: raisedByStudent ? "I saved this from your story. These questions show exactly when travel changes your answer." : undefined,
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
        help: "Your return puts you under the new rules. The date helps place that change on your timeline.",
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
        help: "If it is the same I-20, I will keep the program end date you already gave. If it is new or updated, its dates may produce a different I-94 end date.",
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
          help: "I already have your program end date. I need the start date because the new four-year maximum is measured from the I-20 program start, not from the day you return.",
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
          help: "I am asking again only because you said this will be a different I-20. Its end date replaces the earlier date for the return calculation.",
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

function buildQuestions(scenario: StudentScenario, answered: Set<string>, raisedTopics: IntakeTopic[], protectedStudyEnd?: string): Question[] {
  const questions: Question[] = [
    {
      id: "presence",
      eyebrow: "First, one date",
      prompt: "Will you be in the United States in valid F-1 status on September 15, 2026?",
      help: "This one answer decides whether the old D/S rules can continue for you.",
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
          help: "You said you will not be here in valid F-1 status on September 15, but your entry date is before that day.",
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
    questions.push({ id: "programStart", eyebrow: "Your I-20", prompt: "What program start date will be on your I-20?", kind: "date", value: scenario.programStartDate, answerLabel: scenario.programStartDate ? formatDate(scenario.programStartDate) : "I do not know yet", allowUnknownDate: true });
    if (!answered.has("programStart")) return questions;
  }

  questions.push({
    id: "programEnd",
    eyebrow: "Your I-20",
    prompt: isCurrent(scenario)
      ? "What program end date do you expect to have on your I-20 on September 15, 2026?"
      : "What program end date will be on your I-20?",
    kind: "date",
    value: isCurrent(scenario) ? scenario.programEndOnEffectiveDate : scenario.currentProgramEndDate,
    answerLabel: (isCurrent(scenario) ? scenario.programEndOnEffectiveDate : scenario.currentProgramEndDate)
      ? formatDate((isCurrent(scenario) ? scenario.programEndOnEffectiveDate : scenario.currentProgramEndDate)!)
      : "I do not know yet",
    allowUnknownDate: true
  });
  if (!answered.has("programEnd")) return questions;

  const prioritizeTravel = isCurrent(scenario) && raisedTopics.includes("travel");
  if (prioritizeTravel && !appendTravelQuestions(scenario, answered, questions, true)) return questions;

  if (isFuture(scenario)) {
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
  }

  questions.push({
    id: "educationLevel",
    eyebrow: "Education level",
    prompt: "Is your program undergraduate or graduate level?",
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
    id: "optIntent",
    eyebrow: "Work after your program",
    prompt: "Are you planning to apply for post-completion OPT after this program?",
    help: "Regular post-completion OPT comes first. If your degree and job qualify, STEM OPT is a possible extension later.",
    kind: "choice",
    choices: yesNoUnknown,
    value: scenario.optIntent,
    answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.optIntent ?? "unknown"]
  });
  if (!answered.has("optIntent")) return questions;

  if (scenario.optIntent === "yes" && scenario.optStage !== "pre_completion" && shouldAskOptApplicationQuestions(scenario)) {
    questions.push({
      id: "optStatus",
      eyebrow: "Only because OPT is getting closer",
      prompt: "Where are you in the OPT process now?",
      help: "STEM OPT appears here only as an extension after regular post-completion OPT.",
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
      questions.push({ id: "dsoRecommendation", eyebrow: "School recommendation", prompt: "Has your DSO recommended this OPT in SEVIS?", help: "This is the step your international student advisor completes before you file Form I-765.", kind: "choice", choices: yesNoUnknown, value: scenario.dsoRecommendedOpt, answerLabel: factValueLabels.dsoRecommendedOpt?.[scenario.dsoRecommendedOpt ?? "unknown"] });
      if (!answered.has("dsoRecommendation")) return questions;
    }
    if (scenario.optStage.endsWith("not_filed") || scenario.optStage.endsWith("pending")) {
      questions.push({ id: "optFilingDate", eyebrow: "I-765 timing", prompt: "When did you file, or when do you plan to file, Form I-765?", help: isCurrent(scenario) ? "This date tells us whether you can use the special stay-in-the-United-States OPT path without filing a separate extension of stay only because D/S ended." : undefined, kind: "date", value: scenario.optFilingDate, answerLabel: scenario.optFilingDate ? formatDate(scenario.optFilingDate) : "I do not know yet", allowUnknownDate: true });
      if (!answered.has("optFilingDate")) return questions;
    }
    if (scenario.optStage.endsWith("approved")) {
      questions.push({ id: "eadEndDate", eyebrow: "Your EAD", prompt: "What expiration date is on your EAD?", kind: "date", value: scenario.currentEadEndDate, answerLabel: scenario.currentEadEndDate ? formatDate(scenario.currentEadEndDate) : "I do not know yet", allowUnknownDate: true });
      if (!answered.has("eadEndDate")) return questions;
    }
  }

  if (isCurrent(scenario) && !prioritizeTravel && !appendTravelQuestions(scenario, answered, questions, false)) return questions;

  questions.push({ id: "schoolTransfer", eyebrow: "School plans", prompt: "Are you planning to transfer to a different school?", kind: "choice", choices: yesNoUnknown, value: scenario.schoolTransferPlan, answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.schoolTransferPlan ?? "unknown"] });
  if (!answered.has("schoolTransfer")) return questions;
  questions.push({ id: "programChange", eyebrow: "Program plans", prompt: "Are you planning to change your major or education level during this program?", kind: "choice", choices: yesNoUnknown, value: scenario.academicProgramChangePlan, answerLabel: factValueLabels.inUsOnEffectiveDate?.[scenario.academicProgramChangePlan ?? "unknown"] });
  if (!answered.has("programChange")) return questions;

  if (scenario.educationLevel === "undergraduate" && (scenario.schoolTransferPlan === "yes" || scenario.academicProgramChangePlan === "yes")) {
    questions.push({ id: "firstAcademicYear", eyebrow: "First academic year", prompt: "Will you have completed one academic year before the transfer or program change?", kind: "choice", choices: yesNoUnknown, value: scenario.firstAcademicYearCompleted, answerLabel: factValueLabels.firstAcademicYearCompleted?.[scenario.firstAcademicYearCompleted ?? "unknown"] });
    if (!answered.has("firstAcademicYear")) return questions;
  }

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

  questions.push({ id: "cptIntent", eyebrow: "Work during your program", prompt: "Are you planning to use CPT?", kind: "choice", choices: yesNoUnknown, value: scenario.cptPlan === "none" ? "no" : scenario.cptPlan === "unknown" ? "unknown" : "yes", answerLabel: scenario.cptPlan === "none" ? "No" : scenario.cptPlan === "unknown" ? "I do not know yet" : "Yes" });
  if (!answered.has("cptIntent")) return questions;
  if (scenario.cptPlan !== "none" && scenario.cptPlan !== "unknown") {
    questions.push({
      id: "cptTiming",
      eyebrow: "CPT timing",
      prompt: protectedStudyEnd
        ? `Could you still be using CPT after ${formatDate(protectedStudyEnd)}?`
        : "Could your CPT continue past the end date shown for your authorized study period?",
      help: "This tells us whether you need to file an extension early enough to avoid a break in authorized work.",
      kind: "choice",
      choices: [{ value: "after_admission_end", label: "Yes" }, { value: "before_admission_end", label: "No" }, { value: "unknown", label: "I do not know yet" }],
      value: scenario.cptPlan,
      answerLabel: factValueLabels.cptPlan?.[scenario.cptPlan]
    });
  }
  return questions;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function DateAnswer({ value, onComplete, onUnknown }: { value?: string; onComplete: (value: string) => void; onUnknown?: () => void }) {
  const initial = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [month, setMonth] = useState(initial ? String(Number(initial[2])) : "");
  const [day, setDay] = useState(initial ? String(Number(initial[3])) : "");
  const [year, setYear] = useState(initial?.[1] ?? "");
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

function ConcernTracker({ topics }: { topics: IntakeTopic[] }) {
  const visibleTopics = topics.filter((topic, index) => {
    if (topic === "opt" && topics.includes("stem_opt")) return false;
    return topics.indexOf(topic) === index;
  });
  if (!visibleTopics.length) return null;

  return (
    <section className="concern-tracker" aria-label="Questions from your story">
      <strong>Your questions</strong>
      <ul>
        {visibleTopics.map((topic) => <li key={topic}>{topicLabels[topic]}</li>)}
      </ul>
    </section>
  );
}

function TravelDifference({ scenario, travelResult, hasTravelConcern }: { scenario: StudentScenario; travelResult: ReturnType<typeof calculateScenario> | null; hasTravelConcern: boolean }) {
  if (!isCurrent(scenario) || !hasTravelConcern || scenario.travelPosture === "none") return null;

  if (travelResult) {
    return (
      <section className="difference-maker warning">
        <AlertTriangle aria-hidden="true" />
        <div>
          <p>The choice that changes your result</p>
          <h3>Your planned return puts you under the new rules.</h3>
          <span>
            You said at least one trip will bring you back after September 15, 2026{scenario.reentryDate ? `, on ${formatDate(scenario.reentryDate)}` : ""}. The fixed-period result below is your main path. The old-rule timeline applies only if you stay in the United States.
          </span>
          {scenario.optIntent === "yes" && scenario.optStage.endsWith("not_filed") && (
            <strong className="micro-recommendation">Before you travel, ask your DSO to compare getting the OPT recommendation and filing Form I-765 in the United States with the I-765 and Form I-539 process after a fixed-period return.</strong>
          )}
        </div>
      </section>
    );
  }

  const confirmedPostRuleReturn = scenario.returningAfterEffectiveDate === "yes";
  const noPostRuleReturn = scenario.travelPosture !== "unknown" && scenario.returningAfterEffectiveDate === "no";
  return (
    <section className="difference-maker info">
      <Info aria-hidden="true" />
      <div>
        <p>Travel changes the rule</p>
        <h3>{confirmedPostRuleReturn ? "Your planned return puts you under the new rules." : noPostRuleReturn ? "Your current travel plan does not end the old-rule path." : "Any return after September 15 puts you under the new rules."}</h3>
        <span>{confirmedPostRuleReturn ? "Add the dates from the I-20 you will use to return so your fixed-period timeline can be calculated. Until then, the old-rule result below is only the alternative if you stay in the United States." : noPostRuleReturn ? "You said no trip will bring you back after September 15, 2026. If that changes, update this answer before relying on your result." : "Tell us whether any planned trip brings you back after that date so the return timeline can be calculated."}</span>
        {scenario.optIntent === "yes" && !noPostRuleReturn && <strong className="micro-recommendation">Your travel date and OPT filing date need to be planned together.</strong>}
      </div>
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
    <a className="source-link" href={citation.url} target="_blank" rel="noreferrer" title={citation.locator}>
      View source
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function ImpactList({ result, provisional = false }: { result: ReturnType<typeof calculateScenario>; provisional?: boolean }) {
  const visible = result.findings.filter((item) => !item.id.startsWith("date-") && item.id !== "transition-protection");
  return (
    <section className="impact-area" aria-live="polite">
      <div className="impact-heading">
        <div>
          <p>{provisional ? "From what I understand so far" : "How this affects you"}</p>
          <h2>{result.headline}</h2>
        </div>
        {provisional && <span>Draft</span>}
      </div>
      <p className="impact-summary">{result.summary}</p>
      <div className="impact-list">
        {visible.map((item) => (
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
    </section>
  );
}

function Timeline({ title, subtitle, events }: { title: string; subtitle: string; events: TimelineItem[] }) {
  if (!events.length) return null;
  return (
    <section className="visual-timeline">
      <header>
        <CalendarDays aria-hidden="true" />
        <div><h3>{title}</h3><p>{subtitle}</p></div>
      </header>
      <div className="timeline-track" style={{ "--event-count": events.length } as React.CSSProperties}>
        {events.map((event, index) => (
          <div className={`timeline-event ${event.tone}`} key={`${event.date}-${event.title}-${index}`}>
            <time dateTime={event.date}>{formatDate(event.date)}</time>
            <span className="timeline-dot" aria-hidden="true" />
            <h4>{event.title}</h4>
            <p>{event.detail}</p>
          </div>
        ))}
      </div>
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
        <h2>Current students receive transition protection</h2>
        <p>If you are in the United States in valid F-1 status with D/S on September 15, 2026, you can remain under the old rules through the later I-20 or EAD end date in place that day, up to September 15, 2030, followed by 60 days. Leaving and returning after the rule begins moves you into the fixed-period system.</p>
        <h2>New admissions receive a dated I-94</h2>
        <p>The normal fixed period covers the I-20 program dates for no more than four years. The four-year maximum starts with the I-20 program start date, not the date you physically enter. The I-94 also includes 30 days after the study or training period, reducing the ordinary post-completion period from 60 days to 30.</p>
        <h2>Longer plans may require Form I-539</h2>
        <p>If your program or authorized training continues beyond the first fixed period, you may need to ask USCIS for an extension of stay. The filing can require a new DSO-endorsed I-20, financial evidence, a fee, and biometrics. USCIS must receive a timely filing by the I-94 date, but work authorization can be interrupted if the request arrives only during the final 30 days.</p>
        <h2>School and program choices also change</h2>
        <p>The rule adds limits on first-year undergraduate transfers and program changes, graduate transfers and changes of educational objective, and later programs at the same or a lower education level. DHS can delay these particular provisions through September 14, 2028 and must announce a delay publicly.</p>
        <div className="article-links">
          <a href={SOURCE_INDEX["FR-2026-FINAL-RULE"].url} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /><span><strong>Read the official final rule</strong><small>Federal Register, July 17, 2026</small></span><ExternalLink aria-hidden="true" /></a>
          <a href={SOURCE_INDEX["NAFSA-DS-FINAL-RULE-HUB"].url} target="_blank" rel="noreferrer"><Info aria-hidden="true" /><span><strong>Read NAFSA's public overview</strong><small>Regulatory analysis and updates</small></span><ExternalLink aria-hidden="true" /></a>
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

export default function App() {
  const [page, setPage] = useState<Page>(() => window.location.hash === "#what-happened" ? "overview" : "planner");
  const [experience, setExperience] = useState<Experience>("welcome");
  const [scenario, setScenario] = useState<StudentScenario>(DEFAULT_SCENARIO);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [intake, setIntake] = useState<IntakeExtractionResponse | null>(null);
  const [intakeState, setIntakeState] = useState<IntakeState>("idle");
  const [intakeNotice, setIntakeNotice] = useState("");
  const [understoodNarrative, setUnderstoodNarrative] = useState("");
  const [recording, setRecording] = useState(false);
  const [storyFinished, setStoryFinished] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [report, setReport] = useState<ExplanationResponse | null>(null);
  const [reportState, setReportState] = useState<ReportState>("idle");
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
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    reportAbortRef.current?.abort();
    setReport(null);
    setReportState("idle");
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
  const raisedTopics = useMemo(() => intake?.topics ?? [], [intake]);
  const hasTravelConcern = raisedTopics.includes("travel") || activeScenario.travelPosture === "planned" || activeScenario.travelPosture === "completed";
  const questions = useMemo(() => buildQuestions(scenario, answered, raisedTopics, result.activityEnd), [scenario, answered, raisedTopics, result.activityEnd]);
  const activeQuestion = questions.find((question) => !answered.has(question.id));
  const completedQuestions = questions.filter((question) => answered.has(question.id));
  const contradiction = result.findings.some((item) => item.id === "future-entry-before-effective-date-contradiction");
  const currentNarrative = scenario.narrative?.trim() ?? "";
  const storyReady = Boolean(intake && intakeState === "ready" && understoodNarrative === currentNarrative);
  const storyHighlights = intake?.highlights?.length
    ? intake.highlights
    : intake
      ? usableFacts(intake.facts).slice(0, 6).map((fact) => `${factLabels[fact.field]}: ${displayFactValue(fact)}`)
      : [];
  const assumesEffectiveDatePresence = !answered.has("presence") && Boolean(intake?.facts.some((fact) => fact.field === "inUsOnEffectiveDate" && fact.value === "yes" && fact.needsConfirmation));
  const extensionRelevant = Boolean(
    primaryResult.extensionNeededBy ||
    primaryResult.extensionPlanningDate ||
    primaryResult.extensionFilingDeadline ||
    primaryResult.findings.some((finding) => finding.id.includes("extension-needed"))
  );
  const storyActionLabel = recording
    ? "I am done talking"
    : intakeState === "loading"
      ? "Finishing your results"
      : storyReady
        ? "Continue"
        : intakeState === "failed"
          ? "Try understanding again"
          : "Understand my story";

  function navigateOverview(show: boolean) {
    window.location.hash = show ? "what-happened" : "";
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
      case "dsoRecommendation": patch.dsoRecommendedOpt = value as YesNoUnknown; break;
      case "travelIntent":
        patch.travelPosture = value as TravelPosture;
        break;
      case "returnAfterRule": patch.returningAfterEffectiveDate = value as YesNoUnknown; break;
      case "travelI20": patch.reentryBasis = value as ReentryBasis; break;
      case "schoolTransfer": patch.schoolTransferPlan = value as YesNoUnknown; patch.transferOrProgramChange = value === "yes" || scenario.academicProgramChangePlan === "yes" ? "yes" : "no"; break;
      case "programChange": patch.academicProgramChangePlan = value as YesNoUnknown; patch.transferOrProgramChange = value === "yes" || scenario.schoolTransferPlan === "yes" ? "yes" : "no"; break;
      case "firstAcademicYear": patch.firstAcademicYearCompleted = value as YesNoUnknown; break;
      case "nextProgram": patch.nextProgramLevelPlan = value as NextProgramLevelPlan; break;
      case "cptIntent": patch.cptPlan = value === "yes" ? "before_admission_end" : value === "no" ? "none" : "unknown"; break;
      case "cptTiming": patch.cptPlan = value as CptPlan; break;
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
        if (isCurrent(scenario)) patch.programEndOnEffectiveDate = value;
        break;
      case "optFilingDate": patch.optFilingDate = value; break;
      case "eadEndDate": patch.currentEadEndDate = value; break;
    }
    patchScenario(patch);
    setAnswered((current) => new Set(current).add(question.id));
  }

  function resetQuestionValue(id: string, draft: StudentScenario): StudentScenario {
    const next = { ...draft };
    if (id === "presence") {
      next.inUsOnEffectiveDate = "unknown";
      next.maintainingStatusOnEffectiveDate = "unknown";
      next.admissionBasis = "unknown";
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
    if (id === "programEnd") { next.programEndOnEffectiveDate = undefined; next.currentProgramEndDate = undefined; }
    if (id === "programType") next.programType = "unknown";
    if (id === "educationLevel") next.educationLevel = "unknown";
    if (id === "optIntent") next.optIntent = "unknown";
    if (id === "optStatus") next.optStage = "none";
    if (id === "dsoRecommendation") next.dsoRecommendedOpt = "unknown";
    if (id === "optFilingDate") next.optFilingDate = undefined;
    if (id === "eadEndDate") next.currentEadEndDate = undefined;
    if (id === "travelIntent") next.travelPosture = "unknown";
    if (id === "returnAfterRule") next.returningAfterEffectiveDate = "unknown";
    if (id === "travelI20") next.reentryBasis = "unknown";
    if (id === "schoolTransfer") next.schoolTransferPlan = "unknown";
    if (id === "programChange") next.academicProgramChangePlan = "unknown";
    if (id === "firstAcademicYear") next.firstAcademicYearCompleted = "unknown";
    if (id === "nextProgram") next.nextProgramLevelPlan = "unknown";
    if (id === "cptIntent" || id === "cptTiming") next.cptPlan = "none";
    return next;
  }

  function editQuestion(id: string) {
    setScenario((current) => resetQuestionValue(id, current));
    setAnswered((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
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
      cptPlan: ["cptIntent", "cptTiming"]
    };
    const mapped = usableFacts(facts).flatMap((fact) => {
      if (fact.field === "optStage") {
        return fact.value === "none" ? [] : ["optIntent", "optStatus"];
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
    const text = [primaryResult.headline, primaryResult.summary, report?.title, ...(report?.paragraphs ?? [])].filter(Boolean).join("\n\n");
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

  async function createReport() {
    reportAbortRef.current?.abort();
    const controller = new AbortController();
    reportAbortRef.current = controller;
    setReportState("loading");
    setReport(null);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Report failed: ${response.status}`);
      setReport(await response.json() as ExplanationResponse);
      setReportState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setReportState("failed");
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
    setScenario(DEFAULT_SCENARIO);
    setAnswered(new Set());
    setIntake(null);
    setUnderstoodNarrative("");
    setIntakeState("idle");
    setIntakeNotice("");
    setRecording(false);
    setStoryFinished(false);
    setReport(null);
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
              <button type="button" className="quiet-start" onClick={() => setExperience("interview")}>Answer a few questions <ArrowRight aria-hidden="true" /></button>
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
                <TravelDifference scenario={activeScenario} travelResult={travelResult} hasTravelConcern={hasTravelConcern} />
                <ImpactList result={primaryResult} provisional />
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
          <ConcernTracker topics={raisedTopics} />
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
          ) : (
            <section className="question-card complete-card">
              <p className="question-kicker">Your answers are ready</p>
              <h2>Review how the rule affects you, then create your advisor report.</h2>
              <p className="question-help">You can change any answer above. The dates and cards update immediately.</p>
              <button type="button" className="primary-command" onClick={createReport} disabled={reportState === "loading" || contradiction}>
                {reportState === "loading" ? <RefreshCw className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                {reportState === "loading" ? "Writing your report" : "Create my advisement"}
              </button>
              {contradiction && <p className="field-error">Resolve the highlighted date conflict before creating the report.</p>}
            </section>
          )}

          <details className="uncommon-details">
            <summary>What else could affect this? <ChevronDown aria-hidden="true" /></summary>
            <div className="uncommon-grid">
              {isCurrent(scenario) && (
                <div className="uncommon-field">
                  <label>
                    <span>Most current F-1 I-94 records say D/S. Does yours show a date instead?</span>
                    <select value={scenario.admissionBasis} onChange={(event) => patchScenario({ admissionBasis: event.currentTarget.value as AdmissionBasis, i94AdmitUntilDate: event.currentTarget.value === "fixed_period" ? scenario.i94AdmitUntilDate : undefined })}>
                      <option value="duration_of_status">No, it says D/S</option>
                      <option value="fixed_period">Yes, it has a date</option>
                      <option value="unknown">I need to check</option>
                    </select>
                  </label>
                  {scenario.admissionBasis === "fixed_period" && <DateAnswer value={scenario.i94AdmitUntilDate} onComplete={(value) => patchScenario({ i94AdmitUntilDate: value })} />}
                </div>
              )}
              {(extensionRelevant || scenario.hasF2Dependents === "yes") && <label><span>If you need an extension, will an F-2 spouse or child need one too?</span><select value={scenario.hasF2Dependents ?? "unknown"} onChange={(event) => patchScenario({ hasF2Dependents: event.currentTarget.value as YesNoUnknown })}><option value="unknown">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>}
              <div className="uncommon-field"><label><span>Will this program end early, or did you withdraw?</span><select value={scenario.earlyEndSituation ?? "none"} onChange={(event) => patchScenario({ earlyEndSituation: event.currentTarget.value as StudentScenario["earlyEndSituation"], earlyEndDate: event.currentTarget.value === "none" ? undefined : scenario.earlyEndDate })}><option value="none">No</option><option value="completed_early">Completed early</option><option value="authorized_withdrawal">Authorized withdrawal</option><option value="status_violation">Possible status violation</option><option value="unknown">I need help deciding</option></select></label>{scenario.earlyEndSituation && scenario.earlyEndSituation !== "none" && scenario.earlyEndSituation !== "status_violation" && <DateAnswer value={scenario.earlyEndDate} onComplete={(value) => patchScenario({ earlyEndDate: value })} />}</div>
              {scenario.travelPosture !== "none" && (extensionRelevant || scenario.pendingExtensionOnDeparture !== "unknown") && <label><span>Will you have already filed an extension of stay (Form I-539) when you leave?</span><select value={scenario.pendingExtensionOnDeparture} onChange={(event) => patchScenario({ pendingExtensionOnDeparture: event.currentTarget.value as YesNoUnknown })}><option value="unknown">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></label>}
            </div>
          </details>
        </section>

        <aside className="results-column">
          <TravelDifference scenario={scenario} travelResult={travelResult} hasTravelConcern={hasTravelConcern} />
          <ImpactList result={primaryResult} />
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
                ? "The date that decides your first path"
                : "Your fixed-period timeline"
          }
          subtitle={
            result.classification === "transition_ds"
              ? "This preserves the old D/S transition path."
              : result.classification === "manual_review"
                ? "More points appear as each date is confirmed."
                : "The final point is the date shown on the projected or actual I-94."
          }
          events={result.timeline}
        />
        {travelResult && <Timeline title="If you leave and return after September 15" subtitle="This is a separate fixed-period projection. The I-94 issued after you return controls." events={travelResult.timeline} />}
      </section>

      {(report || reportState === "loading" || reportState === "failed") && (
        <section className="report-band" aria-live="polite">
          {reportState === "loading" && <div className="report-loading"><RefreshCw className="spin" aria-hidden="true" /><p>Your advisor note is being written from the verified dates and rule findings.</p></div>}
          {reportState === "failed" && <div className="report-error"><AlertTriangle aria-hidden="true" /><div><h2>The report did not finish.</h2><p>Your dated results above are unchanged. Check the OpenAI connection, then try the report again.</p><button type="button" onClick={createReport}><RefreshCw aria-hidden="true" /> Try again</button></div></div>}
          {report && <article className="advisor-report"><p className="section-eyebrow">Your advisement</p><h2>{report.title}</h2>{report.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<footer><span>Prepared with {report.model ?? "OpenAI"}</span><span>Rule status checked July 19, 2026</span></footer></article>}
        </section>
      )}

      <section className="source-band">
        <details>
          <summary>Sources used for this result <ChevronDown aria-hidden="true" /></summary>
          <div className="source-list">{primaryResult.citations.map((citation) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer"><span><strong>{citation.title}</strong><small>{citation.locator}</small></span><ExternalLink aria-hidden="true" /></a>)}</div>
        </details>
      </section>
    </div>
  );
}

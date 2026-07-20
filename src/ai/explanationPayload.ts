import type { StudentScenario } from "../engine/types";
import type { CaseEvent, CaseTopicEvaluation } from "../case/studentCase";
import type { IntakeTopic } from "./intakePayload";
import type { AdvisorTurn } from "./followUpPayload";

export interface ExplanationRequest {
  scenario: StudentScenario;
  focusTopics?: IntakeTopic[];
  exploredTopics?: IntakeTopic[];
  conversation?: AdvisorTurn[];
  confirmedFacts?: Array<{ question: string; answer: string }>;
  caseEvents?: CaseEvent[];
  applicableRuleAreas?: CaseTopicEvaluation[];
}

export interface ExplanationResponse {
  title: string;
  paragraphs: string[];
  model?: string;
}

const REPORT_PROCESS_LANGUAGE = /(?:malformed json|proper (?:json )?object|let(?:'s| us) produce|need (?:a )?correct final|word count|paragraphs? array|structured output|title perhaps|\boops\b|\}\]\})/i;
const MARKDOWN_FORMATTING = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```)|\*\*|__|`/m;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasInvalidAdvisorProse(text: string, maxWords: number): boolean {
  return REPORT_PROCESS_LANGUAGE.test(text) || MARKDOWN_FORMATTING.test(text) || wordCount(text) > maxWords;
}

export function hasInvalidReportContent(report: Pick<ExplanationResponse, "title" | "paragraphs">): boolean {
  const text = [report.title, ...report.paragraphs].join("\n");
  const normalizedParagraphs = report.paragraphs.map((paragraph) => paragraph.trim().toLowerCase());
  return (
    hasInvalidAdvisorProse(text, 800) ||
    new Set(normalizedParagraphs).size !== normalizedParagraphs.length
  );
}

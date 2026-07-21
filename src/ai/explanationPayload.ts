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
  sections: AdvisorSection[];
  model?: string;
}

export interface AdvisorSection {
  heading: string;
  body: string;
}

const REPORT_PROCESS_LANGUAGE = /(?:malformed json|proper (?:json )?object|let(?:'s| us) produce|need (?:a )?correct final|word count|paragraphs? array|structured output|title perhaps|\boops\b|\}\]\})/i;
const MARKDOWN_FORMATTING = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```)|\*\*|__|`/m;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hasInvalidAdvisorProse(text: string, maxWords: number): boolean {
  return REPORT_PROCESS_LANGUAGE.test(text) || MARKDOWN_FORMATTING.test(text) || wordCount(text) > maxWords;
}

export function hasInvalidReportContent(report: Pick<ExplanationResponse, "title" | "sections">): boolean {
  const text = [report.title, ...report.sections.flatMap((section) => [section.heading, section.body])].join("\n");
  const normalizedHeadings = report.sections.map((section) => section.heading.trim().toLowerCase());
  const normalizedBodies = report.sections.map((section) => section.body.trim().toLowerCase());
  return (
    hasInvalidAdvisorProse(text, 650) ||
    new Set(normalizedHeadings).size !== normalizedHeadings.length ||
    new Set(normalizedBodies).size !== normalizedBodies.length ||
    report.sections.some((section) => section.body.includes("\n"))
  );
}

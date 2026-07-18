import type { IntakeExtractionRequest, IntakeExtractionResponse } from "../../src/ai/intakePayload";
import { DEFAULT_EFFECTIVE_DATE } from "../../src/engine/calculateScenario";

const DEFAULT_MODEL = "gpt-5.6-luna";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function extractOutputText(data: unknown): string {
  const response = data as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text)
      .join("\n")
      .trim() ?? ""
  );
}

function buildPrompt(payload: IntakeExtractionRequest): string {
  return JSON.stringify(
    {
      task:
        "Extract candidate facts from an F-1 student's narrative for a deterministic fixed-period admission planner. Do not calculate legal results, deadlines, or status outcomes.",
      appKnownFacts: {
        ruleEffectiveDate: DEFAULT_EFFECTIVE_DATE
      },
      hardRules: [
        "Return only facts that are directly supported by the student's words.",
        "Use low confidence and needsConfirmation=true when the student's meaning is plausible but not explicit.",
        "Dates must be YYYY-MM-DD only when the student gives a full unambiguous date, such as May 15, 2031 or 2031-05-15.",
        "Do not convert numeric slash dates like 6/2/2029 because date order differs by country.",
        "Do not invent a day when the student gives only a month and year.",
        "A graduation/program-completion date is not an OPT filing date, OPT start date, or EAD end date unless the student says so.",
        "If the student gives the active I-20/program end date and does not mention a different I-20 before the rule effective date, return currentProgramEndDate and also return programEndOnEffectiveDate with needsConfirmation=true.",
        "For incoming students outside the United States, use startingPosition=prospective_outside_us, admissionBasis=fixed_period, and inUsOnEffectiveDate=no only if the narrative supports it.",
        "For current students in the United States on D/S, use startingPosition=current_ds_inside_us and admissionBasis=duration_of_status only if the narrative supports it.",
        "If the narrative mentions travel but not how the student will return, use travelPosture=planned and reentryBasis=unknown.",
        "Prefer follow-up questions over overconfident extraction."
      ],
      allowedFields: {
        startingPosition: ["current_ds_inside_us", "prospective_outside_us", "readmitted_fixed_period", "transfer_or_program_change", "unknown"],
        admissionBasis: ["duration_of_status", "fixed_period", "unknown"],
        inUsOnEffectiveDate: ["yes", "no", "unknown"],
        maintainingStatusOnEffectiveDate: ["yes", "no", "unknown"],
        programEndOnEffectiveDate: "YYYY-MM-DD",
        currentProgramEndDate: "YYYY-MM-DD",
        eadEndOnEffectiveDate: "YYYY-MM-DD",
        currentEadEndDate: "YYYY-MM-DD",
        optStage: [
          "none",
          "pre_completion",
          "post_completion_not_filed",
          "post_completion_pending",
          "post_completion_approved",
          "stem_not_filed",
          "stem_pending",
          "stem_approved"
        ],
        optFilingDate: "YYYY-MM-DD",
        travelPosture: ["none", "planned", "completed", "automatic_visa_revalidation", "unknown"],
        reentryDate: "YYYY-MM-DD",
        reentryBasis: ["same_i20_balance", "new_f1_admission", "longer_program_i20", "automatic_visa_revalidation", "unknown"],
        pendingExtensionOnDeparture: ["yes", "no", "unknown"],
        transferOrProgramChange: ["yes", "no", "unknown"],
        cptPlan: ["none", "before_admission_end", "after_admission_end", "unknown"]
      },
      currentScenario: payload.currentScenario,
      studentNarrative: payload.narrative
    },
    null,
    2
  );
}

const intakeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "facts", "followUpQuestions", "cautions"],
  properties: {
    summary: {
      type: "string",
      description: "A short plain-English summary of what the student appears to be saying."
    },
    facts: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "label", "confidence", "evidence", "needsConfirmation", "note"],
        properties: {
          field: {
            type: "string",
            enum: [
              "startingPosition",
              "admissionBasis",
              "inUsOnEffectiveDate",
              "maintainingStatusOnEffectiveDate",
              "programEndOnEffectiveDate",
              "currentProgramEndDate",
              "eadEndOnEffectiveDate",
              "currentEadEndDate",
              "optStage",
              "optFilingDate",
              "travelPosture",
              "reentryDate",
              "reentryBasis",
              "pendingExtensionOnDeparture",
              "transferOrProgramChange",
              "cptPlan"
            ]
          },
          value: { type: "string" },
          label: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          evidence: { type: "string" },
          needsConfirmation: { type: "boolean" },
          note: { type: "string" }
        }
      }
    },
    followUpQuestions: {
      type: "array",
      maxItems: 8,
      items: { type: "string" }
    },
    cautions: {
      type: "array",
      maxItems: 6,
      items: { type: "string" }
    }
  }
};

function normalizeExtraction(value: unknown, model: string): IntakeExtractionResponse {
  const parsed = value as IntakeExtractionResponse;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "I found possible facts to review.",
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions.filter((item) => typeof item === "string") : [],
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item) => typeof item === "string") : [],
    model
  };
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured" }, 503);
  }

  let payload: IntakeExtractionRequest;
  try {
    payload = (await request.json()) as IntakeExtractionRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!payload.narrative || typeof payload.narrative !== "string" || payload.narrative.trim().length < 3) {
    return json({ error: "Narrative is required" }, 400);
  }

  if (payload.narrative.length > 12000) {
    return json({ error: "Narrative is too long for this intake step" }, 400);
  }

  const model = Netlify.env.get("OPENAI_INTAKE_MODEL") ?? Netlify.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL;
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You extract structured facts for a student-facing F-1 planner. You do not calculate legal results. You are careful, conservative, and explicit about ambiguity.",
      input: buildPrompt(payload),
      text: {
        format: {
          type: "json_schema",
          name: "f1_intake_extraction",
          strict: true,
          schema: intakeSchema
        }
      },
      max_output_tokens: 1400,
      store: false
    })
  });

  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    return json({ error: "OpenAI intake failed", detail: detail.slice(0, 500) }, 502);
  }

  const data = await openaiResponse.json();
  const text = extractOutputText(data);

  try {
    return json(normalizeExtraction(JSON.parse(text), model));
  } catch {
    return json({ error: "OpenAI intake returned invalid structured output" }, 502);
  }
};

export const config = {
  path: "/api/intake"
};

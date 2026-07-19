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
        "Write summary, follow-up questions, cautions, labels, and notes directly to the student using 'you' and 'your'. Do not write 'the student'.",
        "Follow-up questions must be answerable by editing the story or by answering one visible app field. Do not dump broad legal research questions.",
        "Use low confidence and needsConfirmation=true when the student's meaning is plausible but not explicit.",
        "Dates must be YYYY-MM-DD only when the student gives a full unambiguous date, such as May 15, 2031 or 2031-05-15.",
        "Do not convert numeric slash dates like 6/2/2029 because date order differs by country.",
        "Do not invent a day when the student gives only a month and year.",
        "A graduation/program-completion date is not an OPT filing date, OPT start date, or EAD end date unless the student says so.",
        "If the student gives the active I-20/program end date and does not mention a different I-20 before the rule effective date, return currentProgramEndDate and also return programEndOnEffectiveDate with needsConfirmation=true.",
        "Only return i94AdmitUntilDate when the student explicitly gives an I-94 admit-until, expiration, or end date. Do not confuse it with an I-20 date, visa expiration date, passport date, OPT date, or graduation date.",
        "For incoming students outside the United States, use startingPosition=prospective_outside_us, admissionBasis=fixed_period, and inUsOnEffectiveDate=no only if the narrative supports it.",
        "If the student says they are currently in the United States in F-1 status, use startingPosition=current_ds_inside_us. If they do not mention an I-94 end date, use admissionBasis=duration_of_status with needsConfirmation=true because current F-1 students usually have D/S but should still be able to correct it.",
        "If the narrative mentions travel but not how the student will return, use travelPosture=planned and reentryBasis=unknown.",
        "If the student says bachelor, associate, undergraduate, or undergrad, use educationLevel=undergraduate. If the student says master's, PhD, doctorate, doctoral, graduate school, or graduate program, use educationLevel=graduate.",
        "If the student says they want a second program at the same level or a lower level, including a second master's, second bachelor's, another associate degree, or a lower degree after completing a higher one, use nextProgramLevelPlan=same_or_lower with needsConfirmation=true unless the level is unmistakable.",
        "Prefer follow-up questions over overconfident extraction."
      ],
      allowedFields: {
        startingPosition: ["current_ds_inside_us", "prospective_outside_us", "readmitted_fixed_period", "transfer_or_program_change", "unknown"],
        admissionBasis: ["duration_of_status", "fixed_period", "unknown"],
        i94AdmitUntilDate: "YYYY-MM-DD",
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
        educationLevel: ["undergraduate", "graduate", "other", "unknown"],
        nextProgramLevelPlan: ["higher", "same_or_lower", "not_planning", "unknown"],
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
      description: "A short plain-English summary addressed directly to the student with 'you' and 'your'."
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
              "i94AdmitUntilDate",
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
              "educationLevel",
              "nextProgramLevelPlan",
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

function speakToStudent(text: string): string {
  return text
    .replace(/\bthe student's\b/gi, "your")
    .replace(/\bThe student appears to be\b/g, "It sounds like you are")
    .replace(/\bthe student appears to be\b/g, "you appear to be")
    .replace(/\bThe student is\b/g, "You are")
    .replace(/\bthe student is\b/g, "you are")
    .replace(/\bThe student has\b/g, "You have")
    .replace(/\bthe student has\b/g, "you have")
    .replace(/\bThe student plans\b/g, "You plan")
    .replace(/\bthe student plans\b/g, "you plan")
    .replace(/\bThe student\b/g, "You")
    .replace(/\bthe student\b/g, "you");
}

function normalizeExtraction(value: unknown, model: string): IntakeExtractionResponse {
  const parsed = value as IntakeExtractionResponse;
  return {
    summary: typeof parsed.summary === "string" ? speakToStudent(parsed.summary) : "I found possible facts to review.",
    facts: Array.isArray(parsed.facts)
      ? parsed.facts.map((fact) => ({
          ...fact,
          label: typeof fact.label === "string" ? speakToStudent(fact.label) : fact.label,
          evidence: typeof fact.evidence === "string" ? speakToStudent(fact.evidence) : fact.evidence,
          note: typeof fact.note === "string" ? speakToStudent(fact.note) : fact.note
        }))
      : [],
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.filter((item) => typeof item === "string").map(speakToStudent)
      : [],
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item) => typeof item === "string").map(speakToStudent) : [],
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
        "You extract structured facts for a student-facing F-1 planner. You do not calculate legal results. You are careful, conservative, and explicit about ambiguity. Any visible text you write must address the student directly as 'you', never as 'the student'.",
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

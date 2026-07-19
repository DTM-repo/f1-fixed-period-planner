import type { ExplanationRequest } from "../../src/ai/explanationPayload";

const DEFAULT_MODEL = "gpt-5.6-sol";

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

function buildPrompt(payload: ExplanationRequest): string {
  return JSON.stringify(
    {
      instruction:
        "Write a professional, friendly international-student advisor note for an F-1 student using only the deterministic result and source list provided. Address the student directly as you/your. Start with 'Under the new rules in your situation,' unless the deterministic result is a contradiction/manual-review result, in which case start by naming the conflicting answers and asking the student to fix them before relying on any timeline. Give the full arc of the situation in plain English: what rule path applies, why it applies, the important dates, the grace/departure period, extension-of-stay implications, OPT/STEM timing, CPT timing, travel comparison, transfer/program-change limits, and what missing facts would sharpen the answer. Mention only topics present in the deterministic result, scenario, findings, or travel comparison. For prospective_outside_us or incoming_fixed_period scenarios, the internal field named reentryDate means the student's expected first F-1 entry date; call it the entry date, not reentry or travel. Do not use markdown headings, bullets, numbered lists, tables, or generic disclaimer language. Do not write 'the student,' 'the calculator,' 'the app,' 'tested entry,' 'tested admission,' 'tested status,' 'admission is tested,' or 'the calculation treats.' If a rule is definite in the deterministic result, state it directly without softening it; mention exceptions after the rule, not instead of the rule. For incoming_fixed_period, do not discuss the D/S transition cap unless a finding explicitly makes it relevant. Keep it to 4 to 7 short paragraphs, about one page or less.",
      scenario: payload.scenario,
      deterministicResult: payload.result,
      travelComparisonResult: payload.travelResult ?? null,
      sourceList: payload.result.citations.map((citation) => ({
        id: citation.id,
        title: citation.title,
        locator: citation.locator,
        url: citation.url
      }))
    },
    null,
    2
  );
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY is not configured" }, 503);
  }

  let payload: ExplanationRequest;
  try {
    payload = (await request.json()) as ExplanationRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const model = Netlify.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL;
  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions:
        "You write source-grounded F-1 student advisement copy. You are careful, plain-spoken, direct, and student-facing. You must not override deterministic rule outputs, invent legal facts, or smooth over contradictory facts. Never use internal testing language such as 'tested entry' or 'calculation treats.'",
      input: buildPrompt(payload),
      max_output_tokens: 1800,
      store: false
    })
  });

  if (!openaiResponse.ok) {
    const detail = await openaiResponse.text();
    return json({ error: "OpenAI explanation failed", detail: detail.slice(0, 500) }, 502);
  }

  const data = await openaiResponse.json();
  const explanation = extractOutputText(data);

  return json({
    explanation: explanation || "No explanation text returned.",
    model
  });
};

export const config = {
  path: "/api/explain"
};

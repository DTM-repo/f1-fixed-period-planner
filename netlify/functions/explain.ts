import type { ExplanationRequest } from "../../src/ai/explanationPayload";

const DEFAULT_MODEL = "gpt-5.6-terra";

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
        "Explain the deterministic F-1 fixed-period planning result in plain English. Do not make new legal conclusions. If facts are missing, ask focused follow-up questions. Keep citations tied to the provided source list.",
      scenario: payload.scenario,
      deterministicResult: payload.result,
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
        "You are helping explain a source-cited immigration compliance calculator. You are not a lawyer, and you must not override the deterministic result.",
      input: buildPrompt(payload),
      max_output_tokens: 900,
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

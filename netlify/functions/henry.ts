const CHATBASE_CHAT_URL = "https://www.chatbase.co/api/v1/chat";
const MAX_FIELD_CHARS = 8000;
const MAX_CONTEXT_CHARS = 3000;

type ChatRole = "user" | "assistant";

interface HenryMessage {
  role: ChatRole;
  content: string;
}

interface HenryRequest {
  question?: unknown;
  message?: unknown;
  messages?: unknown;
  context?: unknown;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}\n[truncated]` : value;
}

function safeStringify(value: unknown): string {
  try {
    return truncate(JSON.stringify(value, null, 2), MAX_CONTEXT_CHARS);
  } catch {
    return "";
  }
}

function normalizeMessages(body: HenryRequest): HenryMessage[] {
  if (Array.isArray(body.messages)) {
    return body.messages
      .filter((message): message is HenryMessage => {
        const candidate = message as Partial<HenryMessage>;
        return (
          (candidate.role === "user" || candidate.role === "assistant") &&
          typeof candidate.content === "string" &&
          candidate.content.trim().length > 0
        );
      })
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: truncate(message.content.trim(), MAX_FIELD_CHARS)
      }));
  }

  const question = typeof body.question === "string" ? body.question : typeof body.message === "string" ? body.message : "";
  return question.trim() ? [{ role: "user", content: truncate(question.trim(), MAX_FIELD_CHARS) }] : [];
}

function directIdentifierLabel(text: string): string | null {
  if (/\bN\d{10}\b/i.test(text)) return "SEVIS ID";
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return "Social Security number";
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return "email address";
  return null;
}

function buildBoundedPrompt(messages: HenryMessage[], context: unknown): string {
  const conversation = messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
  const serializedContext = context === undefined ? "" : safeStringify(context);

  return [
    "You are Henry, a hackathon-safe F-1 domain context service for an app about DHS's July 17, 2026 fixed-period admission rule.",
    "Answer only with general F-1, SEVP, DSO-practice, and student-compliance context relevant to the app question.",
    "Do not calculate an individual student's deadlines, decide their status, or override the app's deterministic calculator.",
    "If a question needs an individual-specific legal/date result, explain that the planner must use confirmed facts and source-cited deterministic rules.",
    "Use plain English for students who may not be native English speakers.",
    "Do not quote or rely on proprietary subscription manuals. Use public-source and professional-practice framing.",
    "Keep the answer concise and practical.",
    serializedContext ? `Optional app context:\n${serializedContext}` : "",
    `Question or conversation:\n${conversation}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Netlify.env.get("CHATBASE_API_KEY");
  const chatbotId = Netlify.env.get("CHATBASE_BOT_ID");

  if (!apiKey || !chatbotId) {
    return json({ error: "CHATBASE_API_KEY and CHATBASE_BOT_ID are required" }, 503);
  }

  let payload: HenryRequest;
  try {
    payload = (await request.json()) as HenryRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const messages = normalizeMessages(payload);
  if (!messages.length) {
    return json({ error: "Question is required" }, 400);
  }

  const identifier = directIdentifierLabel(messages.map((message) => message.content).join("\n"));
  if (identifier) {
    return json(
      {
        error: `Please remove the ${identifier} before sending this to Henry. The app should not send direct student identifiers to the domain-corpus service.`
      },
      400
    );
  }

  const model = Netlify.env.get("CHATBASE_MODEL");
  const chatbaseResponse = await fetch(CHATBASE_CHAT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chatbotId,
      messages: [{ role: "user", content: buildBoundedPrompt(messages, payload.context) }],
      stream: false,
      temperature: 0,
      ...(model ? { model } : {})
    })
  });

  const data = (await chatbaseResponse.json().catch(() => ({}))) as { text?: string; message?: string; error?: string };

  if (!chatbaseResponse.ok || !data.text) {
    return json(
      {
        error: "Henry context call failed",
        detail: data.error ?? data.message ?? `Chatbase returned ${chatbaseResponse.status}`
      },
      502
    );
  }

  return json({
    answer: data.text,
    provider: "chatbase",
    role: "domain_context"
  });
};

export const config = {
  path: "/api/henry"
};

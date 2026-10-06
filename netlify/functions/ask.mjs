// netlify/functions/ask.mjs
//
// Serverless function that sits between the browser and the Anthropic API.
// It runs on Netlify's servers, so the API key never reaches the browser.
//
// Hardening:
//   1. Prompts are built HERE, not in the browser. The client can only send
//      structured fields (role, background, question, answer), so this
//      endpoint can't be used as a general-purpose proxy to Claude.
//   2. Every field has a length cap, which bounds the cost of each request.
//   3. Netlify rate-limits each IP (see `config` at the bottom) and returns
//      HTTP 429 once a visitor goes over the limit.

const MODEL = "claude-sonnet-4-6";
const TOTAL_QUESTIONS = 3;

const LIMITS = { role: 80, background: 1000, question: 500, answer: 4000 };

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function questionsPrompt(role, background) {
  return `You are helping someone practice for a job interview for the role of "${role}".
${background ? `Their background: ${background}` : "No background details were provided."}

Generate exactly ${TOTAL_QUESTIONS} realistic interview questions a hiring manager would actually ask for this role. Mix in at least one behavioral question (e.g. "tell me about a time...") and one role-specific question. If the role is technical (e.g. software engineering), make the role-specific question technical. If background was provided, make at least one question reference it directly.

Respond ONLY with a JSON array of ${TOTAL_QUESTIONS} strings, nothing else. Example format:
["question one", "question two", "question three"]`;
}

function feedbackPrompt(role, question, answer) {
  return `You are a supportive but honest interview coach helping someone prepare for a "${role}" interview.

Question asked: "${question}"
Their answer: "${answer}"

Give feedback using the STAR method as your lens (Situation, Task, Action, Result), but don't lecture about STAR by name unless useful. Be specific and concrete — reference their actual words, not generic advice. Be encouraging but honest; don't inflate a weak answer.

Respond ONLY with a JSON object in this exact shape:
{
  "grade": "strong" | "okay" | "needs_work",
  "headline": "one short sentence summarizing the overall take",
  "whats_working": "1-2 sentences on what was genuinely good, specific to their answer",
  "whats_missing": "1-2 sentences on what's missing or could be sharper, specific to their answer",
  "try_this": "a short, concrete rewording suggestion or specific tip they can apply next time"
}`;
}

export default async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Request body must be JSON" });
  }

  const role = clean(body.role, LIMITS.role);
  if (!role) return json(400, { error: "Missing 'role'" });

  let prompt;
  let maxTokens;
  if (body.action === "questions") {
    prompt = questionsPrompt(role, clean(body.background, LIMITS.background));
    maxTokens = 400;
  } else if (body.action === "feedback") {
    const question = clean(body.question, LIMITS.question);
    const answer = clean(body.answer, LIMITS.answer);
    if (!question || !answer) return json(400, { error: "Missing 'question' or 'answer'" });
    prompt = feedbackPrompt(role, question, answer);
    maxTokens = 600;
  } else {
    return json(400, { error: "Unknown action" });
  }

  // Set in Netlify > Site configuration > Environment variables.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Server is missing ANTHROPIC_API_KEY." });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      // Log details server-side only; don't leak upstream errors to visitors.
      console.error("Anthropic API error", response.status, await response.text());
      return json(502, { error: "Upstream API error" });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    return json(200, { text: textBlock ? textBlock.text : "" });
  } catch (err) {
    console.error("Function error", err);
    return json(500, { error: "Function error" });
  }
};

// One practice session = 1 questions call + up to 3 feedback calls.
// 12 requests per IP per 3 minutes leaves room for a few sessions while
// stopping scripted abuse. (Netlify's maximum window is 180 seconds.)
export const config = {
  path: "/api/ask",
  rateLimit: {
    windowLimit: 12,
    windowSize: 180,
    aggregateBy: ["ip", "domain"]
  }
};

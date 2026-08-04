export interface LLMConfig {
  provider: "openrouter" | "openai";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getLLMConfig(env: Record<string, string | undefined> = process.env): LLMConfig | null {
  if (env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.LLM_MODEL || "openai/gpt-4o-mini",
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.LLM_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

/**
 * LLMs wrap JSON in markdown fences or prose more often than you'd hope.
 * Extract the first JSON object/array in the text and parse it.
 */
export function parseLLMJson(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to bracket matching
  }
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
  if (starts.length === 0) throw new Error("No JSON found in LLM response");
  const start = Math.min(...starts);
  const closer = cleaned[start] === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closer);
  if (end <= start) throw new Error("Unbalanced JSON in LLM response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Free-tier models queue behind paid traffic and regularly take 60s+ on a
// 50-comment clustering prompt, so the old 45s ceiling meant the LLM path
// timed out and silently degraded to heuristics. Override with LLM_TIMEOUT_MS.
export const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 90000;

export async function chatJSON(
  config: LLMConfig,
  system: string,
  user: string,
  timeoutMs = DEFAULT_LLM_TIMEOUT_MS
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/mcrowley19/youtube-automation";
    headers["X-Title"] = "AudienceSignal";
  }
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM response had no content");
  return parseLLMJson(content);
}

import { afterAll, describe, expect, it } from "vitest";
import { chatJSON, getLLMConfig, parseLLMJson } from "@/lib/llm";
import http from "node:http";

describe("getLLMConfig", () => {
  it("returns null with no keys at all", () => {
    expect(getLLMConfig({})).toBeNull();
  });

  it("prefers a local base URL over cloud keys", () => {
    const config = getLLMConfig({
      LLM_BASE_URL: "http://localhost:11434/v1/",
      OPENROUTER_API_KEY: "or-key",
      OPENAI_API_KEY: "oa-key",
    })!;
    expect(config.provider).toBe("local");
    expect(config.baseUrl).toBe("http://localhost:11434/v1");
    expect(config.apiKey).toBe("local");
  });

  it("honors LLM_MODEL for the local provider", () => {
    const config = getLLMConfig({ LLM_BASE_URL: "http://localhost:8080/v1", LLM_MODEL: "llama3.1:8b" })!;
    expect(config.model).toBe("llama3.1:8b");
  });

  it("falls back to openrouter then openai", () => {
    expect(getLLMConfig({ OPENROUTER_API_KEY: "x" })!.provider).toBe("openrouter");
    expect(getLLMConfig({ OPENAI_API_KEY: "x" })!.provider).toBe("openai");
  });
});

describe("chatJSON against a local OpenAI-compatible server", () => {
  // A stub speaking the exact wire format Ollama's /v1/chat/completions and
  // llama.cpp's server speak — proves the client needs zero changes to go local.
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ echoModel: parsed.model, ok: true }),
              },
            },
          ],
        })
      );
    });
  });

  afterAll(() => server.close());

  it("round-trips JSON through the local endpoint", async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const config = getLLMConfig({ LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, LLM_MODEL: "test-model" })!;
    const result = await chatJSON(config, "system", "user", 5000);
    expect(result).toEqual({ echoModel: "test-model", ok: true });
  });
});

describe("parseLLMJson", () => {
  it("unwraps fenced JSON", () => {
    expect(parseLLMJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("extracts the object out of surrounding prose", () => {
    expect(parseLLMJson('Sure! Here you go: {"a": [1, 2]} Hope that helps.')).toEqual({ a: [1, 2] });
  });
});

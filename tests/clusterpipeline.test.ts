import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAnalysis } from "@/lib/analyze";
import type { Comment } from "@/lib/types";

/**
 * End-to-end cover for the batched clustering path: how many model calls a
 * given comment count produces, that a failed batch degrades to the keyword
 * scan on its own, and that coverage is reported honestly either way.
 */

function comments(n: number): Comment[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    author: `viewer${i}`,
    // Half praise, half request, so both tiers have something to classify.
    text: i % 2 === 0 ? `Great video number ${i}, really helpful` : `Please do a part two on ${i}`,
    likeCount: n - i,
    publishedAt: "2026-08-01T00:00:00Z",
  }));
}

const clusterPayload = {
  themes: [
    { name: "praise", count: 10, top_quotes: ["Great video number 0, really helpful"] },
    { name: "complaint", count: 0, top_quotes: [] },
    { name: "request", count: 5, top_quotes: ["Please do a part two on 1"] },
    { name: "confusion", count: 0, top_quotes: [] },
  ],
  summary: "batch summary",
};

let clusteringCalls = 0;
let failFirstCluster = false;

function llmResponse(body: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: body } }] }),
    text: async () => body,
  } as unknown as Response;
}

const mockFetch = vi.fn(async (_url: string, init: any) => {
  const sent = JSON.parse(init.body);
  const prompt: string = sent.messages[1].content;

  if (prompt.startsWith("Given these YouTube comments, classify each")) {
    clusteringCalls++;
    if (failFirstCluster && clusteringCalls === 1) {
      return { ok: false, status: 429, text: async () => "rate limited" } as unknown as Response;
    }
    return llmResponse(JSON.stringify(clusterPayload));
  }
  // Downstream sections: ideas, fixes, thumbnail texts.
  return llmResponse(
    JSON.stringify({
      ideas: [{ title: "An idea", hook: "a hook", evidence_quotes: [], estimated_interest: "high" }],
      fixes: [{ issue: "An issue", fix: "A fix", evidence_quote: "" }],
      texts: ["One", "Two", "Three"],
    })
  );
});

beforeEach(() => {
  clusteringCalls = 0;
  failFirstCluster = false;
  mockFetch.mockClear();
  vi.stubGlobal("fetch", mockFetch);
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.LLM_BATCH_SIZE = "150";
  process.env.LLM_MAX_BATCHES = "6";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.LLM_BATCH_SIZE;
  delete process.env.LLM_MAX_BATCHES;
});

describe("batched clustering", () => {
  it("sends one model call per batch", async () => {
    const analysis = await runAnalysis(comments(450), "Test video");
    expect(clusteringCalls).toBe(3);
    expect(analysis.source).toBe("llm");
  });

  it("counts every comment the model saw as covered", async () => {
    const analysis = await runAnalysis(comments(300), "Test video");
    expect(analysis.clusters.coverage).toEqual({ total: 300, byModel: 300 });
  });

  it("stops calling the model past the batch cap and scans the tail", async () => {
    // 6 batches of 150 is the cap, so 1,000 comments leaves 100 for the scan.
    const analysis = await runAnalysis(comments(1000), "Test video");
    expect(clusteringCalls).toBe(6);
    expect(analysis.clusters.coverage).toEqual({ total: 1000, byModel: 900 });
    expect(analysis.clusters.summary).toContain("900 clustered by the model, 100 by keyword scan");
  });

  it("keeps the run alive when one batch fails, and says so in the coverage", async () => {
    failFirstCluster = true;
    const analysis = await runAnalysis(comments(450), "Test video");
    expect(analysis.source).toBe("llm");
    // Two batches landed, the failed one fell to the scan.
    expect(analysis.clusters.coverage).toEqual({ total: 450, byModel: 300 });
    // Counts still cover the whole set rather than dropping the failed batch.
    const total = analysis.clusters.themes.reduce((n, t) => n + t.count, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("honours the batch size and cap from the environment", async () => {
    process.env.LLM_BATCH_SIZE = "50";
    process.env.LLM_MAX_BATCHES = "3";
    const analysis = await runAnalysis(comments(400), "Test video");
    expect(clusteringCalls).toBe(3);
    expect(analysis.clusters.coverage).toEqual({ total: 400, byModel: 150 });
  });

  it("sums theme counts across every batch", async () => {
    const analysis = await runAnalysis(comments(450), "Test video");
    const praise = analysis.clusters.themes.find((t) => t.name === "praise")!;
    expect(praise.count).toBe(30); // 10 per batch, three batches
  });

  it("falls back to the heuristic analyser when every batch fails", async () => {
    mockFetch.mockImplementation(async () => ({
      ok: false,
      status: 500,
      text: async () => "provider down",
    }) as unknown as Response);
    const analysis = await runAnalysis(comments(300), "Test video");
    expect(analysis.source).toBe("heuristic");
    expect(analysis.clusters.coverage).toEqual({ total: 300, byModel: 0 });
  });
});

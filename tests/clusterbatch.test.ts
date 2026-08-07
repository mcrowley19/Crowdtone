import { describe, expect, it } from "vitest";
import { chunk, mapWithConcurrency, mergeClusters } from "@/lib/analyze";
import type { ClusterResult, Comment, ThemeName } from "@/lib/types";

function comment(text: string, likeCount = 0): Comment {
  return { id: text.slice(0, 12), author: "viewer", text, likeCount, publishedAt: "" };
}

function part(counts: Partial<Record<ThemeName, number>>, quotes: Partial<Record<ThemeName, string[]>> = {}): ClusterResult {
  const names: ThemeName[] = ["praise", "complaint", "request", "confusion"];
  return {
    themes: names.map((name) => ({
      name,
      count: counts[name] ?? 0,
      top_quotes: quotes[name] ?? [],
    })),
    summary: "",
  };
}

describe("chunk", () => {
  it("splits into full batches plus a remainder", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty list", () => {
    expect(chunk([], 10)).toEqual([]);
  });
});

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const out = await mapWithConcurrency([30, 10, 20, 0], 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return `${i}:${ms}`;
    });
    expect(out).toEqual(["0:30", "1:10", "2:20", "3:0"]);
  });

  it("never runs more than the limit at once", async () => {
    let live = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles a limit larger than the work", async () => {
    expect(await mapWithConcurrency([1, 2], 10, async (n) => n * 2)).toEqual([2, 4]);
  });
});

describe("mergeClusters", () => {
  const comments = [
    comment("Please do a part two on this", 90),
    comment("Great video, really helpful", 5),
    comment("The title oversold it honestly", 40),
  ];

  it("sums counts across batches", () => {
    const merged = mergeClusters(
      [part({ praise: 10, request: 4 }), part({ praise: 6, complaint: 3 })],
      comments,
      300
    );
    const count = (n: ThemeName) => merged.themes.find((t) => t.name === n)!.count;
    expect(count("praise")).toBe(16);
    expect(count("request")).toBe(4);
    expect(count("complaint")).toBe(3);
    expect(count("confusion")).toBe(0);
  });

  it("always returns all four themes", () => {
    const merged = mergeClusters([part({ praise: 1 })], comments, 3);
    expect(merged.themes.map((t) => t.name)).toEqual(["praise", "complaint", "request", "confusion"]);
  });

  it("ranks merged quotes by the like count of the comment they came from", () => {
    const merged = mergeClusters(
      [
        part({ praise: 2 }, { praise: ["Great video, really helpful"] }),
        part({ praise: 2 }, { praise: ["Please do a part two on this"] }),
      ],
      comments,
      300
    );
    // 90 likes beats 5, even though it arrived in the later batch.
    expect(merged.themes.find((t) => t.name === "praise")!.top_quotes[0]).toBe(
      "Please do a part two on this"
    );
  });

  it("drops duplicate quotes returned by more than one batch", () => {
    const merged = mergeClusters(
      [
        part({ praise: 1 }, { praise: ["Great video, really helpful"] }),
        part({ praise: 1 }, { praise: ["great video,   really helpful"] }),
      ],
      comments,
      300
    );
    expect(merged.themes.find((t) => t.name === "praise")!.top_quotes).toHaveLength(1);
  });

  it("keeps at most five quotes per theme", () => {
    const many = Array.from({ length: 9 }, (_, i) => `quote number ${i}`);
    const merged = mergeClusters([part({ praise: 9 }, { praise: many })], comments, 300);
    expect(merged.themes.find((t) => t.name === "praise")!.top_quotes).toHaveLength(5);
  });

  it("reports coverage and names the split in the summary", () => {
    const merged = mergeClusters([part({ praise: 1 })], comments, 2);
    expect(merged.coverage).toEqual({ total: 3, byModel: 2 });
    expect(merged.summary).toContain("2 clustered by the model, 1 by keyword scan");
  });

  it("says so when the model covered everything", () => {
    const merged = mergeClusters([part({ praise: 3 })], comments, 3);
    expect(merged.coverage).toEqual({ total: 3, byModel: 3 });
    expect(merged.summary).toContain("Every comment clustered by the model");
  });

  it("says so when the model covered nothing", () => {
    const merged = mergeClusters([part({ praise: 3 })], comments, 0);
    expect(merged.summary).toContain("Classified by keyword scan");
  });
});

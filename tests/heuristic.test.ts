import { describe, expect, it } from "vitest";
import { classifyComment, clusterHeuristically, heuristicAnalysis } from "@/lib/heuristic";
import demo from "@/examples/demo_comments.json";
import type { Comment } from "@/lib/types";

const comments = demo.comments as Comment[];

describe("classifyComment", () => {
  it("detects each theme", () => {
    expect(classifyComment("This is clickbait and misleading")).toBe("complaint");
    expect(classifyComment("Please do a comparison with the Air")).toBe("request");
    expect(classifyComment("I'm confused, what does this mean?")).toBe("confusion");
    expect(classifyComment("Love this, great video, thank you!")).toBe("praise");
    expect(classifyComment("first")).toBeNull();
  });
});

describe("clusterHeuristically", () => {
  it("buckets the demo dataset into all four themes with quotes", () => {
    const clusters = clusterHeuristically(comments);
    expect(clusters.themes).toHaveLength(4);
    for (const theme of clusters.themes) {
      expect(theme.count).toBeGreaterThan(0);
      expect(theme.top_quotes.length).toBeGreaterThan(0);
      expect(theme.top_quotes.length).toBeLessThanOrEqual(5);
    }
    expect(clusters.summary).toContain(`${comments.length} comments`);
  });

  it("orders quotes by like count", () => {
    const clusters = clusterHeuristically(comments);
    const praise = clusters.themes.find((t) => t.name === "praise")!;
    const likesOf = (quote: string) => comments.find((c) => quote.startsWith(c.text.slice(0, 50)))?.likeCount ?? 0;
    expect(likesOf(praise.top_quotes[0])).toBeGreaterThanOrEqual(likesOf(praise.top_quotes[1]));
  });
});

describe("heuristicAnalysis", () => {
  it("produces a complete analysis without any LLM", () => {
    const analysis = heuristicAnalysis(comments, "Demo video");
    expect(analysis.source).toBe("heuristic");
    expect(analysis.ideas).toHaveLength(3);
    expect(analysis.fixes.length).toBeGreaterThanOrEqual(3);
    expect(analysis.thumbnailTexts).toHaveLength(3);
    expect(analysis.topComplaint).toBeTruthy();
    for (const text of analysis.thumbnailTexts) {
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });
});

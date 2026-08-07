import { describe, expect, it } from "vitest";
import { labelSentiment, scoreSentiment, sentimentTimeline } from "@/lib/sentiment";
import type { Comment } from "@/lib/types";

function comment(text: string, publishedAt = "2026-07-12T18:00:00Z"): Comment {
  return { id: Math.random().toString(36).slice(2), author: "viewer", text, likeCount: 0, publishedAt };
}

describe("scoreSentiment", () => {
  it("scores praise positive and complaints negative", () => {
    expect(scoreSentiment("This was amazing, thank you!")).toBeGreaterThan(0);
    expect(scoreSentiment("Misleading clickbait, waste of time")).toBeLessThan(0);
  });

  it("returns 0 when there is no signal", () => {
    expect(scoreSentiment("I watched this on a train")).toBe(0);
  });

  it("flips polarity under negation", () => {
    expect(scoreSentiment("not helpful at all")).toBeLessThan(0);
    expect(scoreSentiment("this is not bad")).toBeGreaterThan(0);
  });

  it("reads emoji", () => {
    expect(scoreSentiment("🔥🔥🔥")).toBeGreaterThan(0);
    expect(scoreSentiment("👎")).toBeLessThan(0);
  });

  it("is deterministic", () => {
    const text = "really great video but the audio was terrible";
    expect(scoreSentiment(text)).toBe(scoreSentiment(text));
  });

  it("stays within [-1, 1]", () => {
    expect(scoreSentiment("amazing amazing amazing amazing amazing")).toBeLessThanOrEqual(1);
    expect(scoreSentiment("trash trash trash trash garbage")).toBeGreaterThanOrEqual(-1);
  });
});

describe("labelSentiment", () => {
  it("buckets scores into three labels", () => {
    expect(labelSentiment(0.5)).toBe("positive");
    expect(labelSentiment(-0.5)).toBe("negative");
    expect(labelSentiment(0)).toBe("neutral");
  });
});

describe("sentimentTimeline", () => {
  it("buckets dated comments chronologically", () => {
    const comments = [
      comment("amazing video, thank you", "2026-07-01T10:00:00Z"),
      comment("really helpful", "2026-07-02T10:00:00Z"),
      comment("misleading title honestly", "2026-07-10T10:00:00Z"),
      comment("total clickbait, disappointed", "2026-07-11T10:00:00Z"),
    ];
    const timeline = sentimentTimeline(comments, 2);
    expect(timeline.datedBuckets).toBe(true);
    expect(timeline.buckets).toHaveLength(2);
    expect(timeline.buckets[0].score).toBeGreaterThan(0);
    expect(timeline.buckets[1].score).toBeLessThan(0);
    expect(timeline.overall.positive).toBe(2);
    expect(timeline.overall.negative).toBe(2);
  });

  it("falls back to positional buckets when dates are useless", () => {
    const comments = ["great", "great", "terrible", "terrible"].map((t) => comment(t));
    const timeline = sentimentTimeline(comments, 2);
    expect(timeline.datedBuckets).toBe(false);
    expect(timeline.buckets.length).toBeGreaterThan(0);
  });

  it("keeps a quote as the receipt for a polarized bucket", () => {
    const timeline = sentimentTimeline(
      [comment("absolutely amazing, the best explanation on YouTube", "2026-07-01T10:00:00Z")],
      1
    );
    expect(timeline.buckets[0].quote).toContain("amazing");
  });

  it("handles an empty comment list", () => {
    const timeline = sentimentTimeline([]);
    expect(timeline.buckets).toEqual([]);
    expect(timeline.overall.score).toBe(0);
  });
});

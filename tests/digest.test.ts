import { describe, expect, it } from "vitest";
import { buildAudienceDigest } from "@/lib/digest";
import type { Analysis } from "@/lib/types";

const analysis: Analysis = {
  clusters: {
    themes: [
      { name: "praise", count: 14, top_quotes: ["Best tech reviewer on YouTube, no contest."] },
      { name: "complaint", count: 12, top_quotes: ["The title says 30 days but half is unboxing."] },
      { name: "request", count: 15, top_quotes: ["Please do a comparison with the M3 Air!"] },
      { name: "confusion", count: 9, top_quotes: ["At 8:14 you said 14 hours but the chart shows 11?"] },
    ],
    summary: "Viewers trust the format but want tighter claims.",
  },
  ideas: [
    {
      title: "M4 Pro vs M3 Air: Which Is Worth Your Money?",
      hook: "Before you hit buy...",
      evidence_quotes: ["Please do a comparison with the M3 Air!"],
      estimated_interest: "high",
    },
  ],
  fixes: [
    {
      issue: "Battery figures conflict",
      fix: "Pin a correction clarifying the 14h vs 11h battery figures",
      evidence_quote: "At 8:14 you said 14 hours but the chart shows 11?",
    },
  ],
  thumbnailTexts: ["No Fluff, Just Results"],
  topComplaint: "Misleading title",
  source: "llm",
};

const base = {
  channelTitle: "Tech World",
  videoTitle: "I Used the M4 MacBook Pro for 30 Days",
  commentsAnalyzed: 50,
  analysis,
  generatedAt: "2026-08-07T12:00:00Z",
};

describe("buildAudienceDigest", () => {
  it("builds a dated subject line", () => {
    const digest = buildAudienceDigest(base);
    expect(digest.subject).toBe("State of the Audience — Tech World — 2026-08-07");
  });

  it("carries the theme counts and the top actions with receipts", () => {
    const md = buildAudienceDigest(base).markdown;
    expect(md).toContain("14 comments praised");
    expect(md).toContain("15 asked for something specific");
    expect(md).toContain("Pin a correction");
    expect(md).toContain("M4 Pro vs M3 Air");
    expect(md).toContain("8:14");
  });

  it("leads with the worst retention dip when analytics exist", () => {
    const md = buildAudienceDigest({
      ...base,
      dips: [
        { timestamp: "15:50", dropPercent: 7.2 },
        { timestamp: "8:24", dropPercent: 10.4, quote: "at 8:14 you said 14 hours but the chart shows 11?" },
      ],
    }).markdown;
    expect(md).toContain("10.4% of the audience leaves at 8:24");
    expect(md.indexOf("10.4%")).toBeLessThan(md.indexOf("Do these this week"));
  });

  it("names superfans with their badges", () => {
    const md = buildAudienceDigest({
      ...base,
      superfans: [
        {
          author: "@benchmarkbre",
          commentCount: 3,
          videosTouched: 2,
          totalLikes: 150,
          questionCount: 2,
          timestampCount: 1,
          score: 12,
          badges: ["on 2 of the videos read", "asks the good questions"],
          topQuote: "94%!!!",
          lastSeen: "2026-08-01T00:00:00Z",
        },
      ],
    }).markdown;
    expect(md).toContain("Who showed up");
    expect(md).toContain("@benchmarkbre");
    expect(md).toContain("asks the good questions");
  });

  it("counts the patrol into the weekly to-do when provided", () => {
    const md = buildAudienceDigest({ ...base, patrolFlagged: 5 }).markdown;
    expect(md).toContain("5 scam/spam comments flagged");
  });

  it("is deterministic for the same input", () => {
    expect(buildAudienceDigest(base)).toEqual(buildAudienceDigest(base));
  });
});

import { describe, expect, it } from "vitest";
import { computeChannelStats, type ChannelInfo } from "@/lib/channel";
import {
  derivePerformanceNotes,
  extractDemandQuotes,
  selectVideosForPlan,
  suggestPublishDate,
  validatePlan,
} from "@/lib/plan";
import type { Comment, VideoMeta } from "@/lib/types";

const NOW = Date.parse("2024-06-01T00:00:00Z");

function video(videoId: string, partial: Partial<VideoMeta> = {}): VideoMeta {
  return {
    videoId,
    title: `Video ${videoId}`,
    channelTitle: "Test channel",
    thumbnailUrl: "",
    viewCount: 1000,
    commentCount: 10,
    likeCount: 40,
    durationSeconds: 600,
    publishedAt: "2024-05-01T00:00:00Z",
    source: "api",
    ...partial,
  };
}

function comment(text: string, likeCount = 0): Comment {
  return { id: text.slice(0, 6), author: "viewer", text, likeCount, publishedAt: "2024-01-01T00:00:00Z" };
}

const channel: ChannelInfo = {
  channelId: "UC0000000000000000000000",
  title: "Test channel",
  handle: "@test",
  thumbnailUrl: "",
  subscriberCount: 12000,
  videoCount: 80,
  uploadsPlaylistId: "UU0000000000000000000000",
};

describe("extractDemandQuotes", () => {
  it("keeps requests and questions, ranked by likes", () => {
    const quotes = extractDemandQuotes([
      {
        video: video("a"),
        comments: [
          comment("please do a part 2 on the wiring", 40),
          comment("what soldering iron is that?", 90),
          comment("great video", 500),
          comment("ok", 5),
        ],
      },
    ]);
    expect(quotes.map((q) => q.likeCount)).toEqual([90, 40]);
    expect(quotes[0].videoTitle).toBe("Video a");
  });

  it("ignores comments too short or too long to be a brief", () => {
    const quotes = extractDemandQuotes([
      { video: video("a"), comments: [comment("part 2?", 10), comment(`please ${"x".repeat(500)}`, 10)] },
    ]);
    expect(quotes).toHaveLength(0);
  });
});

describe("selectVideosForPlan", () => {
  it("reads the recent uploads plus the channel's outliers", () => {
    const stats = computeChannelStats(
      [
        video("r1", { publishedAt: "2024-05-30T00:00:00Z" }),
        video("r2", { publishedAt: "2024-05-20T00:00:00Z" }),
        video("r3", { publishedAt: "2024-05-10T00:00:00Z" }),
        video("r4", { publishedAt: "2024-04-10T00:00:00Z" }),
        video("hit", { publishedAt: "2024-01-10T00:00:00Z", viewCount: 900000 }),
      ],
      NOW
    );
    const picked = selectVideosForPlan(stats).map((p) => p.video.videoId);
    expect(picked.slice(0, 3)).toEqual(["r1", "r2", "r3"]);
    expect(picked).toContain("hit");
    expect(picked).toHaveLength(5);
  });

  it("skips videos with no comments to read", () => {
    const stats = computeChannelStats([video("a", { commentCount: 0 }), video("b")], NOW);
    expect(selectVideosForPlan(stats).map((p) => p.video.videoId)).toEqual(["b"]);
  });
});

describe("derivePerformanceNotes", () => {
  it("states the channel's numbers rather than leaving them to the model", () => {
    const stats = computeChannelStats(
      [
        video("new", { publishedAt: "2024-05-22T00:00:00Z", viewCount: 1000 }),
        video("hit", { publishedAt: "2024-05-02T00:00:00Z", viewCount: 12000 }),
        video("mid", { publishedAt: "2024-04-02T00:00:00Z", viewCount: 6000 }),
        video("flop", { publishedAt: "2024-03-03T00:00:00Z", viewCount: 900 }),
      ],
      NOW
    );
    const notes = derivePerformanceNotes(channel, stats, NOW);
    expect(notes.join(" ")).toContain("100 views/day");
    expect(notes.join(" ")).toContain("4× the channel's normal");
    expect(notes.join(" ")).toContain("every 30 days");
    expect(notes.join(" ")).toContain("12,000 subscribers");
  });

  it("says so plainly when there are no uploads", () => {
    expect(derivePerformanceNotes(channel, computeChannelStats([], NOW), NOW)).toEqual([
      "No uploads found on this channel.",
    ]);
  });
});

describe("suggestPublishDate", () => {
  it("lands on the channel's next natural slot", () => {
    const stats = computeChannelStats(
      [
        video("a", { publishedAt: "2024-05-28T00:00:00Z" }),
        video("b", { publishedAt: "2024-05-21T00:00:00Z" }),
        video("c", { publishedAt: "2024-05-14T00:00:00Z" }),
      ],
      NOW
    );
    expect(suggestPublishDate(stats, NOW)).toBe("2024-06-04");
  });

  it("never suggests a date already gone", () => {
    const stats = computeChannelStats(
      [
        video("a", { publishedAt: "2024-01-28T00:00:00Z" }),
        video("b", { publishedAt: "2024-01-21T00:00:00Z" }),
      ],
      NOW
    );
    expect(Date.parse(suggestPublishDate(stats, NOW))).toBeGreaterThan(NOW);
  });
});

describe("validatePlan", () => {
  it("coerces a full plan", () => {
    const plan = validatePlan({
      title: "The wiring video you keep asking for",
      alternative_titles: ["Wiring, properly", "", 5],
      angle: "Answer the top request.",
      hook: "You asked, so here it is.",
      outline: [{ beat: "Cold open", detail: "Show the failure." }, { beat: "", detail: "dropped" }],
      description: "Everything about wiring.",
      tags: ["wiring", "diy"],
      thumbnail_text: "one two three four five six seven",
      target_length_minutes: 12.6,
      avoid: ["Don't skip the parts list"],
      confidence: "HIGH",
    })!;
    expect(plan.title).toBe("The wiring video you keep asking for");
    expect(plan.alternativeTitles).toEqual(["Wiring, properly"]);
    expect(plan.outline).toHaveLength(1);
    expect(plan.thumbnailText.split(" ")).toHaveLength(6);
    expect(plan.targetLengthMinutes).toBe(13);
    expect(plan.confidence).toBe("high");
  });

  it("rejects a plan with no title", () => {
    expect(validatePlan({ angle: "nothing to make" })).toBeNull();
  });

  it("defaults an unknown confidence to medium", () => {
    expect(validatePlan({ title: "x", confidence: "certain" })!.confidence).toBe("medium");
  });
});

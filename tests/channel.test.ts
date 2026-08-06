import { describe, expect, it } from "vitest";
import { computeChannelStats, median, parseChannelInput } from "@/lib/channel";
import type { VideoMeta } from "@/lib/types";

const NOW = Date.parse("2024-06-01T00:00:00Z");

function video(partial: Partial<VideoMeta> & { videoId: string }): VideoMeta {
  return {
    title: partial.videoId,
    channelTitle: "Test channel",
    thumbnailUrl: "",
    viewCount: 1000,
    commentCount: 10,
    likeCount: 50,
    durationSeconds: 600,
    publishedAt: "2024-05-01T00:00:00Z",
    source: "api",
    ...partial,
  };
}

describe("parseChannelInput", () => {
  it("accepts every shape a creator might paste", () => {
    expect(parseChannelInput("@mkbhd")).toEqual({ type: "handle", value: "mkbhd" });
    expect(parseChannelInput("https://www.youtube.com/@mkbhd")).toEqual({ type: "handle", value: "mkbhd" });
    expect(parseChannelInput("youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ")).toEqual({
      type: "id",
      value: "UCBJycsmduvYEL83R_U4JriQ",
    });
    expect(parseChannelInput("UCBJycsmduvYEL83R_U4JriQ")).toEqual({
      type: "id",
      value: "UCBJycsmduvYEL83R_U4JriQ",
    });
    expect(parseChannelInput("https://youtube.com/user/marquesbrownlee")).toEqual({
      type: "username",
      value: "marquesbrownlee",
    });
  });

  it("rejects anything that isn't a channel", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("https://vimeo.com/@someone")).toBeNull();
    expect(parseChannelInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("computeChannelStats", () => {
  const videos = [
    video({ videoId: "new", publishedAt: "2024-05-22T00:00:00Z", viewCount: 1000 }), // 10 days, 100/day
    video({ videoId: "hit", publishedAt: "2024-05-02T00:00:00Z", viewCount: 12000 }), // 30 days, 400/day
    video({ videoId: "mid", publishedAt: "2024-04-02T00:00:00Z", viewCount: 6000 }), // 60 days, 100/day
    video({ videoId: "flop", publishedAt: "2024-03-03T00:00:00Z", viewCount: 900 }), // 90 days, 10/day
  ];

  it("scores each video against the channel's own median", () => {
    const stats = computeChannelStats(videos, NOW);
    expect(stats.medianViewsPerDay).toBe(100);
    const byId = new Map(stats.videos.map((p) => [p.video.videoId, p]));
    expect(byId.get("hit")!.outlierScore).toBe(4);
    expect(byId.get("new")!.outlierScore).toBe(1);
    expect(byId.get("flop")!.outlierScore).toBe(0.1);
    expect(stats.top[0].video.videoId).toBe("hit");
    expect(stats.bottom[0].video.videoId).toBe("flop");
  });

  it("measures cadence as the median gap between uploads", () => {
    expect(computeChannelStats(videos, NOW).cadenceDays).toBe(30);
  });

  it("keeps shorts out of the baseline", () => {
    const withShorts = [
      ...videos,
      video({ videoId: "s1", durationSeconds: 30, viewCount: 500000, publishedAt: "2024-05-30T00:00:00Z" }),
      video({ videoId: "s2", durationSeconds: 45, viewCount: 400000, publishedAt: "2024-05-29T00:00:00Z" }),
    ];
    const stats = computeChannelStats(withShorts, NOW);
    expect(stats.medianViewsPerDay).toBe(100);
    expect(stats.videos.find((p) => p.video.videoId === "s1")!.isShort).toBe(true);
    expect(stats.top.some((p) => p.isShort)).toBe(false);
  });

  it("does not divide by zero on a video published today", () => {
    const stats = computeChannelStats([video({ videoId: "today", publishedAt: new Date(NOW).toISOString() })], NOW);
    expect(Number.isFinite(stats.videos[0].viewsPerDay)).toBe(true);
  });

  it("returns zeroed stats for an empty channel", () => {
    const stats = computeChannelStats([], NOW);
    expect(stats.videos).toEqual([]);
    expect(stats.medianViewsPerDay).toBe(0);
    expect(stats.cadenceDays).toBe(0);
  });
});

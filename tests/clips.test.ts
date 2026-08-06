import { describe, expect, it } from "vitest";
import { classifyTone, suggestClips } from "@/lib/clips";
import type { Comment } from "@/lib/types";

function comment(text: string, id = Math.random().toString(36).slice(2)): Comment {
  return { id, author: "viewer", text, likeCount: 0, publishedAt: "2026-08-01T00:00:00Z" };
}

describe("suggestClips", () => {
  it("builds ranked clip specs from timestamped comments", () => {
    const comments = [
      comment("The bit at 4:12 killed me, I rewatched it three times"),
      comment("4:15 is the funniest thing on this channel"),
      comment("Great explanation at 12:30, finally understood it"),
    ];
    const clips = suggestClips(comments, "vid123", 900);
    expect(clips).toHaveLength(2);
    // Two mentions cluster at ~4:12; that clip outranks the single at 12:30.
    expect(clips[0].mentions).toBe(2);
    expect(clips[0].startSeconds).toBe(252 - 5);
    expect(clips[0].endSeconds).toBe(252 - 5 + 50);
    expect(clips[0].tone).toBe("highlight");
    expect(clips[0].watchUrl).toBe("https://www.youtube.com/watch?v=vid123&t=247s");
    expect(clips[1].tone).toBe("helpful");
  });

  it("clamps a clip to the end of the video", () => {
    const clips = suggestClips([comment("the ending at 9:40 was perfect")], "vid123", 600);
    expect(clips[0].endSeconds).toBe(600);
  });

  it("suggests nothing for a video that is already Short-length", () => {
    const clips = suggestClips([comment("0:30 is great")], "vid123", 58);
    expect(clips).toEqual([]);
  });

  it("suggests nothing when no comment carries a timestamp", () => {
    expect(suggestClips([comment("great video!")], "vid123", 600)).toEqual([]);
  });
});

describe("classifyTone", () => {
  it("hears the difference between a laugh and a lesson", () => {
    expect(classifyTone(["this part was hilarious"])).toBe("highlight");
    expect(classifyTone(["this trick finally worked for me"])).toBe("helpful");
    expect(classifyTone(["see 3:40"])).toBe("moment");
  });
});

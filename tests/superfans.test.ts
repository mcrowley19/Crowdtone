import { describe, expect, it } from "vitest";
import { findQuietSuperfans, rankSuperfans } from "@/lib/superfans";
import type { Comment } from "@/lib/types";

let seq = 0;
function comment(author: string, text: string, likeCount = 0, publishedAt = "2026-07-01T00:00:00Z", authorChannelId?: string): Comment {
  return { id: `c${seq++}`, author, text, likeCount, publishedAt, authorChannelId };
}

describe("rankSuperfans", () => {
  it("ranks a fan who appears across videos above a one-off commenter", () => {
    const fans = rankSuperfans([
      { videoTitle: "Video A", comments: [comment("@loyal", "great breakdown at 4:32"), comment("@passerby", "nice")] },
      { videoTitle: "Video B", comments: [comment("@loyal", "how does this compare to the M3?")] },
    ]);
    expect(fans[0].author).toBe("@loyal");
    expect(fans[0].videosTouched).toBe(2);
    expect(fans[0].badges.join(" ")).toContain("2 of the videos");
  });

  it("never ranks the creator on their own channel", () => {
    const fans = rankSuperfans(
      [{ videoTitle: "A", comments: [comment("Tech World", "thanks all!", 500, "2026-07-01T00:00:00Z", "UCowner")] }],
      { ownerChannelId: "UCowner" }
    );
    expect(fans).toHaveLength(0);
  });

  it("credits likes, questions, and timestamps in the badges", () => {
    const fans = rankSuperfans([
      {
        videoTitle: "A",
        comments: [
          comment("@quality", "Why does the compile at 8:14 beat the Pro? How is that possible?", 120),
          comment("@quality", "What RAM config was this?", 30),
        ],
      },
    ]);
    expect(fans[0].totalLikes).toBe(150);
    const badges = fans[0].badges.join(" | ");
    expect(badges).toContain("150 likes");
    expect(badges).toContain("cites timestamps");
    expect(badges).toContain("good questions");
  });

  it("keeps the most-liked comment as the quote", () => {
    const fans = rankSuperfans([
      { videoTitle: "A", comments: [comment("@fan", "meh", 1), comment("@fan", "this saved me $700, thank you", 300)] },
    ]);
    expect(fans[0].topQuote).toContain("$700");
  });

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => comment(`@fan${i}`, "great video, loved it", i + 1));
    expect(rankSuperfans([{ videoTitle: "A", comments: many }], { max: 5 })).toHaveLength(5);
  });
});

describe("findQuietSuperfans", () => {
  it("flags fans silent for over two weeks", () => {
    const fans = rankSuperfans([
      {
        videoTitle: "A",
        comments: [
          comment("@gone", "used to love these", 50, "2026-06-01T00:00:00Z"),
          comment("@fresh", "still here!", 50, "2026-07-20T00:00:00Z"),
        ],
      },
    ]);
    const quiet = findQuietSuperfans(fans, "2026-07-21T00:00:00Z");
    expect(quiet.map((f) => f.author)).toEqual(["@gone"]);
  });
});

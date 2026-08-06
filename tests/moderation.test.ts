import { describe, expect, it } from "vitest";
import {
  FLAG_THRESHOLD,
  applyVerdicts,
  detectReasons,
  looksLikeImpersonator,
  normalizeName,
  scoreReasons,
  sweep,
  type FlaggedComment,
} from "@/lib/moderation";
import { getDemoPatrolData } from "@/lib/demo";
import type { Comment } from "@/lib/types";

function comment(overrides: Partial<Comment>): Comment {
  return {
    id: "c1",
    author: "Some Viewer",
    authorChannelId: "UCviewer",
    text: "Nice video!",
    likeCount: 0,
    publishedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const CTX = { channelTitle: "Tech World", ownerChannelId: "UCowner" };

describe("normalizeName", () => {
  it("folds mathematical-alphanumeric unicode back to ascii", () => {
    expect(normalizeName("𝐓𝐞𝐜𝐡 𝐖𝐨𝐫𝐥𝐝")).toBe("techworld");
    expect(normalizeName("𝗧𝗲𝗰𝗵 𝗪𝗼𝗿𝗹𝗱")).toBe("techworld");
  });

  it("folds fullwidth forms and strips punctuation and emoji", () => {
    expect(normalizeName("Ｔｅｃｈ Ｗｏｒｌｄ✅")).toBe("techworld");
    expect(normalizeName("Tech-World_Official!")).toBe("techworldofficial");
  });
});

describe("looksLikeImpersonator", () => {
  it("flags a styled-unicode copy of the channel name", () => {
    const c = comment({ author: "𝐓𝐞𝐜𝐡 𝐖𝐨𝐫𝐥𝐝✅", authorChannelId: "UCscam" });
    expect(looksLikeImpersonator(c, "Tech World", "UCowner")).toBe(true);
  });

  it("never flags the actual creator, whatever their display name", () => {
    const c = comment({ author: "Tech World", authorChannelId: "UCowner" });
    expect(looksLikeImpersonator(c, "Tech World", "UCowner")).toBe(false);
  });

  it("ignores short channel names that would match everything", () => {
    const c = comment({ author: "max fan", authorChannelId: "UCscam" });
    expect(looksLikeImpersonator(c, "Max", "UCowner")).toBe(false);
  });

  it("flags a name that merely contains the channel name", () => {
    const c = comment({ author: "Tech World (Giveaways)", authorChannelId: "UCscam" });
    expect(looksLikeImpersonator(c, "Tech World", "UCowner")).toBe(true);
  });
});

describe("detectReasons", () => {
  it("catches WhatsApp and phone-number lures", () => {
    expect(detectReasons(comment({ text: "Text me on WhatsApp +1 (804) 555-0127" }), CTX)).toContain(
      "contact_lure"
    );
    expect(detectReasons(comment({ text: "message me on telegram for tips" }), CTX)).toContain(
      "contact_lure"
    );
  });

  it("catches investment and giveaway bait", () => {
    expect(
      detectReasons(comment({ text: "I made $17,400 weekly trading forex with Mrs Camilla" }), CTX)
    ).toContain("money_bait");
    expect(
      detectReasons(comment({ text: "you have been selected! claim your prize now" }), CTX)
    ).toContain("money_bait");
  });

  it("flags off-platform links but not youtube links", () => {
    expect(detectReasons(comment({ text: "buy here https://sketchy.example.com" }), CTX)).toContain(
      "link_spam"
    );
    expect(
      detectReasons(comment({ text: "context: https://www.youtube.com/watch?v=dQw4w9WgXcQ" }), CTX)
    ).not.toContain("link_spam");
  });

  it("leaves ordinary comments alone", () => {
    expect(detectReasons(comment({ text: "The tip at 4:12 doubled my speed, thank you!" }), CTX)).toEqual(
      []
    );
    expect(
      detectReasons(comment({ text: "Can you do a follow-up on budget laptops? Would love that." }), CTX)
    ).toEqual([]);
  });
});

describe("scoring", () => {
  it("one weak signal stays under the flag threshold", () => {
    expect(scoreReasons(["link_spam"])).toBeLessThan(FLAG_THRESHOLD);
    expect(scoreReasons(["styled_unicode"])).toBeLessThan(FLAG_THRESHOLD);
  });

  it("any strong signal or two weak ones clears it", () => {
    expect(scoreReasons(["impersonation"])).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
    expect(scoreReasons(["contact_lure"])).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
    expect(scoreReasons(["link_spam", "styled_unicode"])).toBeGreaterThanOrEqual(FLAG_THRESHOLD);
  });
});

describe("sweep", () => {
  it("catches a paste-bot repeating the same text across videos", () => {
    const text = "We list refurbished laptops even cheaper, check our channel before you buy anything";
    const sets = [
      { videoId: "a", videoTitle: "A", comments: [comment({ id: "1", text })] },
      { videoId: "b", videoTitle: "B", comments: [comment({ id: "2", text })] },
    ];
    const { candidates } = sweep(sets, "Tech World", "UCowner");
    expect(candidates).toHaveLength(2);
    expect(candidates[0].reasons).toContain("repeated_across_videos");
  });

  it("does not count a repeat within a single video as cross-video", () => {
    const text = "First!! First!! First!! First!! First!! First!! First!!";
    const sets = [
      {
        videoId: "a",
        videoTitle: "A",
        comments: [comment({ id: "1", text }), comment({ id: "2", text })],
      },
    ];
    const { candidates } = sweep(sets, "Tech World", "UCowner");
    expect(candidates).toHaveLength(0);
  });

  it("flags every seeded scam in the demo dataset and none of the real viewers", () => {
    const demo = getDemoPatrolData();
    const { candidates } = sweep(demo.videos, demo.channel.title, demo.channel.channelId);
    const flaggedIds = new Set(candidates.map((c) => c.comment.id));
    // The seeded scams: two impersonators, the forex bot (twice), the giveaway
    // bot, and the cross-video shop spammer (twice).
    for (const id of ["p1", "p4", "p6", "p8", "p10", "p13", "p16"]) {
      expect(flaggedIds).toContain(id);
    }
    // The creator's own pinned comment and the real viewers stay clean —
    // including the viewer who linked a YouTube video as a source.
    for (const id of ["p2", "p3", "p5", "p7", "p9", "p11", "p12", "p14", "p15"]) {
      expect(flaggedIds).not.toContain(id);
    }
  });
});

describe("applyVerdicts", () => {
  const base: FlaggedComment[] = [
    {
      comment: comment({ id: "x" }),
      videoId: "a",
      videoTitle: "A",
      reasons: ["contact_lure"],
      score: 0.45,
      verdict: "scam",
      explanation: "heuristic",
      verdictSource: "heuristic",
    },
  ];

  it("accepts verdicts only by valid index", () => {
    const out = applyVerdicts(base, {
      verdicts: [
        { index: 1, verdict: "clean", reason: "The creator asked viewers to text them." },
        { index: 99, verdict: "scam", reason: "out of range" },
        { index: "nope", verdict: "scam" },
      ],
    });
    expect(out[0].verdict).toBe("clean");
    expect(out[0].verdictSource).toBe("llm");
    expect(out[0].explanation).toContain("creator asked");
  });

  it("ignores malformed verdict values and keeps the heuristic", () => {
    const out = applyVerdicts(base, { verdicts: [{ index: 1, verdict: "definitely-bad" }] });
    expect(out[0].verdict).toBe("scam");
    expect(out[0].verdictSource).toBe("heuristic");
  });

  it("does not mutate the input", () => {
    applyVerdicts(base, { verdicts: [{ index: 1, verdict: "clean" }] });
    expect(base[0].verdict).toBe("scam");
  });
});

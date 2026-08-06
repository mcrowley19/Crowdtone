import { describe, expect, it } from "vitest";
import {
  buildProposedActions,
  heuristicActionPlan,
  MAX_TITLE_LENGTH,
  pickQuestions,
  validateActionPlan,
  type ActionContext,
} from "@/lib/actions";
import type { Analysis, Comment, VideoMeta } from "@/lib/types";

function comment(id: string, text: string, likeCount = 0): Comment {
  return { id, author: `viewer-${id}`, text, likeCount, publishedAt: "2024-01-01T00:00:00Z" };
}

const video: VideoMeta = {
  videoId: "abcdefghijk",
  title: "I built a thing",
  channelTitle: "Test channel",
  channelId: "UC0000000000000000000000",
  description: "Old description",
  durationSeconds: 900,
  thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg",
  viewCount: 1000,
  commentCount: 20,
  publishedAt: "2024-01-01T00:00:00Z",
  source: "api",
};

const analysis: Analysis = {
  clusters: {
    themes: [
      { name: "praise", count: 4, top_quotes: ["loved it"] },
      { name: "complaint", count: 3, top_quotes: ["the title oversells it"] },
      { name: "request", count: 2, top_quotes: ["do a part 2"] },
      { name: "confusion", count: 2, top_quotes: ["what board did you use?"] },
    ],
    summary: "Mixed.",
  },
  ideas: [],
  fixes: [],
  thumbnailTexts: ["HONESTLY, IT BROKE"],
  topComplaint: "the title oversells it",
  source: "llm",
};

const comments: Comment[] = [
  comment("c1", "what board did you use? 4:32 confused me", 30),
  comment("c2", "4:35 was the best part", 4),
  comment("c3", "how do you solder that?", 12),
  comment("c4", "first", 0),
  comment("c5", "10:02 please explain this bit", 6),
];

const ctx: ActionContext = { video, comments, analysis };

describe("pickQuestions", () => {
  it("takes only question-shaped comments, most-liked first", () => {
    const picked = pickQuestions(comments);
    expect(picked.map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("skips comments with no id, since a reply needs a parent", () => {
    expect(pickQuestions([comment("", "how does this work?", 99)])).toHaveLength(0);
  });
});

describe("validateActionPlan", () => {
  const questions = pickQuestions(comments);

  it("maps replies by list position onto real comment ids", () => {
    const draft = validateActionPlan(
      {
        new_title: { text: "I built a thing and it broke", why: "honest" },
        pinned_comment: { text: "It was a Pico.", why: "asked a lot" },
        chapter_labels: [{ timestamp: "4:32", label: "The board" }],
        replies: [
          { comment_index: 1, text: "A Raspberry Pi Pico." },
          { comment_index: 2, text: "Flux first, then heat." },
        ],
      },
      questions
    );
    expect(draft.newTitle?.text).toBe("I built a thing and it broke");
    expect(draft.chapterLabels).toEqual([{ seconds: 272, label: "The board" }]);
    expect(draft.replies).toEqual([
      { commentId: "c1", text: "A Raspberry Pi Pico." },
      { commentId: "c3", text: "Flux first, then heat." },
    ]);
  });

  it("drops replies pointing outside the list rather than guessing a target", () => {
    const draft = validateActionPlan({ replies: [{ comment_index: 99, text: "hi" }, { text: "no index" }] }, questions);
    expect(draft.replies).toHaveLength(0);
  });

  it("never proposes the same comment twice", () => {
    const draft = validateActionPlan(
      { replies: [{ comment_index: 1, text: "one" }, { comment_index: 1, text: "two" }] },
      questions
    );
    expect(draft.replies).toHaveLength(1);
  });

  it("clamps a title to what YouTube accepts", () => {
    const draft = validateActionPlan({ new_title: { text: "x".repeat(400) } }, questions);
    expect(draft.newTitle!.text.length).toBe(MAX_TITLE_LENGTH);
  });

  it("survives a completely empty response", () => {
    const draft = validateActionPlan({}, questions);
    expect(draft).toEqual({ chapterLabels: [], replies: [] });
  });
});

describe("buildProposedActions", () => {
  it("turns a draft into applyable actions with before/after", () => {
    const draft = validateActionPlan(
      {
        new_title: { text: "I built a thing and it broke", why: "honest about the outcome" },
        description_intro: "Here is what actually happened.",
        chapter_labels: [
          { timestamp: "4:32", label: "The board" },
          { timestamp: "10:02", label: "Where it broke" },
        ],
        pinned_comment: { text: "It was a Pico — full parts list below.", why: "most asked" },
        replies: [{ comment_index: 1, text: "A Raspberry Pi Pico." }],
      },
      pickQuestions(comments)
    );
    const actions = buildProposedActions(ctx, draft, "llm");
    const kinds = actions.map((a) => a.kind);

    expect(kinds).toContain("retitle");
    expect(kinds).toContain("add_chapters");
    expect(kinds).toContain("post_comment");
    expect(kinds).toContain("reply_to_comment");
    expect(kinds).toContain("set_thumbnail");

    const retitle = actions.find((a) => a.kind === "retitle")!;
    expect(retitle.before).toBe(video.title);
    expect(retitle.after).toBe("I built a thing and it broke");

    const chapters = actions.find((a) => a.kind === "add_chapters")!;
    expect(chapters.payload.description).toContain("0:00");
    expect(chapters.payload.description).toContain("4:32 The board");
    expect(chapters.payload.description).toContain("Old description");

    const reply = actions.find((a) => a.kind === "reply_to_comment")!;
    expect(reply.payload.parentId).toBe("c1");
  });

  it("does not propose a retitle to the title the video already has", () => {
    const actions = buildProposedActions(ctx, { chapterLabels: [], replies: [], newTitle: { text: video.title, why: "" } }, "llm");
    expect(actions.some((a) => a.kind === "retitle")).toBe(false);
  });

  it("still proposes something without an LLM", () => {
    const actions = buildProposedActions(ctx, heuristicActionPlan(ctx), "heuristic");
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.source === "heuristic")).toBe(true);
    expect(actions.some((a) => a.kind === "add_chapters")).toBe(true);
  });
});

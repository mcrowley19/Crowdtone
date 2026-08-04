import { describe, expect, it } from "vitest";
import { mapCommentThreads, parseVideoInput, pickThumbnail } from "@/lib/youtube";

describe("parseVideoInput", () => {
  it("parses standard watch URLs", () => {
    expect(parseVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });

  it("parses youtu.be, shorts, embed and live URLs", () => {
    expect(parseVideoInput("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("https://m.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts a bare 11-char video ID and rejects junk", () => {
    expect(parseVideoInput("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(parseVideoInput("")).toBeNull();
    expect(parseVideoInput("not a url at all")).toBeNull();
    expect(parseVideoInput("https://vimeo.com/12345")).toBeNull();
    expect(parseVideoInput("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("mapCommentThreads", () => {
  it("maps a commentThreads.list response into Comment objects", () => {
    const api = {
      items: [
        {
          id: "t1",
          snippet: {
            topLevelComment: {
              id: "c1",
              snippet: {
                textOriginal: "Great video!",
                authorDisplayName: "@viewer1",
                likeCount: 12,
                publishedAt: "2026-01-01T00:00:00Z",
              },
            },
          },
        },
        { id: "t2", snippet: { topLevelComment: { id: "c2", snippet: { textOriginal: "   " } } } },
        { id: "t3", snippet: {} },
      ],
    };
    const comments = mapCommentThreads(api);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual({
      id: "c1",
      author: "@viewer1",
      text: "Great video!",
      likeCount: 12,
      publishedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("tolerates a malformed response body", () => {
    expect(mapCommentThreads({})).toEqual([]);
    expect(mapCommentThreads(null)).toEqual([]);
    expect(mapCommentThreads({ items: "nope" })).toEqual([]);
  });
});

describe("pickThumbnail", () => {
  it("prefers the highest resolution available", () => {
    expect(
      pickThumbnail({ default: { url: "d" }, high: { url: "h" }, maxres: { url: "m" } })
    ).toBe("m");
    expect(pickThumbnail({ default: { url: "d" } })).toBe("d");
    expect(pickThumbnail(undefined)).toBe("");
  });
});

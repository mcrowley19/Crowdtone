import { describe, expect, it } from "vitest";
import {
  buildChapters,
  extractTimestampMentions,
  formatTimestamp,
  mergeChaptersIntoDescription,
  parseISODuration,
  parseTimestamp,
  renderChapterBlock,
} from "@/lib/chapters";
import type { Comment } from "@/lib/types";

function comment(text: string, likeCount = 0, id = Math.random().toString(36).slice(2)): Comment {
  return { id, author: "viewer", text, likeCount, publishedAt: "2024-01-01T00:00:00Z" };
}

describe("parseISODuration", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseISODuration("PT1H2M3S")).toBe(3723);
    expect(parseISODuration("PT12M30S")).toBe(750);
    expect(parseISODuration("PT45S")).toBe(45);
    expect(parseISODuration("P1DT2H")).toBe(93600);
  });

  it("returns 0 for junk", () => {
    expect(parseISODuration("")).toBe(0);
    expect(parseISODuration("banana")).toBe(0);
  });
});

describe("timestamp formatting", () => {
  it("round-trips", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(272)).toBe("4:32");
    expect(formatTimestamp(3723)).toBe("1:02:03");
    expect(parseTimestamp("4:32")).toBe(272);
    expect(parseTimestamp("1:02:03")).toBe(3723);
  });

  it("rejects out-of-range parts", () => {
    expect(parseTimestamp("4:75")).toBeNull();
    expect(parseTimestamp("1:99:00")).toBeNull();
    expect(parseTimestamp("nope")).toBeNull();
  });
});

describe("extractTimestampMentions", () => {
  it("clusters nearby mentions and ranks by how many viewers cited them", () => {
    const mentions = extractTimestampMentions(
      [
        comment("the bit at 4:32 was great"),
        comment("4:35 is where it clicked for me"),
        comment("wait, 4:30 — what did you mean?"),
        comment("10:15 blew my mind"),
      ],
      1200
    );
    expect(mentions).toHaveLength(2);
    expect(mentions[0].count).toBe(3);
    expect(mentions[0].seconds).toBe(270);
    expect(mentions[0].quotes.length).toBeGreaterThan(0);
    expect(mentions[1].seconds).toBe(615);
  });

  it("ignores timestamps past the end of the video", () => {
    expect(extractTimestampMentions([comment("meeting at 12:30 tomorrow")], 300)).toHaveLength(0);
  });

  it("does not read a bare number or a date as a timestamp", () => {
    expect(extractTimestampMentions([comment("1000 subs!"), comment("2024")], 600)).toHaveLength(0);
  });
});

describe("buildChapters", () => {
  it("always starts at 0:00 and spaces chapters at least 10s apart", () => {
    const chapters = buildChapters(
      [
        { seconds: 90, label: "The build" },
        { seconds: 95, label: "Too close to the last one" },
        { seconds: 300, label: "The result" },
      ],
      900
    );
    expect(chapters.map((c) => c.seconds)).toEqual([0, 90, 300]);
    expect(chapters[0].label).toBe("Intro");
  });

  it("returns nothing when YouTube would not render it", () => {
    expect(buildChapters([{ seconds: 60, label: "Only one" }], 600)).toEqual([]);
  });

  it("drops moments at or past the end of the video", () => {
    const chapters = buildChapters(
      [
        { seconds: 30, label: "a" },
        { seconds: 60, label: "b" },
        { seconds: 295, label: "past the end" },
      ],
      300
    );
    expect(chapters.map((c) => c.seconds)).toEqual([0, 30, 60]);
  });

  it("renders the block YouTube expects", () => {
    expect(renderChapterBlock([{ seconds: 0, label: "Intro" }, { seconds: 272, label: "The fix" }])).toBe(
      "0:00 Intro\n4:32 The fix"
    );
  });
});

describe("mergeChaptersIntoDescription", () => {
  const chapters = [
    { seconds: 0, label: "Intro" },
    { seconds: 60, label: "Setup" },
    { seconds: 240, label: "Result" },
  ];

  it("appends to a description that has no chapters", () => {
    const out = mergeChaptersIntoDescription("Subscribe for more.", chapters);
    expect(out).toBe("Subscribe for more.\n\nChapters\n0:00 Intro\n1:00 Setup\n4:00 Result");
  });

  it("replaces an existing chapter block instead of duplicating it", () => {
    const existing = "Intro text\n\nChapters\n0:00 Old\n1:00 Older\n2:00 Oldest\n\nLinks below";
    const out = mergeChaptersIntoDescription(existing, chapters);
    expect(out).toContain("0:00 Intro");
    expect(out).not.toContain("0:00 Old\n");
    expect(out.match(/0:00/g)).toHaveLength(1);
    expect(out).toContain("Links below");
  });

  it("leaves the description alone when there are no chapters", () => {
    expect(mergeChaptersIntoDescription("unchanged", [])).toBe("unchanged");
  });
});

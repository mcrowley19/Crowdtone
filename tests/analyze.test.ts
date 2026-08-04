import { describe, expect, it } from "vitest";
import {
  deriveTopComplaint,
  validateClusters,
  validateFixes,
  validateIdeas,
  validateThumbnailTexts,
} from "@/lib/analyze";
import { parseLLMJson } from "@/lib/llm";

describe("parseLLMJson", () => {
  it("parses clean JSON and fenced JSON", () => {
    expect(parseLLMJson('{"a": 1}')).toEqual({ a: 1 });
    expect(parseLLMJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in prose", () => {
    expect(parseLLMJson('Sure! Here you go: {"themes": []} Hope that helps.')).toEqual({
      themes: [],
    });
  });

  it("throws when there is no JSON", () => {
    expect(() => parseLLMJson("no json here")).toThrow();
  });
});

describe("validateClusters", () => {
  it("normalizes theme names and always returns all four themes", () => {
    const result = validateClusters({
      themes: [
        { name: "Complaints", count: "7", top_quotes: ["too long", 42, "clickbait"] },
        { name: "praise", count: 3, top_quotes: ["love it"] },
      ],
      summary: "Viewers are torn.",
    });
    expect(result.themes.map((t) => t.name)).toEqual(["praise", "complaint", "request", "confusion"]);
    const complaint = result.themes.find((t) => t.name === "complaint")!;
    expect(complaint.count).toBe(7);
    expect(complaint.top_quotes).toEqual(["too long", "clickbait"]);
    expect(result.themes.find((t) => t.name === "request")!.count).toBe(0);
    expect(result.summary).toBe("Viewers are torn.");
  });

  it("survives a completely malformed payload", () => {
    const result = validateClusters(null);
    expect(result.themes).toHaveLength(4);
    expect(result.summary).toBeTruthy();
  });
});

describe("validateIdeas", () => {
  it("caps at 3 ideas and normalizes interest", () => {
    const ideas = validateIdeas({
      ideas: [
        { title: "A", hook: "h", evidence_quotes: ["q"], estimated_interest: "HIGH" },
        { title: "B", estimated_interest: "banana" },
        { title: "C" },
        { title: "D" },
        { hook: "no title, dropped" },
      ],
    });
    expect(ideas).toHaveLength(3);
    expect(ideas[0].estimated_interest).toBe("high");
    expect(ideas[1].estimated_interest).toBe("medium");
  });
});

describe("validateFixes", () => {
  it("keeps 3-5 well-formed fixes and drops broken ones", () => {
    const fixes = validateFixes({
      fixes: [
        { issue: "i1", fix: "f1", evidence_quote: "q1" },
        { issue: "i2", fix: "f2" },
        { issue: "", fix: "dropped" },
        { issue: "i3", fix: "f3" },
        { issue: "i4", fix: "f4" },
        { issue: "i5", fix: "f5" },
        { issue: "i6", fix: "f6" },
      ],
    });
    expect(fixes).toHaveLength(5);
    expect(fixes[1].evidence_quote).toBe("");
  });
});

describe("validateThumbnailTexts", () => {
  it("enforces max 6 words and max 3 texts", () => {
    const texts = validateThumbnailTexts({
      texts: ["one two three four five six seven eight", "SHORT ONE", "ok", "extra dropped"],
    });
    expect(texts).toHaveLength(3);
    expect(texts[0]).toBe("one two three four five six");
  });
});

describe("deriveTopComplaint", () => {
  it("prefers a complaint quote, then confusion, then a default", () => {
    const base = validateClusters({ themes: [], summary: "s" });
    expect(deriveTopComplaint(base)).toMatch(/title and thumbnail/);

    const withComplaint = validateClusters({
      themes: [{ name: "complaint", count: 1, top_quotes: ["misleading title"] }],
      summary: "s",
    });
    expect(deriveTopComplaint(withComplaint)).toBe("misleading title");
  });
});

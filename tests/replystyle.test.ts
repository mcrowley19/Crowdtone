import { describe, expect, it } from "vitest";
import { applyStyleGuards, buildStyleProfile, describeStyleProfile } from "@/lib/replystyle";

const CASUAL_REPLIES = [
  "thanks! yeah the 16 inch runs cooler 🙏",
  "good question — it's the base model in every test 🙏",
  "ha, fair. next one will cover that!",
  "thanks for watching! the chart is in the description 🙏",
  "yeah that was my mistake, fixed in the pinned comment!",
];

const FORMAL_REPLIES = [
  "Thank you for pointing that out. The correction is in the description.",
  "The test used the base configuration throughout.",
  "That comparison is planned for a future video.",
];

describe("buildStyleProfile", () => {
  it("returns null below three replies", () => {
    expect(buildStyleProfile(["one", "two"])).toBeNull();
  });

  it("measures emoji habits and exclamations", () => {
    const profile = buildStyleProfile(CASUAL_REPLIES)!;
    expect(profile.sampleSize).toBe(5);
    expect(profile.emojiRate).toBeGreaterThan(0.5);
    expect(profile.topEmoji).toContain("🙏");
    expect(profile.lowercaseRate).toBeGreaterThan(0.5);
  });

  it("recognizes a formal, emoji-free voice", () => {
    const profile = buildStyleProfile(FORMAL_REPLIES)!;
    expect(profile.emojiRate).toBe(0);
    expect(profile.lowercaseRate).toBe(0);
  });

  it("is deterministic", () => {
    expect(buildStyleProfile(CASUAL_REPLIES)).toEqual(buildStyleProfile(CASUAL_REPLIES));
  });
});

describe("describeStyleProfile", () => {
  it("tells the model to skip emoji for a formal creator", () => {
    const text = describeStyleProfile(buildStyleProfile(FORMAL_REPLIES)!);
    expect(text).toContain("no emoji");
    expect(text).toContain("3 of their real replies");
  });

  it("names the creator's actual emoji for a casual one", () => {
    const text = describeStyleProfile(buildStyleProfile(CASUAL_REPLIES)!);
    expect(text).toContain("🙏");
  });
});

describe("applyStyleGuards", () => {
  it("strips emoji the creator never uses", () => {
    const profile = buildStyleProfile(FORMAL_REPLIES)!;
    expect(applyStyleGuards("Great question! 😄🔥 The answer is 16GB.", profile)).not.toMatch(/😄|🔥/);
  });

  it("keeps emoji for a creator who uses them", () => {
    const profile = buildStyleProfile(CASUAL_REPLIES)!;
    expect(applyStyleGuards("thanks! 🙏", profile)).toContain("🙏");
  });

  it("cuts an over-long draft at a sentence boundary", () => {
    const profile = buildStyleProfile(FORMAL_REPLIES)!;
    const rambling = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} adds more words.`).join(" ");
    const out = applyStyleGuards(rambling, profile);
    expect(out.length).toBeLessThan(rambling.length);
    expect(out.endsWith(".") || out.endsWith("…")).toBe(true);
  });

  it("appends a habitual sign-off exactly once", () => {
    const profile = buildStyleProfile([
      "Thanks for watching.\n— Mike",
      "Fixed in the description.\n— Mike",
      "Good catch.\n— Mike",
    ])!;
    expect(profile.signoff).toBe("— Mike");
    const out = applyStyleGuards("The answer is yes.", profile);
    expect(out.endsWith("— Mike")).toBe(true);
    expect(out.match(/— Mike/g)).toHaveLength(1);
    expect(applyStyleGuards(out, profile).match(/— Mike/g)).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { buildCaptionPack, buildEdl, buildHandoffFiles, buildMarkerCsv, toTimecode } from "@/lib/handoff";
import type { ClipSuggestion } from "@/lib/clips";

const CLIPS: ClipSuggestion[] = [
  {
    startSeconds: 247,
    endSeconds: 297,
    range: "4:07–4:57",
    mentions: 2,
    quote: 'The bit at 4:12 "killed" me, honestly',
    tone: "highlight",
    watchUrl: "https://www.youtube.com/watch?v=vid123&t=247s",
  },
  {
    startSeconds: 925,
    endSeconds: 975,
    range: "15:25–16:15",
    mentions: 1,
    quote: "Great explanation at 15:30",
    tone: "helpful",
    watchUrl: "https://www.youtube.com/watch?v=vid123&t=925s",
  },
];

describe("toTimecode", () => {
  it("formats seconds as HH:MM:SS:FF", () => {
    expect(toTimecode(0)).toBe("00:00:00:00");
    expect(toTimecode(247)).toBe("00:04:07:00");
    expect(toTimecode(3723)).toBe("01:02:03:00");
  });

  it("never goes negative", () => {
    expect(toTimecode(-5)).toBe("00:00:00:00");
  });
});

describe("buildMarkerCsv", () => {
  it("emits a header plus one row per clip with escaped quotes", () => {
    const csv = buildMarkerCsv(CLIPS);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Marker Name,Description,In,Out,Duration,Marker Type");
    // The quote contains double quotes and a comma-adjacent phrase — must be
    // CSV-escaped, not mangled.
    expect(lines[1]).toContain('""killed""');
    expect(lines[1]).toContain("00:04:07:00");
    expect(lines[1]).toContain("00:00:50:00");
  });
});

describe("buildEdl", () => {
  it("lays clips back to back on the record side", () => {
    const edl = buildEdl(CLIPS, "My Video");
    expect(edl).toContain("TITLE: My Video — AudienceSignal cut list");
    expect(edl).toContain("FCM: NON-DROP FRAME");
    // Event 1: source 4:07→4:57, record 0:00→0:50.
    expect(edl).toContain("001  AX       V     C        00:04:07:00 00:04:57:00 00:00:00:00 00:00:50:00");
    // Event 2 starts where event 1 ended on the record side.
    expect(edl).toContain("002  AX       V     C        00:15:25:00 00:16:15:00 00:00:50:00 00:01:40:00");
  });
});

describe("buildCaptionPack", () => {
  it("opens each Short on its viewer quote with the deep link", () => {
    const pack = buildCaptionPack(CLIPS, "My Video");
    expect(pack).toContain("SHORT 1 · 4:07–4:57");
    expect(pack).toContain('Open the Short on this viewer quote: "The bit at 4:12');
    expect(pack).toContain("https://www.youtube.com/watch?v=vid123&t=925s");
  });
});

describe("buildHandoffFiles", () => {
  it("returns the three files with safe names", () => {
    const files = buildHandoffFiles("My Video", "vid123", CLIPS);
    expect(files.map((f) => f.name)).toEqual([
      "vid123-shorts-markers.csv",
      "vid123-shorts-cuts.edl",
      "vid123-shorts-captions.txt",
    ]);
    expect(files.every((f) => f.content.length > 50)).toBe(true);
  });

  it("sanitizes a hostile video id out of the filename", () => {
    const files = buildHandoffFiles("t", "../../etc", CLIPS);
    expect(files[0].name).toBe("etc-shorts-markers.csv");
  });
});

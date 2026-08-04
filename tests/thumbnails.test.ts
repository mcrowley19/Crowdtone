import { describe, expect, it } from "vitest";
import {
  buildOverlaySvg,
  escapeXml,
  fallbackBackgroundSvg,
  frameUrlCandidates,
  OVERLAY_STYLES,
  wrapText,
} from "@/lib/thumbnails";

describe("frameUrlCandidates", () => {
  it("tries maxres, then sd, then hq for the requested frame", () => {
    const urls = frameUrlCandidates("dQw4w9WgXcQ", 2);
    expect(urls).toEqual([
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxres2.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/sd2.jpg",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hq2.jpg",
    ]);
  });
});

describe("wrapText", () => {
  it("wraps into uppercase lines within the character budget", () => {
    const lines = wrapText("no clickbait real results", 14);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(" ")).toBe("NO CLICKBAIT REAL RESULTS");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
  });

  it("caps at 3 lines with an ellipsis", () => {
    const lines = wrapText("one two three four five six seven eight nine ten eleven twelve", 8);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith("…")).toBe(true);
  });

  it("never splits a single long word into an infinite loop", () => {
    expect(wrapText("supercalifragilistic", 8)).toEqual(["SUPERCALIFRAGILISTIC"]);
  });
});

describe("escapeXml", () => {
  it("escapes all XML-special characters", () => {
    expect(escapeXml(`<b>&"tricky"'</b>`)).toBe(
      "&lt;b&gt;&amp;&quot;tricky&quot;&apos;&lt;/b&gt;"
    );
  });
});

describe("buildOverlaySvg", () => {
  it("produces valid-looking SVG for every style with special characters escaped", () => {
    for (const style of OVERLAY_STYLES) {
      const svg = buildOverlaySvg(`Honest <review> & more`, style);
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("&lt;REVIEW&gt;");
      expect(svg).not.toContain("<REVIEW>");
    }
  });
});

describe("fallbackBackgroundSvg", () => {
  it("renders distinct gradients per variant", () => {
    expect(fallbackBackgroundSvg(0)).not.toBe(fallbackBackgroundSvg(1));
    expect(fallbackBackgroundSvg(0)).toContain("<svg");
  });
});

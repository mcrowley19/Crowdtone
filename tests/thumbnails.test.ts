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

import { regionLuminance, scrimOpacityFor, textRegionFor, THUMB_H, THUMB_W } from "@/lib/thumbnails";

describe("luminance-aware scrims", () => {
  it("weights the veil by how bright the frame is under the text", () => {
    // Dark frame: barely any veil on the center style, light gradient.
    expect(scrimOpacityFor("big-center", 40)).toBeLessThan(0.2);
    expect(scrimOpacityFor("gradient-bar", 40)).toBeLessThan(0.85);
    // Bright frame: heavy veil so white type keeps contrast.
    expect(scrimOpacityFor("big-center", 220)).toBeGreaterThan(0.45);
    expect(scrimOpacityFor("gradient-bar", 220)).toBeGreaterThanOrEqual(0.95);
    // The callout box carries its own solid background; only bright frames
    // get a soft shadow under it.
    expect(scrimOpacityFor("callout-box", 40)).toBe(0);
    expect(scrimOpacityFor("callout-box", 220)).toBeGreaterThan(0.2);
  });

  it("measures the region each style actually covers", () => {
    const bar = textRegionFor("gradient-bar");
    expect(bar.top).toBeGreaterThan(300); // bottom band
    const box = textRegionFor("callout-box");
    expect(box.top).toBe(0); // top-left
    const center = textRegionFor("big-center");
    expect(center.left).toBeGreaterThan(0); // middle
  });

  // sharp's stats() reports on the image it was handed and ignores pipeline
  // operations, so a chained .extract().stats() measures the whole frame and
  // every style gets the same number. Half-black, half-white catches that.
  it("reads only the region, not the whole frame", async () => {
    const sharp = (await import("sharp")).default;
    const split = await sharp(
      Buffer.from(
        `<svg width="${THUMB_W}" height="${THUMB_H}" xmlns="http://www.w3.org/2000/svg">
           <rect width="${THUMB_W}" height="${THUMB_H / 2}" fill="#ffffff"/>
           <rect y="${THUMB_H / 2}" width="${THUMB_W}" height="${THUMB_H / 2}" fill="#000000"/>
         </svg>`
      )
    )
      .png()
      .toBuffer();

    const top = await regionLuminance(split, "callout-box"); // upper-left
    const bottom = await regionLuminance(split, "gradient-bar"); // bottom band

    expect(top).toBeGreaterThan(240); // sits on the white half
    expect(bottom).toBeLessThan(60); // sits on the black half
    expect(scrimOpacityFor("callout-box", top)).toBeGreaterThan(0);
    expect(scrimOpacityFor("gradient-bar", bottom)).toBeLessThan(0.85);
  });
});

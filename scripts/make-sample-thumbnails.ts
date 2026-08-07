/**
 * Regenerates the landing page's sample thumbnails.
 *
 *   npx tsx scripts/make-sample-thumbnails.ts <base-frame.jpg>
 *
 * The "published" image is a hand-drawn imitation of what a channel would have
 * uploaded itself — the oversold packaging the demo comments complain about.
 * The "redrawn" images go through lib/thumbnails.ts, the same compositor the
 * app runs on real YouTube stills, so the landing page shows real output.
 */
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { ensureFontsConfigured } from "../lib/fonts";
import {
  buildOverlaySvg,
  regionLuminance,
  THUMB_W,
  THUMB_H,
  OVERLAY_STYLES,
  type OverlayStyle,
} from "../lib/thumbnails";

const FONT = `'DejaVu Sans', Arial, Helvetica, sans-serif`;
const OUT = path.join(process.cwd(), "public");

/** The creator's own packaging: big, yellow, and promising more than the video
 * delivers. Drawn here rather than by the app, because this is the "before". */
function publishedOverlaySvg(): string {
  return `<svg width="${THUMB_W}" height="${THUMB_H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="v" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#000" stop-opacity="0.68"/>
    <stop offset="0.6" stop-color="#000" stop-opacity="0.16"/>
    <stop offset="1" stop-color="#000" stop-opacity="0"/>
  </linearGradient></defs>
  <rect width="${THUMB_W}" height="${THUMB_H}" fill="url(#v)"/>
  <text font-family="${FONT}" font-size="52" font-weight="800" fill="#ffffff"
    stroke="#000" stroke-width="8" paint-order="stroke" stroke-linejoin="round"
    x="64" y="300">AFTER 30 DAYS</text>
  <text font-family="${FONT}" font-size="152" font-weight="800" fill="#ffd400"
    stroke="#000" stroke-width="14" paint-order="stroke" stroke-linejoin="round"
    x="58" y="446">INSANE.</text>
  <rect x="64" y="486" width="240" height="12" fill="#ffd400"/>
</svg>`;
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("usage: make-sample-thumbnails.ts <base-frame.jpg>");
  await ensureFontsConfigured();

  const base = await sharp(source)
    .resize(THUMB_W, THUMB_H, { fit: "cover", position: "attention" })
    .toBuffer();

  await fs.writeFile(
    path.join(OUT, "demo-thumb.jpg"),
    await sharp(base)
      .composite([{ input: Buffer.from(publishedOverlaySvg()) }])
      .jpeg({ quality: 88 })
      .toBuffer()
  );

  const texts: Record<OverlayStyle, string> = {
    "callout-box": "The honest version",
    "gradient-bar": "The 8 minutes that matter",
    "big-center": "30 day real test",
  };
  for (const style of OVERLAY_STYLES) {
    const luminance = await regionLuminance(base, style);
    await fs.writeFile(
      path.join(OUT, `sample-${style}.jpg`),
      await sharp(base)
        .composite([
          { input: Buffer.from(buildOverlaySvg(texts[style], style, THUMB_W, THUMB_H, luminance)) },
        ])
        .jpeg({ quality: 88 })
        .toBuffer()
    );
    console.log(`sample-${style}.jpg  luminance ${Math.round(luminance)}`);
  }
}

main();

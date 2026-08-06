import type { ThumbnailVariant } from "./types";
import { ensureFontsConfigured } from "./fonts";

export const THUMB_W = 1280;
export const THUMB_H = 720;

/**
 * YouTube publishes three preview stills for every public video at
 * predictable URLs: maxres1/2/3.jpg (1280x720), sd1/2/3.jpg, hq1/2/3.jpg.
 * We try highest-res first. These are real imagery from the video, but they
 * are YouTube's three fixed picks — this app does not do arbitrary frame
 * extraction (that would need the video bytes), and its UI and README say so.
 */
export function frameUrlCandidates(videoId: string, frame: 1 | 2 | 3): string[] {
  return [
    `https://i.ytimg.com/vi/${videoId}/maxres${frame}.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sd${frame}.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hq${frame}.jpg`,
  ];
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap; caps at `maxLines` lines, ellipsizing the last. */
export function wrapText(text: string, maxCharsPerLine = 14, maxLines = 3): string[] {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxCharsPerLine - 1)}…`;
    return kept;
  }
  return lines;
}

// 'DejaVu Sans' leads because it is the one font we ship ourselves (assets/fonts);
// the rest are there for systems that have them. See lib/fonts.ts.
const FONT = `'DejaVu Sans', Arial, Helvetica, sans-serif`;

export const OVERLAY_STYLES = ["gradient-bar", "callout-box", "big-center"] as const;
export type OverlayStyle = (typeof OVERLAY_STYLES)[number];

/** The region of the frame each style lays text over — measured, not guessed. */
export function textRegionFor(style: OverlayStyle, w = THUMB_W, h = THUMB_H) {
  if (style === "gradient-bar") return { left: 0, top: Math.round(h * 0.55), width: w, height: Math.round(h * 0.45) };
  if (style === "callout-box") return { left: 0, top: 0, width: Math.round(w * 0.6), height: Math.round(h * 0.45) };
  return { left: Math.round(w * 0.15), top: Math.round(h * 0.2), width: Math.round(w * 0.7), height: Math.round(h * 0.6) };
}

/**
 * How hard the scrim under the text has to work, given the measured mean
 * luminance (0–255) of the region the text sits on. A bright frame needs a
 * heavier veil for white type to hold contrast; a dark frame barely needs one.
 */
export function scrimOpacityFor(style: OverlayStyle, luminance: number): number {
  const t = Math.min(1, Math.max(0, (luminance - 60) / 140));
  if (style === "gradient-bar") return Math.round((0.82 + t * 0.16) * 100) / 100;
  if (style === "big-center") return Math.round((0.16 + t * 0.32) * 100) / 100;
  // callout-box text sits on its own solid box; the scrim is a soft shadow
  // under the box on bright frames only.
  return Math.round(t * 0.25 * 100) / 100;
}

/** Builds the SVG layer composited over a frame. Three distinct looks, each
 * with its scrim weighted by the measured luminance under the text. */
export function buildOverlaySvg(
  text: string,
  style: OverlayStyle,
  w = THUMB_W,
  h = THUMB_H,
  luminance = 110
): string {
  const lines = wrapText(text);
  const scrim = scrimOpacityFor(style, luminance);

  if (style === "gradient-bar") {
    const size = 92;
    const lineHeight = size * 1.12;
    const blockH = lines.length * lineHeight + 60;
    const tspans = lines
      .map(
        (l, i) =>
          `<tspan x="64" y="${h - blockH + 40 + (i + 1) * lineHeight - 20}">${escapeXml(l)}</tspan>`
      )
      .join("");
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#000" stop-opacity="0"/>
    <stop offset="1" stop-color="#000" stop-opacity="${scrim}"/>
  </linearGradient></defs>
  <rect x="0" y="${h - blockH - 120}" width="${w}" height="${blockH + 120}" fill="url(#g)"/>
  <rect x="64" y="${h - blockH - 26}" width="120" height="10" fill="#facc15"/>
  <text font-family="${FONT}" font-size="${size}" font-weight="800" fill="#ffffff">${tspans}</text>
</svg>`;
  }

  if (style === "callout-box") {
    const size = 76;
    const lineHeight = size * 1.2;
    const widest = Math.max(...lines.map((l) => l.length));
    // 0.72em ≈ the average advance of DejaVu Sans Bold uppercase, which is what we
    // ship; a narrower estimate lets long lines spill past the box border.
    const boxW = Math.min(w - 96, widest * size * 0.72 + 80);
    const boxH = lines.length * lineHeight + 56;
    const tspans = lines
      .map((l, i) => `<tspan x="88" y="${88 + (i + 1) * lineHeight - 24}">${escapeXml(l)}</tspan>`)
      .join("");
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  ${scrim > 0 ? `<rect x="60" y="62" width="${boxW}" height="${boxH}" rx="18" fill="#000" opacity="${scrim}"/>` : ""}
  <rect x="48" y="48" width="${boxW}" height="${boxH}" rx="18" fill="#dc2626" opacity="0.96"/>
  <rect x="48" y="48" width="${boxW}" height="${boxH}" rx="18" fill="none" stroke="#ffffff" stroke-width="6"/>
  <text font-family="${FONT}" font-size="${size}" font-weight="800" fill="#ffffff">${tspans}</text>
</svg>`;
  }

  // big-center: huge outlined text, classic high-CTR style
  const size = 118;
  const lineHeight = size * 1.08;
  const totalH = lines.length * lineHeight;
  const startY = h / 2 - totalH / 2 + size * 0.8;
  const tspans = lines
    .map((l, i) => `<tspan x="${w / 2}" y="${startY + i * lineHeight}">${escapeXml(l)}</tspan>`)
    .join("");
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${w}" height="${h}" fill="#000" opacity="${scrim}"/>
  <text text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="800"
    fill="#ffffff" stroke="#000000" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${tspans}</text>
</svg>`;
}

/** Backdrop used when a real frame can't be fetched (demo mode / offline). */
export function fallbackBackgroundSvg(variant: number, w = THUMB_W, h = THUMB_H): string {
  const palettes = [
    ["#22303c", "#1a252f"],
    ["#5d1f1f", "#491717"],
    ["#1f3a5f", "#162c49"],
  ];
  const [base, band] = palettes[variant % palettes.length];
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${base}"/>
  <polygon points="0,${h} ${w * 0.42},0 ${w},0 ${w},${h}" fill="${band}"/>
</svg>`;
}

async function fetchFrame(videoId: string, frame: 1 | 2 | 3): Promise<Buffer | null> {
  for (const url of frameUrlCandidates(videoId, frame)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // YouTube serves a tiny grey placeholder for some missing frames — skip those.
      if (buf.length < 2000) continue;
      return buf;
    } catch {
      continue;
    }
  }
  return null;
}

export async function generateVariants(videoId: string, texts: string[]): Promise<ThumbnailVariant[]> {
  // Must happen before librsvg first resolves a font, i.e. before sharp loads.
  await ensureFontsConfigured();
  const sharp = (await import("sharp")).default;
  const variants: ThumbnailVariant[] = [];
  for (let i = 0; i < 3; i++) {
    const text = texts[i] ?? texts[texts.length - 1] ?? "WATCH THIS";
    const style = OVERLAY_STYLES[i % OVERLAY_STYLES.length];
    const frameNo = ((i % 3) + 1) as 1 | 2 | 3;
    const frame = videoId === "DEMO" ? null : await fetchFrame(videoId, frameNo);

    const background = frame
      ? await sharp(frame).resize(THUMB_W, THUMB_H, { fit: "cover" }).toBuffer()
      : await sharp(Buffer.from(fallbackBackgroundSvg(i))).png().toBuffer();

    // Measure the region the text will sit on, so the scrim is as heavy as
    // this frame needs — not a one-size veil that muddies dark frames and
    // still loses white type on bright ones.
    let luminance = 110;
    try {
      const region = textRegionFor(style);
      const stats = await sharp(background).extract(region).stats();
      const [r, g, b] = stats.channels;
      luminance = 0.2126 * (r?.mean ?? 110) + 0.7152 * (g?.mean ?? 110) + 0.0722 * (b?.mean ?? 110);
    } catch {
      // A stats failure only costs adaptivity; the default scrim still works.
    }

    const jpeg = await sharp(background)
      .composite([{ input: Buffer.from(buildOverlaySvg(text, style, THUMB_W, THUMB_H, luminance)) }])
      .jpeg({ quality: 88 })
      .toBuffer();

    variants.push({
      dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      style,
      text,
      frameSource: frame ? "yt-still" : "generated",
    });
  }
  return variants;
}

import type { ThumbnailVariant } from "./types";
import { ensureFontsConfigured } from "./fonts";

export const THUMB_W = 1280;
export const THUMB_H = 720;

/**
 * YouTube hosts real frames from every public video at predictable URLs:
 * maxres1/2/3.jpg (1280x720), sd1/2/3.jpg (640x480), hq1/2/3.jpg (480x360).
 * We try highest-res first. No yt-dlp/ffmpeg needed — works with plain HTTPS.
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

/** Builds the SVG layer composited over a frame. Three distinct looks. */
export function buildOverlaySvg(text: string, style: OverlayStyle, w = THUMB_W, h = THUMB_H): string {
  const lines = wrapText(text);

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
    <stop offset="1" stop-color="#000" stop-opacity="0.92"/>
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
    const boxW = Math.min(w - 96, widest * size * 0.62 + 80);
    const boxH = lines.length * lineHeight + 56;
    const tspans = lines
      .map((l, i) => `<tspan x="88" y="${88 + (i + 1) * lineHeight - 24}">${escapeXml(l)}</tspan>`)
      .join("");
    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
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
  <rect x="0" y="0" width="${w}" height="${h}" fill="#000" opacity="0.28"/>
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

    const base = frame
      ? sharp(frame).resize(THUMB_W, THUMB_H, { fit: "cover" })
      : sharp(Buffer.from(fallbackBackgroundSvg(i)));

    const jpeg = await base
      .composite([{ input: Buffer.from(buildOverlaySvg(text, style)) }])
      .jpeg({ quality: 88 })
      .toBuffer();

    variants.push({
      dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
      style,
      text,
      frameSource: frame ? "video-frame" : "generated",
    });
  }
  return variants;
}

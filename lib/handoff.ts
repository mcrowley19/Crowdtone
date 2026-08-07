import type { ClipSuggestion } from "./clips";
import { TONE_LABEL } from "./clips";

/**
 * Editor handoff: the clip finder's cut list, exported in the formats an
 * editor's tools actually open. Honest by design — this app does not render
 * video, so instead of a half-claimed mp4 it hands the editor a marker CSV
 * (Premiere/Resolve import), a CMX3600 EDL, and a caption pack with the
 * viewer quote each Short should open on. All pure string building, so every
 * format is unit-testable.
 */

export interface HandoffFile {
  name: string;
  mime: string;
  content: string;
}

/** Seconds → "HH:MM:SS:FF" timecode. Frames are zero — these are cut points
 * mined from comment timestamps, which are only ever second-accurate. */
export function toTimecode(seconds: number, fps = 30): string {
  const clamped = Math.max(0, seconds);
  const s = Math.floor(clamped);
  const frames = Math.round((clamped - s) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}:${pad(frames)}`;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Marker CSV in the column layout Premiere Pro and DaVinci Resolve both
 * accept for marker import.
 */
export function buildMarkerCsv(clips: ClipSuggestion[]): string {
  const header = "Marker Name,Description,In,Out,Duration,Marker Type";
  const rows = clips.map((c, i) => {
    const name = `Short ${i + 1}: ${TONE_LABEL[c.tone]}`;
    const description = `${c.mentions} comment${c.mentions === 1 ? "" : "s"} point here: "${c.quote}"`;
    return [
      csvField(name),
      csvField(description),
      toTimecode(c.startSeconds),
      toTimecode(c.endSeconds),
      toTimecode(c.endSeconds - c.startSeconds),
      "Comment",
    ].join(",");
  });
  return [header, ...rows].join("\n") + "\n";
}

/** Minimal CMX3600 EDL: one event per clip, source timecodes = cut range. */
export function buildEdl(clips: ClipSuggestion[], videoTitle: string): string {
  const lines = [`TITLE: ${videoTitle.slice(0, 60)}: Crowdtone cut list`, "FCM: NON-DROP FRAME", ""];
  clips.forEach((c, i) => {
    const n = String(i + 1).padStart(3, "0");
    const srcIn = toTimecode(c.startSeconds);
    const srcOut = toTimecode(c.endSeconds);
    // Record timecodes lay the clips back to back on the target timeline.
    const recStart = clips.slice(0, i).reduce((s, prev) => s + (prev.endSeconds - prev.startSeconds), 0);
    const recIn = toTimecode(recStart);
    const recOut = toTimecode(recStart + (c.endSeconds - c.startSeconds));
    lines.push(`${n}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    lines.push(`* FROM CLIP NAME: ${videoTitle.slice(0, 60)}`);
    lines.push(`* COMMENT: ${TONE_LABEL[c.tone]}: "${c.quote.slice(0, 120)}"`);
    lines.push("");
  });
  return lines.join("\n");
}

/** The words to put on and around each Short: hook quote, label, deep link. */
export function buildCaptionPack(clips: ClipSuggestion[], videoTitle: string): string {
  const blocks = clips.map((c, i) => {
    return [
      `SHORT ${i + 1} · ${c.range}`,
      `Why this moment: ${TONE_LABEL[c.tone].toLowerCase()}, ${c.mentions} comment${c.mentions === 1 ? "" : "s"} point at it.`,
      `Open the Short on this viewer quote: "${c.quote}"`,
      `Source moment: ${c.watchUrl}`,
    ].join("\n");
  });
  return [`Caption pack: "${videoTitle}"`, "", blocks.join("\n\n")].join("\n") + "\n";
}

export function buildHandoffFiles(videoTitle: string, videoId: string, clips: ClipSuggestion[]): HandoffFile[] {
  const slug = videoId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16) || "video";
  return [
    { name: `${slug}-shorts-markers.csv`, mime: "text/csv", content: buildMarkerCsv(clips) },
    { name: `${slug}-shorts-cuts.edl`, mime: "text/plain", content: buildEdl(clips, videoTitle) },
    { name: `${slug}-shorts-captions.txt`, mime: "text/plain", content: buildCaptionPack(clips, videoTitle) },
  ];
}

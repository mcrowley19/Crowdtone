import type { Comment } from "./types";

export interface TimestampMention {
  seconds: number;
  /** How many comments pointed at (roughly) this moment. */
  count: number;
  quotes: string[];
}

export interface Chapter {
  seconds: number;
  label: string;
}

/** YouTube only renders chapters when the first is 00:00 and there are 3+. */
export const MIN_CHAPTERS = 3;
/** YouTube requires every chapter to run at least 10 seconds. */
export const MIN_CHAPTER_GAP_S = 10;
/** Mentions closer together than this describe the same moment. */
const CLUSTER_WINDOW_S = 20;

const TIMESTAMP_RE = /(?:^|[^\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/g;

/** PT1H2M3S → 3723. Returns 0 for anything unparseable. */
export function parseISODuration(iso: string): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso?.trim() ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/** "4:32" → 272, "1:02:03" → 3723. Null when the parts are out of range. */
export function parseTimestamp(raw: string): number | null {
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return s < 60 ? m * 60 + s : null;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return m < 60 && s < 60 ? h * 3600 + m * 60 + s : null;
  }
  return null;
}

/**
 * Viewers timestamp the moments that mattered — the confusing bit, the good
 * bit, the bit they came for. That is a free, ground-truth outline of the
 * video, so chapters get mined from the comments rather than guessed.
 */
export function extractTimestampMentions(comments: Comment[], durationSeconds = 0): TimestampMention[] {
  const hits: { seconds: number; quote: string }[] = [];
  for (const c of comments) {
    const text = c.text.replace(/\s+/g, " ");
    TIMESTAMP_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP_RE.exec(text)) !== null) {
      const seconds = parseTimestamp(match[1]);
      if (seconds === null) continue;
      // A "12:30" in a comment on a 4-minute video is a clock, not a cue.
      if (durationSeconds > 0 && seconds > durationSeconds) continue;
      hits.push({ seconds, quote: text.slice(0, 200) });
    }
  }
  hits.sort((a, b) => a.seconds - b.seconds);

  const clusters: TimestampMention[] = [];
  for (const hit of hits) {
    const last = clusters[clusters.length - 1];
    if (last && hit.seconds - last.seconds <= CLUSTER_WINDOW_S) {
      last.count += 1;
      if (last.quotes.length < 3 && !last.quotes.includes(hit.quote)) last.quotes.push(hit.quote);
      continue;
    }
    clusters.push({ seconds: hit.seconds, count: 1, quotes: [hit.quote] });
  }
  return clusters.sort((a, b) => b.count - a.count || a.seconds - b.seconds);
}

/**
 * Turns labelled moments into a chapter list YouTube will actually accept:
 * sorted, starting at 0:00, never closer together than MIN_CHAPTER_GAP_S,
 * and never past the end of the video.
 */
export function buildChapters(
  moments: { seconds: number; label: string }[],
  durationSeconds = 0,
  introLabel = "Intro"
): Chapter[] {
  const sorted = [...moments]
    .filter((m) => Number.isFinite(m.seconds) && m.seconds >= 0 && m.label.trim().length > 0)
    .filter((m) => durationSeconds === 0 || m.seconds < durationSeconds - MIN_CHAPTER_GAP_S)
    .map((m) => ({ seconds: Math.floor(m.seconds), label: m.label.trim() }))
    .sort((a, b) => a.seconds - b.seconds);

  const out: Chapter[] = [{ seconds: 0, label: introLabel }];
  for (const m of sorted) {
    if (m.seconds - out[out.length - 1].seconds < MIN_CHAPTER_GAP_S) continue;
    out.push(m);
  }
  return out.length >= MIN_CHAPTERS ? out : [];
}

export function renderChapterBlock(chapters: Chapter[]): string {
  return chapters.map((c) => `${formatTimestamp(c.seconds)} ${c.label}`).join("\n");
}

const CHAPTER_HEADING = "Chapters";
// A run of lines that each begin with a timestamp: the block we previously wrote,
// or one the creator already had. Either way it gets replaced, not duplicated.
const EXISTING_BLOCK_RE = /(?:^|\n)(?:Chapters:?\n)?(?:(?:\d{1,2}:)?\d{1,2}:\d{2}[^\n]*\n?){3,}/;

export function mergeChaptersIntoDescription(description: string, chapters: Chapter[]): string {
  if (chapters.length === 0) return description;
  const block = `${CHAPTER_HEADING}\n${renderChapterBlock(chapters)}`;
  const base = description ?? "";
  if (EXISTING_BLOCK_RE.test(base)) {
    return base.replace(EXISTING_BLOCK_RE, `\n${block}\n`).replace(/\n{3,}/g, "\n\n").trim();
  }
  return base.trim() ? `${base.trim()}\n\n${block}` : block;
}

export function describeChapterSource(mentions: TimestampMention[]): string {
  const total = mentions.reduce((sum, m) => sum + m.count, 0);
  return `${total} timestamp${total === 1 ? "" : "s"} viewers left across ${mentions.length} moment${
    mentions.length === 1 ? "" : "s"
  }`;
}

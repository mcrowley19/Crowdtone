import { extractTimestampMentions, formatTimestamp } from "./chapters";
import type { Comment } from "./types";

/**
 * Clip finder: the moments viewers timestamped are the moments worth cutting
 * into Shorts — they're the parts people rewatched, quoted, and linked their
 * friends to. This ranks those moments and turns each into a ready-to-cut
 * clip spec: start a little before the cited second, run the length of a
 * Short, and lead with what viewers actually said about it.
 */

export interface ClipSuggestion {
  startSeconds: number;
  endSeconds: number;
  /** "8:09–8:59", ready for a caption or an editor's notes. */
  range: string;
  /** How many comments point inside this clip. */
  mentions: number;
  /** The strongest viewer quote about the moment — the Short's ready-made hook. */
  quote: string;
  tone: "highlight" | "helpful" | "moment";
  /** Deep link that starts the source video at the clip's first second. */
  watchUrl: string;
}

/** Start a touch early so the cited moment lands after a beat of context. */
const LEAD_IN_S = 5;
/** Shorts run up to 60s; 50 leaves room to trim by hand. */
const CLIP_LENGTH_S = 50;

const HIGHLIGHT_RE = /\b(love|loved|best|funniest|hilarious|amazing|incredible|killed me|lost it|favorite|favourite|epic|gold|rewatch|watch(ed)? (this|that) (part|bit) (again|twice))\b/i;
const HELPFUL_RE = /\b(helped|helpful|finally under(stood|stand)|makes sense|great explanation|explained|the tip|the trick|worked|fixed)\b/i;

export function classifyTone(quotes: string[]): ClipSuggestion["tone"] {
  const joined = quotes.join(" ");
  if (HIGHLIGHT_RE.test(joined)) return "highlight";
  if (HELPFUL_RE.test(joined)) return "helpful";
  return "moment";
}

export const TONE_LABEL: Record<ClipSuggestion["tone"], string> = {
  highlight: "Viewers loved this moment",
  helpful: "The part that actually helped people",
  moment: "A moment viewers keep pointing at",
};

export function suggestClips(
  comments: Comment[],
  videoId: string,
  durationSeconds: number,
  max = 3
): ClipSuggestion[] {
  // A Short cut from a video that's already Short-length is just the video.
  if (durationSeconds > 0 && durationSeconds <= 90) return [];
  const mentions = extractTimestampMentions(comments, durationSeconds);

  return mentions
    .filter((m) => m.count >= 1 && m.quotes.length > 0)
    .slice(0, max)
    .map((m) => {
      const start = Math.max(0, m.seconds - LEAD_IN_S);
      const end =
        durationSeconds > 0 ? Math.min(durationSeconds, start + CLIP_LENGTH_S) : start + CLIP_LENGTH_S;
      return {
        startSeconds: start,
        endSeconds: end,
        range: `${formatTimestamp(start)}–${formatTimestamp(end)}`,
        mentions: m.count,
        quote: m.quotes[0],
        tone: classifyTone(m.quotes),
        watchUrl: `https://www.youtube.com/watch?v=${videoId}&t=${start}s`,
      };
    })
    .sort((a, b) => b.mentions - a.mentions || a.startSeconds - b.startSeconds);
}

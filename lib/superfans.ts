import type { Comment } from "./types";

/**
 * Superfans, computed rather than guessed: the viewers who keep showing up,
 * get liked by other viewers, cite timestamps, and ask real questions. Pure
 * arithmetic over comments already in memory — no model, no API cost, fully
 * testable. Another role deliberately kept out of the LLM.
 */

export interface SuperfanInput {
  videoTitle: string;
  comments: Comment[];
}

export interface Superfan {
  author: string;
  authorChannelId?: string;
  commentCount: number;
  /** How many distinct videos (of the sets provided) they commented on. */
  videosTouched: number;
  totalLikes: number;
  questionCount: number;
  timestampCount: number;
  score: number;
  /** Human-readable reasons this person ranks — shown next to the name. */
  badges: string[];
  /** Their most-liked comment, as the receipt. */
  topQuote: string;
  lastSeen: string;
}

const QUESTION_RE = /\?|^(how|what|why|where|when|which|can|does|did|is|are)\b/i;
const TIMESTAMP_RE = /(?:^|[^\d:])(?:\d{1,2}:)?\d{1,2}:\d{2}(?![\d:])/;

/**
 * Ranks the audience behind a set of comment sections. Works on one video
 * (most-invested viewers of this thread) or across several (channel
 * superfans); pass `ownerChannelId` so the creator never ranks themselves.
 */
export function rankSuperfans(
  sets: SuperfanInput[],
  options: { ownerChannelId?: string; ownerName?: string; max?: number } = {}
): Superfan[] {
  const max = options.max ?? 6;
  const byAuthor = new Map<
    string,
    Superfan & { videos: Set<string>; top: { likes: number; text: string } }
  >();

  for (const set of sets) {
    for (const c of set.comments) {
      if (options.ownerChannelId && c.authorChannelId === options.ownerChannelId) continue;
      if (options.ownerName && c.author === options.ownerName) continue;
      const key = c.authorChannelId || c.author;
      if (!key) continue;
      let fan = byAuthor.get(key);
      if (!fan) {
        fan = {
          author: c.author,
          authorChannelId: c.authorChannelId,
          commentCount: 0,
          videosTouched: 0,
          totalLikes: 0,
          questionCount: 0,
          timestampCount: 0,
          score: 0,
          badges: [],
          topQuote: "",
          lastSeen: c.publishedAt,
          videos: new Set(),
          top: { likes: -1, text: "" },
        };
        byAuthor.set(key, fan);
      }
      fan.commentCount++;
      fan.videos.add(set.videoTitle);
      fan.totalLikes += c.likeCount;
      if (QUESTION_RE.test(c.text.trim())) fan.questionCount++;
      if (TIMESTAMP_RE.test(c.text)) fan.timestampCount++;
      if (c.likeCount > fan.top.likes) fan.top = { likes: c.likeCount, text: c.text };
      if (c.publishedAt > fan.lastSeen) fan.lastSeen = c.publishedAt;
    }
  }

  const fans = Array.from(byAuthor.values()).map((fan) => {
    fan.videosTouched = fan.videos.size;
    fan.topQuote = fan.top.text.slice(0, 200);
    fan.score =
      Math.round(
        (fan.videosTouched * 3 +
          fan.commentCount * 2 +
          Math.log10(fan.totalLikes + 1) * 2 +
          fan.questionCount +
          fan.timestampCount * 1.5) *
          10
      ) / 10;

    const badges: string[] = [];
    if (fan.videosTouched >= 2) badges.push(`on ${fan.videosTouched} of the videos read`);
    if (fan.commentCount >= 2 && fan.videosTouched < 2) badges.push(`${fan.commentCount} comments`);
    if (fan.totalLikes >= 50) badges.push(`${fan.totalLikes} likes from other viewers`);
    if (fan.timestampCount >= 1) badges.push("cites timestamps");
    if (fan.questionCount >= 2) badges.push("asks the good questions");
    fan.badges = badges;
    return fan;
  });

  return fans
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || b.totalLikes - a.totalLikes)
    .slice(0, max)
    .map(({ videos: _videos, top: _top, ...fan }) => fan);
}

/**
 * The churn radar: superfans whose last comment is old news. Deterministic —
 * "quiet" means no comment in the newest quarter of the observed date range.
 */
export function findQuietSuperfans(fans: Superfan[], newestSeen: string): Superfan[] {
  const newest = Date.parse(newestSeen);
  if (!Number.isFinite(newest)) return [];
  return fans.filter((f) => {
    const last = Date.parse(f.lastSeen);
    return Number.isFinite(last) && newest - last > 1000 * 60 * 60 * 24 * 14;
  });
}

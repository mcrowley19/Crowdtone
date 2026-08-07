import type { Comment } from "./types";

/**
 * Sentiment, without a model. Clustering needs an LLM because themes are
 * open-ended; polarity doesn't — a curated lexicon with negation handling
 * covers YouTube-comment English deterministically, runs in microseconds,
 * costs nothing, and every score is reproducible in a test. This is one of
 * the roles deliberately moved from the model into code.
 */

const POSITIVE = new Set([
  "amazing", "awesome", "beautiful", "best", "brilliant", "clean", "clear",
  "excellent", "fantastic", "favorite", "fire", "flawless", "fun", "gem",
  "genius", "goat", "gold", "great", "helped", "helpful", "impressive",
  "incredible", "informative", "insane", "inspiring", "legend", "love",
  "loved", "perfect", "quality", "refreshing", "solid", "subscribed",
  "thank", "thanks", "underrated", "useful", "valuable", "wonderful", "wow",
]);

const NEGATIVE = new Set([
  "annoying", "awful", "bad", "boring", "broken", "clickbait", "confused",
  "confusing", "disappointed", "disappointing", "dishonest", "dislike",
  "fake", "garbage", "hate", "hated", "lazy", "lie", "lied", "misleading",
  "mistake", "overpriced", "overrated", "pointless", "rushed", "scam",
  "shady", "slow", "sloppy", "terrible", "trash", "unclear", "unsubscribed",
  "unwatchable", "useless", "waste", "wasted", "worst", "wrong",
]);

const INTENSIFIERS = new Set(["absolutely", "really", "so", "super", "totally", "very"]);
const NEGATORS = new Set(["not", "never", "no", "isnt", "isn't", "wasnt", "wasn't", "dont", "don't", "didnt", "didn't", "cant", "can't"]);

const POSITIVE_EMOJI = /[❤🥰😍🔥👏🙌👍🎉🫶]/u;
const NEGATIVE_EMOJI = /[👎😡😠🙄🤦💩]/u;

/** One comment → a score in [-1, 1]. 0 means neutral or no signal found. */
export function scoreSentiment(text: string): number {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

  let sum = 0;
  let hits = 0;
  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    let polarity = POSITIVE.has(word) ? 1 : NEGATIVE.has(word) ? -1 : 0;
    if (polarity === 0) continue;
    // "not helpful" flips; "really misleading" hits harder.
    const w1 = tokens[i - 1];
    const w2 = tokens[i - 2];
    if ((w1 && NEGATORS.has(w1)) || (w2 && NEGATORS.has(w2))) polarity = -polarity;
    if (w1 && INTENSIFIERS.has(w1)) polarity *= 1.5;
    sum += polarity;
    hits++;
  }
  if (POSITIVE_EMOJI.test(text)) {
    sum += 1;
    hits++;
  }
  if (NEGATIVE_EMOJI.test(text)) {
    sum -= 1;
    hits++;
  }
  if (hits === 0) return 0;
  return Math.max(-1, Math.min(1, sum / Math.max(2, hits)));
}

export type SentimentLabel = "positive" | "neutral" | "negative";

export function labelSentiment(score: number): SentimentLabel {
  if (score > 0.12) return "positive";
  if (score < -0.12) return "negative";
  return "neutral";
}

export interface SentimentBucket {
  /** Short label for the x axis: a date ("Jul 12") or a range index. */
  label: string;
  /** Mean score of the bucket's comments, [-1, 1]. */
  score: number;
  count: number;
  positive: number;
  negative: number;
  /** The most polarizing comment in the bucket — the chart's tooltip receipt. */
  quote?: string;
}

export interface SentimentTimeline {
  buckets: SentimentBucket[];
  overall: { score: number; positive: number; neutral: number; negative: number };
  /** True when comment dates were usable; false means buckets are by position. */
  datedBuckets: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Comments over time → a small time series the sentiment chart can draw.
 * Buckets are equal slices of the comment date range; when dates are missing
 * or collapse into one instant, buckets fall back to comment order so the
 * chart still shows the arc of the thread.
 */
export function sentimentTimeline(comments: Comment[], bucketCount = 10): SentimentTimeline {
  const scored = comments.map((c) => ({
    ms: Date.parse(c.publishedAt),
    score: scoreSentiment(c.text),
    text: c.text,
  }));

  const overallCounts = { positive: 0, neutral: 0, negative: 0 };
  for (const s of scored) overallCounts[labelSentiment(s.score)]++;
  const overallScore =
    scored.length === 0 ? 0 : scored.reduce((sum, s) => sum + s.score, 0) / scored.length;

  const dated = scored.filter((s) => Number.isFinite(s.ms));
  const useDates =
    dated.length === scored.length &&
    scored.length > 0 &&
    Math.max(...dated.map((s) => s.ms)) - Math.min(...dated.map((s) => s.ms)) > 60_000;

  const n = Math.max(1, Math.min(bucketCount, Math.ceil(scored.length / 2)));
  const buckets: SentimentBucket[] = [];

  if (scored.length > 0) {
    const ordered = useDates ? [...scored].sort((a, b) => a.ms - b.ms) : scored;
    const min = useDates ? ordered[0].ms : 0;
    const max = useDates ? ordered[ordered.length - 1].ms : ordered.length - 1;
    const span = Math.max(1, max - min);

    const groups: (typeof scored)[] = Array.from({ length: n }, () => []);
    ordered.forEach((s, i) => {
      const position = useDates ? (s.ms - min) / span : i / Math.max(1, ordered.length - 1);
      groups[Math.min(n - 1, Math.floor(position * n))].push(s);
    });

    groups.forEach((group, i) => {
      if (group.length === 0) return;
      const score = group.reduce((sum, s) => sum + s.score, 0) / group.length;
      const extreme = group.reduce((a, b) => (Math.abs(b.score) > Math.abs(a.score) ? b : a));
      buckets.push({
        label: useDates ? dayLabel(group[0].ms) : `${i + 1}`,
        score: Math.round(score * 100) / 100,
        count: group.length,
        positive: group.filter((s) => labelSentiment(s.score) === "positive").length,
        negative: group.filter((s) => labelSentiment(s.score) === "negative").length,
        quote: Math.abs(extreme.score) > 0.12 ? extreme.text.slice(0, 160) : undefined,
      });
    });
  }

  return {
    buckets,
    overall: {
      score: Math.round(overallScore * 100) / 100,
      ...overallCounts,
    },
    datedBuckets: useDates,
  };
}

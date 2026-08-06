import type { ChannelInfo, ChannelStats, VideoPerformance } from "./channel";
import { chatJSON, getLLMConfig } from "./llm";
import { SYSTEM_PROMPT, nextVideoPlanPrompt } from "./prompts";
import type { Comment, VideoMeta } from "./types";

export interface DemandQuote {
  quote: string;
  videoTitle: string;
  likeCount: number;
}

export interface PlanEvidence {
  demandQuotes: DemandQuote[];
  performanceNotes: string[];
  commentsAnalyzed: number;
  videosAnalyzed: number;
}

export interface PlanBeat {
  beat: string;
  detail: string;
}

export interface NextVideoPlan {
  title: string;
  alternativeTitles: string[];
  angle: string;
  hook: string;
  outline: PlanBeat[];
  description: string;
  tags: string[];
  thumbnailText: string;
  targetLengthMinutes: number;
  publishBy: string;
  avoid: string[];
  evidence: PlanEvidence;
  confidence: "high" | "medium" | "low";
  source: "llm" | "heuristic";
  model?: string;
}

export interface VideoComments {
  video: VideoMeta;
  comments: Comment[];
}

/**
 * Which of the channel's videos to actually read the comments of. Recency
 * shows what the audience wants now; the outliers show what the channel is
 * good at. Both matter to the next video, and each one costs YouTube quota.
 */
export function selectVideosForPlan(stats: ChannelStats, max = 5): VideoPerformance[] {
  const withComments = stats.videos.filter((p) => p.video.commentCount > 0);
  const recent = withComments.slice(0, 3);
  const chosen = [...recent];
  // A video with no comments costs a quota unit and returns nothing to read,
  // so it never earns a slot — not even as one of the channel's outliers.
  for (const p of stats.top) {
    if (chosen.length >= max) break;
    if (p.video.commentCount <= 0) continue;
    if (!chosen.some((c) => c.video.videoId === p.video.videoId)) chosen.push(p);
  }
  for (const p of withComments) {
    if (chosen.length >= max) break;
    if (!chosen.some((c) => c.video.videoId === p.video.videoId)) chosen.push(p);
  }
  return chosen.slice(0, max);
}

const REQUEST_RE = /\b(please|can you|could you|would love|i'd love|do a|make a|part 2|part two|next video|follow ?up|tutorial on|more of|when will|will you|how do (you|i)|what about)\b/i;

/** The comments that read like a request or a question — the demand signal. */
export function extractDemandQuotes(sets: VideoComments[], max = 12): DemandQuote[] {
  const quotes: DemandQuote[] = [];
  for (const set of sets) {
    for (const c of set.comments) {
      const text = c.text.replace(/\s+/g, " ").trim();
      if (text.length < 15 || text.length > 400) continue;
      if (!REQUEST_RE.test(text) && !text.includes("?")) continue;
      quotes.push({ quote: text, videoTitle: set.video.title, likeCount: c.likeCount });
    }
  }
  return quotes.sort((a, b) => b.likeCount - a.likeCount).slice(0, max);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function minutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Facts about the channel, computed rather than generated — the model gets
 * these as input and the UI shows them as evidence, so neither can invent a
 * number the statistics don't support.
 */
export function derivePerformanceNotes(
  channel: ChannelInfo,
  stats: ChannelStats,
  now = Date.now()
): string[] {
  const notes: string[] = [];
  if (stats.videos.length === 0) return ["No uploads found on this channel."];

  notes.push(
    `Across the last ${stats.videos.length} uploads, the typical video pulls ${fmt(
      stats.medianViewsPerDay
    )} views/day (median ${fmt(stats.medianViews)} views total).`
  );

  const best = stats.top[0];
  if (best && best.outlierScore >= 1.2) {
    notes.push(
      `“${best.video.title}” is the standout at ${best.outlierScore}× the channel's normal views/day.`
    );
  }
  const worst = stats.bottom[0];
  if (worst && worst.outlierScore > 0 && worst.outlierScore <= 0.7 && worst.video.videoId !== best?.video.videoId) {
    notes.push(`“${worst.video.title}” underperformed at ${worst.outlierScore}× normal.`);
  }

  if (stats.cadenceDays > 0) {
    const last = Date.parse(stats.videos[0]?.video.publishedAt ?? "");
    const sinceLast = Number.isFinite(last) ? Math.round((now - last) / 86400_000) : null;
    notes.push(
      `You publish about every ${stats.cadenceDays} days` +
        (sinceLast !== null ? `; the last upload was ${sinceLast} day${sinceLast === 1 ? "" : "s"} ago.` : ".")
    );
  }

  if (stats.medianDurationSeconds > 0) {
    notes.push(`Your usual runtime is about ${minutes(stats.medianDurationSeconds)} minutes.`);
  }

  const engaged = [...stats.videos].sort((a, b) => b.engagementRate - a.engagementRate)[0];
  if (engaged && engaged.engagementRate > 0) {
    notes.push(
      `Most engaged: “${engaged.video.title}” at ${(engaged.engagementRate * 100).toFixed(1)}% likes+comments per view.`
    );
  }

  if (channel.subscriberCount > 0) {
    notes.push(`${fmt(channel.subscriberCount)} subscribers, ${fmt(channel.videoCount)} videos published.`);
  }
  return notes;
}

/** Next slot in the channel's own rhythm, never a date already gone. */
export function suggestPublishDate(stats: ChannelStats, now = Date.now()): string {
  const cadence = stats.cadenceDays > 0 ? stats.cadenceDays : 7;
  const last = Date.parse(stats.videos[0]?.video.publishedAt ?? "");
  const next = Number.isFinite(last) ? last + cadence * 86400_000 : now + cadence * 86400_000;
  // Already overdue? Then the answer is "as soon as you can", i.e. three days out.
  const target = Math.max(next, now + 3 * 86400_000);
  return new Date(target).toISOString().slice(0, 10);
}

/* ------------------------------ validation ------------------------------ */

function str(v: unknown, max = 400): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function strArray(v: unknown, max: number, itemMax = 120): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => str(x, itemMax))
    .filter((x) => x.length > 0)
    .slice(0, max);
}

export function validatePlan(raw: any): Omit<NextVideoPlan, "evidence" | "publishBy" | "source"> | null {
  const title = str(raw?.title, 100);
  if (!title) return null;
  const outline: PlanBeat[] = (Array.isArray(raw?.outline) ? raw.outline : [])
    .map((b: any) => ({ beat: str(b?.beat, 80), detail: str(b?.detail, 300) }))
    .filter((b: PlanBeat) => b.beat.length > 0)
    .slice(0, 8);
  const length = Number(raw?.target_length_minutes);
  const confidence = str(raw?.confidence).toLowerCase();
  return {
    title,
    alternativeTitles: strArray(raw?.alternative_titles, 3, 100),
    angle: str(raw?.angle, 300),
    hook: str(raw?.hook, 600),
    outline,
    description: str(raw?.description, 4000),
    tags: strArray(raw?.tags, 12, 40),
    thumbnailText: str(raw?.thumbnail_text, 60).split(/\s+/).slice(0, 6).join(" "),
    targetLengthMinutes: Number.isFinite(length) && length > 0 ? Math.round(length) : 0,
    avoid: strArray(raw?.avoid, 4, 200),
    confidence: confidence === "high" ? "high" : confidence === "low" ? "low" : "medium",
  };
}

/* ------------------------------ the pipeline ---------------------------- */

function heuristicPlan(
  channel: ChannelInfo,
  stats: ChannelStats,
  demand: DemandQuote[],
  evidence: PlanEvidence
): NextVideoPlan {
  const topRequest = demand[0]?.quote ?? "";
  const bestTitle = stats.top[0]?.video.title ?? channel.title;
  const title = topRequest
    ? `The video you keep asking for: ${topRequest.replace(/[?!.]+$/, "").slice(0, 60)}`
    : `More like “${bestTitle}”`;
  return {
    title: title.slice(0, 100),
    alternativeTitles: demand.slice(1, 3).map((d) => d.quote.slice(0, 80)),
    angle: topRequest
      ? "Answer the single most-repeated request in your comments, start to finish."
      : "Do more of what already outperformed on this channel.",
    hook: topRequest ? `You asked for this one — ${topRequest.slice(0, 140)}` : "",
    outline: [
      { beat: "Cold open", detail: "State the question viewers keep asking, word for word." },
      { beat: "Payoff", detail: "Answer it in the first minute, then show the working." },
      { beat: "Close", detail: "Point at the follow-up the comments are already asking for." },
    ],
    description: "",
    tags: [],
    thumbnailText: "",
    targetLengthMinutes: stats.medianDurationSeconds > 0 ? minutes(stats.medianDurationSeconds) : 0,
    publishBy: suggestPublishDate(stats),
    avoid: [],
    evidence,
    confidence: demand.length >= 5 ? "medium" : "low",
    source: "heuristic",
  };
}

export async function buildNextVideoPlan(
  channel: ChannelInfo,
  stats: ChannelStats,
  sets: VideoComments[]
): Promise<NextVideoPlan> {
  const demand = extractDemandQuotes(sets);
  const evidence: PlanEvidence = {
    demandQuotes: demand.slice(0, 8),
    performanceNotes: derivePerformanceNotes(channel, stats),
    commentsAnalyzed: sets.reduce((n, s) => n + s.comments.length, 0),
    videosAnalyzed: sets.length,
  };

  const config = getLLMConfig();
  if (config && demand.length > 0) {
    try {
      const raw = await chatJSON(
        config,
        SYSTEM_PROMPT,
        nextVideoPlanPrompt(channel, stats, evidence.performanceNotes, demand)
      );
      const validated = validatePlan(raw);
      if (validated) {
        return {
          ...validated,
          targetLengthMinutes:
            validated.targetLengthMinutes ||
            (stats.medianDurationSeconds > 0 ? minutes(stats.medianDurationSeconds) : 0),
          publishBy: suggestPublishDate(stats),
          evidence,
          confidence: demand.length >= 8 ? validated.confidence : "medium",
          source: "llm",
          model: config.model,
        };
      }
    } catch (err) {
      console.error("Next-video plan failed, using heuristic plan:", err);
    }
  }
  return heuristicPlan(channel, stats, demand, evidence);
}

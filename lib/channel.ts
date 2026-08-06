import { mapCommentThreads, mapVideoItem, YouTubeApiError } from "./youtube";
import { ytAuthedGet } from "./ytclient";
import type { Comment, VideoMeta } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/** Either a public API key or a connected creator's OAuth token gets us here. */
export type ChannelAuth = { kind: "key"; key: string } | { kind: "token"; token: string };

async function list(auth: ChannelAuth, path: string, params: Record<string, string>): Promise<any> {
  if (auth.kind === "token") return ytAuthedGet(auth.token, path, params);
  const qs = new URLSearchParams({ ...params, key: auth.key }).toString();
  const res = await fetch(`${API_BASE}/${path}?${qs}`, { signal: AbortSignal.timeout(15000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    const message = body?.error?.message ?? `YouTube API error (HTTP ${res.status})`;
    throw new YouTubeApiError(message, reason.includes("uota") ? "quota" : "http", res.status);
  }
  return body;
}

export interface ChannelInfo {
  channelId: string;
  title: string;
  handle: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export type ChannelRef =
  | { type: "id"; value: string }
  | { type: "handle"; value: string }
  | { type: "username"; value: string };

/** Accepts a channel URL, an @handle, or a bare UC… channel id. */
export function parseChannelInput(input: string): ChannelRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return { type: "id", value: trimmed };
  if (trimmed.startsWith("@")) return { type: "handle", value: trimmed.slice(1) };

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/.test(url.hostname.replace(/^www\.|^m\./, ""))) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0].startsWith("@")) return { type: "handle", value: parts[0].slice(1) };
  if (parts[0] === "channel" && parts[1]) return { type: "id", value: parts[1] };
  if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { type: "username", value: parts[1] };
  return null;
}

function mapChannel(item: any): ChannelInfo {
  return {
    channelId: item?.id ?? "",
    title: item?.snippet?.title ?? "",
    handle: item?.snippet?.customUrl ?? "",
    thumbnailUrl: item?.snippet?.thumbnails?.high?.url ?? item?.snippet?.thumbnails?.default?.url ?? "",
    subscriberCount: Number(item?.statistics?.subscriberCount ?? 0),
    videoCount: Number(item?.statistics?.videoCount ?? 0),
    uploadsPlaylistId: item?.contentDetails?.relatedPlaylists?.uploads ?? "",
  };
}

const CHANNEL_PARTS = "snippet,statistics,contentDetails";

export async function fetchChannel(auth: ChannelAuth, ref: ChannelRef | "mine"): Promise<ChannelInfo> {
  const params: Record<string, string> = { part: CHANNEL_PARTS };
  if (ref === "mine") params.mine = "true";
  else if (ref.type === "id") params.id = ref.value;
  else if (ref.type === "handle") params.forHandle = `@${ref.value}`;
  else params.forUsername = ref.value;

  const body = await list(auth, "channels", params);
  const item = body?.items?.[0];
  if (!item) throw new YouTubeApiError("Channel not found", "not_found", 404);
  return mapChannel(item);
}

/**
 * Uploads come back newest-first from the uploads playlist; we then hydrate
 * them through videos.list because playlistItems carries no statistics.
 */
export async function fetchRecentUploads(
  auth: ChannelAuth,
  uploadsPlaylistId: string,
  max = 20
): Promise<VideoMeta[]> {
  if (!uploadsPlaylistId) return [];
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, max - ids.length)),
    };
    if (pageToken) params.pageToken = pageToken;
    const body = await list(auth, "playlistItems", params);
    for (const item of body?.items ?? []) {
      const id = item?.contentDetails?.videoId;
      if (typeof id === "string" && id) ids.push(id);
    }
    pageToken = body?.nextPageToken;
    if (!pageToken) break;
  }

  const videos: VideoMeta[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await list(auth, "videos", {
      part: "snippet,statistics,contentDetails",
      id: ids.slice(i, i + 50).join(","),
    });
    for (const item of body?.items ?? []) videos.push(mapVideoItem(item));
  }
  return videos.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

/**
 * commentThreads.list under either credential. The public path already exists
 * in lib/youtube.ts; this one also works for a connected creator's token.
 */
export async function fetchCommentsWith(
  auth: ChannelAuth,
  videoId: string,
  max = 100
): Promise<Comment[]> {
  const out: Comment[] = [];
  let pageToken: string | undefined;
  while (out.length < max) {
    const params: Record<string, string> = {
      part: "snippet",
      videoId,
      maxResults: String(Math.min(100, max - out.length)),
      order: "relevance",
      textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;
    const body = await list(auth, "commentThreads", params);
    out.push(...mapCommentThreads(body));
    pageToken = body?.nextPageToken;
    if (!pageToken) break;
  }
  return out.slice(0, max);
}

/* ------------------------------- metrics -------------------------------- */

export interface VideoPerformance {
  video: VideoMeta;
  ageDays: number;
  viewsPerDay: number;
  engagementRate: number;
  /** Views/day relative to this channel's median. 1 = typical, 2 = twice normal. */
  outlierScore: number;
  isShort: boolean;
}

export interface ChannelStats {
  videos: VideoPerformance[];
  medianViewsPerDay: number;
  medianViews: number;
  /** Median days between consecutive uploads. 0 when there aren't enough. */
  cadenceDays: number;
  medianDurationSeconds: number;
  top: VideoPerformance[];
  bottom: VideoPerformance[];
}

export function median(values: number[]): number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const SHORTS_MAX_SECONDS = 61;

export function computeChannelStats(videos: VideoMeta[], now = Date.now()): ChannelStats {
  const perf: VideoPerformance[] = videos.map((video) => {
    const published = Date.parse(video.publishedAt || "");
    // A video published today would otherwise divide by zero and look infinite.
    const ageDays = Number.isFinite(published) ? Math.max(1, (now - published) / 86400_000) : 1;
    const views = video.viewCount || 0;
    const engaged = (video.likeCount ?? 0) + (video.commentCount || 0);
    return {
      video,
      ageDays: Math.round(ageDays * 10) / 10,
      viewsPerDay: Math.round(views / ageDays),
      engagementRate: views > 0 ? engaged / views : 0,
      outlierScore: 0,
      isShort: (video.durationSeconds ?? 0) > 0 && (video.durationSeconds ?? 0) <= SHORTS_MAX_SECONDS,
    };
  });

  // Shorts pull in views on a completely different curve, so the channel's
  // "normal" is measured on long-form only — unless that's all there is.
  const longform = perf.filter((p) => !p.isShort);
  const baseline = longform.length >= 3 ? longform : perf;
  const medianViewsPerDay = median(baseline.map((p) => p.viewsPerDay));
  for (const p of perf) {
    p.outlierScore = medianViewsPerDay > 0 ? Math.round((p.viewsPerDay / medianViewsPerDay) * 100) / 100 : 0;
  }

  const dates = videos
    .map((v) => Date.parse(v.publishedAt || ""))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let i = 0; i + 1 < dates.length; i++) gaps.push((dates[i] - dates[i + 1]) / 86400_000);

  const ranked = [...baseline].sort((a, b) => b.outlierScore - a.outlierScore);
  return {
    videos: perf,
    medianViewsPerDay,
    medianViews: median(baseline.map((p) => p.video.viewCount)),
    cadenceDays: Math.round(median(gaps) * 10) / 10,
    medianDurationSeconds: Math.round(median(baseline.map((p) => p.video.durationSeconds ?? 0))),
    top: ranked.slice(0, 3),
    bottom: ranked.slice(-3).reverse(),
  };
}

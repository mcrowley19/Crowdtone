import { parseISODuration } from "./chapters";
import type { Comment, VideoMeta } from "./types";

const API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * commentThreads.list costs 1 quota unit per call and returns up to 100
 * comments, so 1,000 comments is 10 units of the free 10,000-unit daily
 * allowance: about 1,000 videos a day on one key. The ceiling here is chosen
 * for fetch latency and payload size rather than cost, and the pager below
 * will follow nextPageToken to whatever it is set to.
 */
export const MAX_COMMENTS = Math.max(1, Number(process.env.MAX_COMMENTS) || 1000);

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts a raw 11-char video ID or any common YouTube URL shape
 * (watch, youtu.be, shorts, embed, live) and returns the video ID.
 */
export function parseVideoInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return ID_RE.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
      return ID_RE.test(parts[1]) ? parts[1] : null;
    }
  }
  return null;
}

export type YouTubeErrorCode = "quota" | "not_found" | "comments_disabled" | "invalid_key" | "http";

export class YouTubeApiError extends Error {
  code: YouTubeErrorCode;
  status: number;
  constructor(message: string, code: YouTubeErrorCode, status = 500) {
    super(message);
    this.name = "YouTubeApiError";
    this.code = code;
    this.status = status;
  }
}

function toApiError(status: number, body: any): YouTubeApiError {
  const reason = body?.error?.errors?.[0]?.reason ?? "";
  const message = body?.error?.message ?? `YouTube API error (HTTP ${status})`;
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || reason === "dailyLimitExceeded") {
    return new YouTubeApiError(message, "quota", status);
  }
  if (reason === "commentsDisabled") {
    return new YouTubeApiError(message, "comments_disabled", status);
  }
  if (status === 400 || status === 403) {
    return new YouTubeApiError(message, "invalid_key", status);
  }
  return new YouTubeApiError(message, "http", status);
}

async function ytGet(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/${path}?${qs}`, {
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw toApiError(res.status, body);
  return body;
}

export function pickThumbnail(thumbnails: any): string {
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    if (thumbnails?.[key]?.url) return thumbnails[key].url;
  }
  return "";
}

/** Maps one videos.list item into VideoMeta. Shared by lookup and channel listing. */
export function mapVideoItem(item: any): VideoMeta {
  return {
    videoId: item?.id ?? "",
    title: item?.snippet?.title ?? "(untitled)",
    channelTitle: item?.snippet?.channelTitle ?? "",
    channelId: item?.snippet?.channelId ?? "",
    description: item?.snippet?.description ?? "",
    durationSeconds: parseISODuration(item?.contentDetails?.duration ?? ""),
    categoryId: item?.snippet?.categoryId ?? "",
    tags: Array.isArray(item?.snippet?.tags) ? item.snippet.tags : undefined,
    thumbnailUrl: pickThumbnail(item?.snippet?.thumbnails),
    viewCount: Number(item?.statistics?.viewCount ?? 0),
    likeCount: Number(item?.statistics?.likeCount ?? 0),
    commentCount: Number(item?.statistics?.commentCount ?? 0),
    publishedAt: item?.snippet?.publishedAt ?? "",
    source: "api",
  };
}

export async function fetchVideoMeta(apiKey: string, videoId: string): Promise<VideoMeta> {
  const body = await ytGet("videos", {
    // contentDetails carries the runtime, which is what keeps mined chapter
    // timestamps inside the video instead of past the end of it.
    part: "snippet,statistics,contentDetails",
    id: videoId,
    key: apiKey,
  });
  const item = body?.items?.[0];
  if (!item) throw new YouTubeApiError("Video not found", "not_found", 404);
  return { ...mapVideoItem(item), videoId };
}

/** Maps a commentThreads.list response page into our Comment shape. */
export function mapCommentThreads(body: any): Comment[] {
  const items = Array.isArray(body?.items) ? body.items : [];
  const out: Comment[] = [];
  for (const item of items) {
    const s = item?.snippet?.topLevelComment?.snippet;
    if (!s || typeof s.textOriginal !== "string") continue;
    const text = s.textOriginal.trim();
    if (!text) continue;
    out.push({
      id: item.snippet.topLevelComment.id ?? item.id ?? "",
      author: s.authorDisplayName ?? "viewer",
      authorChannelId: s.authorChannelId?.value ?? undefined,
      text,
      likeCount: Number(s.likeCount ?? 0),
      publishedAt: s.publishedAt ?? "",
    });
  }
  return out;
}

export async function fetchComments(
  apiKey: string,
  videoId: string,
  max = MAX_COMMENTS
): Promise<Comment[]> {
  const comments: Comment[] = [];
  let pageToken: string | undefined;
  while (comments.length < max) {
    const params: Record<string, string> = {
      part: "snippet",
      videoId,
      key: apiKey,
      maxResults: String(Math.min(100, max - comments.length)),
      order: "relevance",
      textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;
    const body = await ytGet("commentThreads", params);
    comments.push(...mapCommentThreads(body));
    pageToken = body?.nextPageToken;
    if (!pageToken) break;
  }
  return comments.slice(0, max);
}

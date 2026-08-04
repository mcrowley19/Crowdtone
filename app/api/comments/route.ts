import { NextRequest, NextResponse } from "next/server";
import { fetchComments, YouTubeApiError } from "@/lib/youtube";
import { readCachedComments, writeCachedComments } from "@/lib/cache";
import { getDemoComments, isDemoId } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoId: string = typeof body.videoId === "string" ? body.videoId : "";
  const refresh: boolean = Boolean(body.refresh);

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required", code: "invalid_input" }, { status: 400 });
  }
  if (isDemoId(videoId)) {
    const comments = getDemoComments();
    return NextResponse.json({ comments, count: comments.length, source: "demo" });
  }

  // Serve from cache first — saves YouTube quota between runs of the same video.
  if (!refresh) {
    const cached = await readCachedComments(videoId);
    if (cached) {
      return NextResponse.json({
        comments: cached.comments,
        count: cached.comments.length,
        source: "cache",
        fetchedAt: cached.fetchedAt,
      });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No YOUTUBE_API_KEY configured. Add one to .env.local, or try the demo.", code: "no_api_key" },
      { status: 400 }
    );
  }

  try {
    const comments = await fetchComments(apiKey, videoId);
    await writeCachedComments(videoId, comments).catch(() => undefined);
    return NextResponse.json({ comments, count: comments.length, source: "api" });
  } catch (err) {
    // Quota exhausted mid-demo: fall back to any cache, even when refresh was requested.
    const cached = await readCachedComments(videoId);
    if (cached) {
      return NextResponse.json({
        comments: cached.comments,
        count: cached.comments.length,
        source: "cache",
        fetchedAt: cached.fetchedAt,
      });
    }
    if (err instanceof YouTubeApiError) {
      const hint =
        err.code === "quota"
          ? " YouTube quota exhausted — try again after midnight PT, or use the demo."
          : err.code === "comments_disabled"
            ? " This video has comments disabled — try another video."
            : "";
      return NextResponse.json({ error: err.message + hint, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to fetch comments.", code: "network" }, { status: 502 });
  }
}

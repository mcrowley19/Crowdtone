import { NextRequest, NextResponse } from "next/server";
import {
  computeChannelStats,
  fetchChannel,
  fetchCommentsWith,
  fetchRecentUploads,
  parseChannelInput,
} from "@/lib/channel";
import { resolveChannelAuth, setSessionCookie } from "@/lib/authserver";
import { buildNextVideoPlan, selectVideosForPlan, type VideoComments } from "@/lib/plan";
import { readCachedComments, writeCachedComments } from "@/lib/cache";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to five comment fetches then one long LLM call; Vercel allows 300s.
export const maxDuration = 300;

const COMMENTS_PER_VIDEO = 100;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  const { auth, session, refreshed, reason } = await resolveChannelAuth(req, input);

  if (!auth) {
    return NextResponse.json(
      {
        error:
          reason === "no_api_key"
            ? "No YouTube API key configured — connect your channel instead."
            : "Connect your channel, or paste a channel URL.",
        code: "no_api_key",
      },
      { status: 400 }
    );
  }

  const ref = input ? parseChannelInput(input) : "mine";
  if (!ref) {
    return NextResponse.json(
      { error: "That doesn't look like a channel URL, @handle, or channel ID.", code: "invalid_input" },
      { status: 400 }
    );
  }
  if (ref === "mine" && auth.kind === "key") {
    return NextResponse.json(
      { error: "Connect your channel to plan for it, or paste a channel URL.", code: "not_connected" },
      { status: 401 }
    );
  }

  try {
    const channel = await fetchChannel(auth, ref);
    const videos = await fetchRecentUploads(auth, channel.uploadsPlaylistId, 20);
    if (videos.length === 0) {
      return NextResponse.json(
        { error: "That channel has no public uploads to learn from.", code: "not_found" },
        { status: 404 }
      );
    }
    const stats = computeChannelStats(videos);

    const sets: VideoComments[] = [];
    for (const p of selectVideosForPlan(stats)) {
      const cached = await readCachedComments(p.video.videoId);
      if (cached) {
        sets.push({ video: p.video, comments: cached.comments });
        continue;
      }
      try {
        const comments = await fetchCommentsWith(auth, p.video.videoId, COMMENTS_PER_VIDEO);
        await writeCachedComments(p.video.videoId, comments).catch(() => undefined);
        sets.push({ video: p.video, comments });
      } catch (err) {
        // One video with comments disabled shouldn't sink the whole plan.
        console.error(`Comments unavailable for ${p.video.videoId}:`, err);
      }
    }

    const plan = await buildNextVideoPlan(channel, stats, sets);
    const res = NextResponse.json({
      channel,
      stats,
      plan,
      videosRead: sets.map((s) => ({ videoId: s.video.videoId, title: s.video.title, comments: s.comments.length })),
      owned: Boolean(session && session.channelId === channel.channelId),
    });
    return refreshed && session ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Plan failed:", err);
    return NextResponse.json({ error: "Failed to build the plan.", code: "network" }, { status: 502 });
  }
}

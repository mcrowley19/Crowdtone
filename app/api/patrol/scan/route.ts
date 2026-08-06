import { NextRequest, NextResponse } from "next/server";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { fetchChannel, fetchCommentsWith, fetchRecentUploads } from "@/lib/channel";
import { getDemoPatrolData } from "@/lib/demo";
import { runPatrol, type VideoCommentSet } from "@/lib/moderation";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 120;

/** How much of the channel one patrol reads. 8 videos × 100 comments ≈ 9 quota units. */
const PATROL_VIDEOS = 8;
const PATROL_COMMENTS_PER_VIDEO = 100;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // The demo patrol runs the identical pipeline over the bundled dataset, so
  // the feature is visible without OAuth. Only the fetch layer is skipped.
  if (body?.demo === true) {
    const demo = getDemoPatrolData();
    const report = await runPatrol(demo.videos, demo.channel.title, demo.channel.channelId);
    return NextResponse.json({
      channelTitle: demo.channel.title,
      demo: true,
      report,
    });
  }

  try {
    const { session, changed } = await requireSession(req);
    const auth = { kind: "token" as const, token: session.accessToken };

    const channel = await fetchChannel(auth, "mine");
    const uploads = await fetchRecentUploads(auth, channel.uploadsPlaylistId, PATROL_VIDEOS);

    const sets: VideoCommentSet[] = [];
    for (const video of uploads) {
      if (video.commentCount <= 0) continue;
      try {
        const comments = await fetchCommentsWith(auth, video.videoId, PATROL_COMMENTS_PER_VIDEO);
        sets.push({ videoId: video.videoId, videoTitle: video.title, comments });
      } catch (err) {
        // Comments disabled on one video shouldn't sink the whole patrol.
        if (!(err instanceof YouTubeApiError && err.code === "comments_disabled")) throw err;
      }
    }

    const report = await runPatrol(sets, channel.title, channel.channelId);
    const res = NextResponse.json({ channelTitle: channel.title, demo: false, report });
    return changed ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 401 });
    }
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Patrol scan failed:", err);
    return NextResponse.json({ error: "Patrol scan failed." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { computeChannelStats, fetchChannel, fetchRecentUploads, parseChannelInput } from "@/lib/channel";
import { resolveChannelAuth, setSessionCookie } from "@/lib/authserver";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const input = (req.nextUrl.searchParams.get("input") ?? "").trim();
  const { auth, session, refreshed, reason } = await resolveChannelAuth(req, input);

  if (!auth) {
    return NextResponse.json(
      {
        error:
          reason === "no_api_key"
            ? "No YouTube API key configured. Connect your channel instead."
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
      { error: "Connect your channel to analyze it, or paste a channel URL.", code: "not_connected" },
      { status: 401 }
    );
  }

  try {
    const channel = await fetchChannel(auth, ref);
    const videos = await fetchRecentUploads(auth, channel.uploadsPlaylistId, 20);
    const stats = computeChannelStats(videos);
    const res = NextResponse.json({
      channel,
      stats,
      owned: Boolean(session && session.channelId === channel.channelId),
    });
    return refreshed && session ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ error: "Failed to reach the YouTube API.", code: "network" }, { status: 502 });
  }
}

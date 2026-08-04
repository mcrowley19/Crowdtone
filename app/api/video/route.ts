import { NextRequest, NextResponse } from "next/server";
import { fetchVideoMeta, parseVideoInput, YouTubeApiError } from "@/lib/youtube";
import { getDemoVideo, isDemoId } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input") ?? "";
  if (isDemoId(input.trim())) {
    return NextResponse.json({ video: getDemoVideo() });
  }
  const videoId = parseVideoInput(input);
  if (!videoId) {
    return NextResponse.json(
      { error: "That doesn't look like a YouTube URL or video ID.", code: "invalid_input" },
      { status: 400 }
    );
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "No YouTube API key configured on this deployment — try the demo instead.",
        code: "no_api_key",
      },
      { status: 400 }
    );
  }
  try {
    const video = await fetchVideoMeta(apiKey, videoId);
    return NextResponse.json({ video });
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Failed to reach the YouTube API.", code: "network" },
      { status: 502 }
    );
  }
}

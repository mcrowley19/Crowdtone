import { NextRequest, NextResponse } from "next/server";
import { planActions } from "@/lib/actions";
import { buildStyleProfile, describeStyleProfile } from "@/lib/replystyle";
import { isDemoId } from "@/lib/demo";
import creatorReplies from "@/examples/demo_creator_replies.json";
import type { Analysis, Comment, VideoMeta } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const video = body?.video as VideoMeta | undefined;
  const comments: Comment[] = Array.isArray(body?.comments) ? body.comments : [];
  const analysis = body?.analysis as Analysis | undefined;

  if (!video?.videoId || !analysis?.clusters) {
    return NextResponse.json(
      { error: "Run the analysis first.", code: "invalid_input" },
      { status: 400 }
    );
  }

  // "Reply as me": the style sample is the creator's own replies. The demo
  // bundles them; on a real video the creator's replies are whichever of the
  // fetched comments they authored. No replies → no profile → neutral voice,
  // and the UI says which one happened.
  const ownReplies = isDemoId(video.videoId)
    ? creatorReplies.replies
    : comments
        .filter((c) => video.channelId && c.authorChannelId === video.channelId)
        .map((c) => c.text);
  const voice = buildStyleProfile(ownReplies);

  const actions = await planActions({ video, comments, analysis }, voice);
  return NextResponse.json({
    actions,
    voice: voice
      ? { sampleSize: voice.sampleSize, summary: describeStyleProfile(voice) }
      : null,
  });
}

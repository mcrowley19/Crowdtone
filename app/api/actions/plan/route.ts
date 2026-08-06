import { NextRequest, NextResponse } from "next/server";
import { planActions } from "@/lib/actions";
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

  const actions = await planActions({ video, comments, analysis });
  return NextResponse.json({ actions });
}

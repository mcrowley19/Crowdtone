import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import type { Comment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Clustering runs first as batches (6 max, 4 in flight, 60s each, so two waves
// worst case at 120s), then three section calls in parallel at 90s. That is
// ~210s of ceiling against the 300s Vercel allows.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const comments: Comment[] = Array.isArray(body.comments) ? body.comments : [];
  const videoTitle: string = typeof body.videoTitle === "string" ? body.videoTitle : "";

  if (comments.length === 0) {
    return NextResponse.json({ error: "No comments to analyze.", code: "invalid_input" }, { status: 400 });
  }

  const analysis = await runAnalysis(comments, videoTitle);
  return NextResponse.json({ analysis });
}

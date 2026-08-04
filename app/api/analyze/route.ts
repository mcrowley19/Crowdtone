import { NextRequest, NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyze";
import type { Comment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Clustering runs first, then three calls in parallel: worst case is two
// sequential LLM timeouts (90s each) plus overhead. Vercel allows 300s.
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

import { NextRequest, NextResponse } from "next/server";
import { generateVariants } from "@/lib/thumbnails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoId: string = typeof body.videoId === "string" ? body.videoId : "";
  const texts: string[] = Array.isArray(body.texts)
    ? body.texts.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  if (!videoId || !/^[A-Za-z0-9_-]{1,32}$/.test(videoId)) {
    return NextResponse.json({ error: "Valid videoId required.", code: "invalid_input" }, { status: 400 });
  }
  if (texts.length === 0) {
    return NextResponse.json({ error: "At least one overlay text required.", code: "invalid_input" }, { status: 400 });
  }

  try {
    const variants = await generateVariants(videoId, texts);
    return NextResponse.json({ variants });
  } catch (err) {
    console.error("Thumbnail generation failed:", err);
    return NextResponse.json({ error: "Thumbnail generation failed.", code: "thumbnail" }, { status: 500 });
  }
}

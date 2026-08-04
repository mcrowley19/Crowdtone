import { NextResponse } from "next/server";
import { getLLMConfig } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const llm = getLLMConfig();
  return NextResponse.json({
    youtube: Boolean(process.env.YOUTUBE_API_KEY),
    llm: llm ? llm.provider : null,
    model: llm?.model ?? null,
  });
}

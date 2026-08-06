import { NextRequest, NextResponse } from "next/server";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { applyAction, OwnershipError } from "@/lib/actions";
import { isDemoId } from "@/lib/demo";
import type { ActionResult, ProposedAction } from "@/lib/types";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoId: string = typeof body?.videoId === "string" ? body.videoId : "";
  const actions: ProposedAction[] = Array.isArray(body?.actions) ? body.actions : [];
  // Writing is opt-in per request: without an explicit confirm this endpoint
  // only ever previews. The UI sends confirm:true from a second, deliberate click.
  const dryRun = body?.confirm !== true;

  if (!videoId || actions.length === 0) {
    return NextResponse.json({ error: "Nothing to apply.", code: "invalid_input" }, { status: 400 });
  }

  // A preview reaches no write endpoint, so it needs neither a connected
  // channel nor a real video — you can see exactly what would be sent first.
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      results: actions.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: "dry_run" as const,
        message: "Previewed — nothing was sent to YouTube.",
      })),
    });
  }

  if (isDemoId(videoId)) {
    return NextResponse.json(
      { error: "The demo dataset isn't a real video — connect a channel and analyze one of your own.", code: "demo" },
      { status: 400 }
    );
  }

  try {
    const { session, changed } = await requireSession(req);

    const results: ActionResult[] = [];
    // Sequential on purpose: two videos.update calls racing each other would
    // have one overwrite the other's snippet.
    for (const action of actions) {
      try {
        results.push(
          await applyAction(session.accessToken, session.channelId, videoId, action, dryRun)
        );
      } catch (err) {
        results.push({
          id: action.id,
          kind: action.kind,
          status: "failed",
          message:
            err instanceof OwnershipError || err instanceof YouTubeApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed.",
        });
      }
    }

    const res = NextResponse.json({ results, dryRun });
    return changed ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 401 });
    }
    console.error("Apply failed:", err);
    return NextResponse.json({ error: "Could not reach YouTube.", code: "network" }, { status: 502 });
  }
}

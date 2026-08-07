import { NextRequest, NextResponse } from "next/server";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { applyAction, OwnershipError } from "@/lib/actions";
import { isDemoId } from "@/lib/demo";
import type { ActionResult, ProposedAction } from "@/lib/types";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function simulatedMessage(action: ProposedAction): string {
  const outcome: Partial<Record<ProposedAction["kind"], string>> = {
    retitle: `The title would now be “${action.payload?.title ?? ""}”.`,
    add_chapters: `${action.payload?.chapters?.length ?? 0} chapters would be written into the description.`,
    update_description: "The description would be updated.",
    set_thumbnail: "The new thumbnail would be uploaded.",
    post_comment: "The comment would be posted (pinning is still a Studio click).",
    reply_to_comment: `The reply to ${action.payload?.parentAuthor ?? "the viewer"} would be posted.`,
    set_localizations: `Localized packaging would be published for: ${Object.keys(action.payload?.localizations ?? {}).join(", ")}.`,
  };
  return `Simulated publish. This is the bundled demo dataset, nothing was sent to YouTube. ${outcome[action.kind] ?? ""}`;
}

/**
 * Idempotency, best-effort: the UI mints one requestId when the publish
 * button is armed, so a double-fired confirm (retry, double click that beat
 * the disabled state, flaky network resubmit) is rejected instead of posting
 * the same comment twice. In-memory, so it protects within a warm serverless
 * instance — the README says exactly that.
 */
const seenRequests = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function isDuplicateRequest(requestId: string, now = Date.now()): boolean {
  seenRequests.forEach((at, id) => {
    if (now - at > DEDUPE_WINDOW_MS) seenRequests.delete(id);
  });
  if (seenRequests.has(requestId)) return true;
  seenRequests.set(requestId, now);
  return false;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoId: string = typeof body?.videoId === "string" ? body.videoId : "";
  const actions: ProposedAction[] = Array.isArray(body?.actions) ? body.actions : [];
  // Writing is opt-in per request: without an explicit confirm this endpoint
  // only ever previews. The UI sends confirm:true from a second, deliberate click.
  const dryRun = body?.confirm !== true;
  const requestId = typeof body?.requestId === "string" ? body.requestId.slice(0, 64) : "";

  if (!dryRun && requestId && isDuplicateRequest(requestId)) {
    return NextResponse.json(
      { error: "This publish was already sent. Refusing to send it twice.", code: "duplicate" },
      { status: 409 }
    );
  }

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
        message: "Previewed. Nothing was sent to YouTube.",
      })),
    });
  }

  // The demo dataset publishes in simulation: every action "lands" with the
  // exact message and diff a real publish would produce, nothing reaches
  // YouTube, and the result says so in so many words.
  if (isDemoId(videoId)) {
    return NextResponse.json({
      simulated: true,
      results: actions.map((a) => ({
        id: a.id,
        kind: a.kind,
        status: "simulated" as const,
        message: simulatedMessage(a),
      })),
    });
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

import { NextRequest, NextResponse } from "next/server";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { setModerationStatus, type ModerationStatus } from "@/lib/moderation";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BATCH = 50;

/**
 * Applies a moderation status to a batch of flagged comments. Same contract
 * as /api/actions/apply: a dry run unless the body carries `confirm: true`,
 * which the UI only sends after a second, deliberate click. "published" is
 * the undo — it puts a hidden comment back.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.commentIds)
    ? body.commentIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : [];
  const status = body?.status as ModerationStatus;
  const confirm = body?.confirm === true;

  if (ids.length === 0) {
    return NextResponse.json({ error: "No comment ids to moderate." }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json({ error: `At most ${MAX_BATCH} comments per batch.` }, { status: 400 });
  }
  if (!["rejected", "heldForReview", "published"].includes(status)) {
    return NextResponse.json({ error: "status must be rejected, heldForReview, or published." }, { status: 400 });
  }

  // The demo channel's flagged comments moderate in simulation — the full
  // confirm loop runs, the result says "simulated", and no session is needed
  // because no write can happen.
  if (body?.demo === true) {
    const verb = status === "published" ? "restored" : "hidden";
    return NextResponse.json({
      simulated: true,
      results: ids.map((commentId: string) => ({
        commentId,
        status: confirm ? ("simulated" as const) : ("dry_run" as const),
        message: confirm
          ? `Simulated. This demo comment would be ${verb}. Nothing was sent to YouTube.`
          : `Would be ${verb}. Nothing was sent to YouTube.`,
      })),
    });
  }

  try {
    const { session, changed } = await requireSession(req);
    const results = await setModerationStatus(session.accessToken, ids, status, !confirm);
    const res = NextResponse.json({ results });
    return changed ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 401 });
    }
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Moderation failed:", err);
    return NextResponse.json({ error: "Moderation failed." }, { status: 500 });
  }
}

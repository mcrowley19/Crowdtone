import { NextRequest, NextResponse } from "next/server";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { OwnershipError, undoAction } from "@/lib/actions";
import type { UndoTicket } from "@/lib/types";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ticket = body?.undo as UndoTicket | undefined;
  if (!ticket?.kind) {
    return NextResponse.json({ error: "Nothing to undo.", code: "invalid_input" }, { status: 400 });
  }

  try {
    const { session, changed } = await requireSession(req);
    const message = await undoAction(session.accessToken, session.channelId, ticket);
    const res = NextResponse.json({ message });
    return changed ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 401 });
    }
    if (err instanceof OwnershipError || err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: "refused" }, { status: 403 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Undo failed.", code: "undo_failed" },
      { status: 500 }
    );
  }
}

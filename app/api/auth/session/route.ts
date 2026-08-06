import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, readSession } from "@/lib/authserver";
import { getOAuthConfig } from "@/lib/oauth";
import { getSessionSecret } from "@/lib/session";
import { revokeToken } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const configured = Boolean(getOAuthConfig(req.nextUrl.origin) && getSessionSecret());
  const session = readSession(req);
  return NextResponse.json({
    configured,
    connected: Boolean(session),
    channelId: session?.channelId ?? null,
    channelTitle: session?.channelTitle ?? null,
  });
}

export async function DELETE(req: NextRequest) {
  const session = readSession(req);
  if (session) await revokeToken(session.refreshToken ?? session.accessToken);
  return clearSessionCookie(NextResponse.json({ connected: false }));
}

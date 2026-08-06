import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, getOAuthConfig } from "@/lib/oauth";
import { OAUTH_STATE_COOKIE, randomState } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const config = getOAuthConfig(req.nextUrl.origin);
  if (!config) {
    return NextResponse.redirect(new URL("/app?auth_error=not_configured", req.nextUrl.origin));
  }
  const state = randomState();
  const res = NextResponse.redirect(buildAuthUrl(config, state));
  // Round-tripped through Google and compared on the way back: CSRF guard.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}

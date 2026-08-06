import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getOAuthConfig } from "@/lib/oauth";
import { OAUTH_STATE_COOKIE, getSessionSecret, type Session } from "@/lib/session";
import { setSessionCookie } from "@/lib/authserver";
import { ytAuthedGet } from "@/lib/ytclient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(new URL(`/app?auth_error=${encodeURIComponent(reason)}`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;

  if (params.get("error")) return fail(origin, params.get("error") ?? "denied");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code) return fail(origin, "no_code");
  if (!state || !expectedState || state !== expectedState) return fail(origin, "bad_state");

  const config = getOAuthConfig(origin);
  if (!config || !getSessionSecret()) return fail(origin, "not_configured");

  try {
    const tokens = await exchangeCode(config, code);
    const channels = await ytAuthedGet(tokens.accessToken, "channels", {
      part: "snippet,contentDetails",
      mine: "true",
    });
    const channel = channels?.items?.[0];
    if (!channel?.id) return fail(origin, "no_channel");

    const session: Session = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      channelId: channel.id,
      channelTitle: channel.snippet?.title ?? "your channel",
      uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads,
    };

    const res = NextResponse.redirect(new URL("/app?connected=1", origin));
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return setSessionCookie(res, session);
  } catch (err) {
    console.error("OAuth callback failed:", err);
    return fail(origin, "exchange_failed");
  }
}

import type { NextRequest, NextResponse } from "next/server";
import type { ChannelAuth } from "./channel";
import { getOAuthConfig, refreshAccessToken } from "./oauth";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, getSessionSecret, signSession, verifySession, type Session } from "./session";

export class NotConnectedError extends Error {
  constructor(message = "Connect your YouTube channel first.") {
    super(message);
    this.name = "NotConnectedError";
  }
}

export function readSession(req: NextRequest): Session | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);
}

/**
 * Returns a session whose access token is good for at least the next minute,
 * refreshing it if needed. `changed` tells the caller to re-issue the cookie.
 */
export async function ensureFreshSession(
  session: Session,
  origin: string
): Promise<{ session: Session; changed: boolean }> {
  if (session.expiresAt > Date.now()) return { session, changed: false };
  if (!session.refreshToken) throw new NotConnectedError("Your YouTube sign-in expired — connect again.");
  const config = getOAuthConfig(origin);
  if (!config) throw new NotConnectedError("OAuth is not configured on this deployment.");
  let tokens;
  try {
    tokens = await refreshAccessToken(config, session.refreshToken);
  } catch (err) {
    // A dead refresh token is the normal end of a session, not a network fault:
    // the user revoked access, or — while the OAuth client is unverified —
    // Google expired it after 7 days. Either way the fix is to connect again,
    // so say that rather than reporting a YouTube outage.
    throw new NotConnectedError("Your YouTube sign-in has expired — connect again.");
  }
  return {
    session: {
      ...session,
      accessToken: tokens.accessToken,
      // Google usually omits refresh_token on a refresh; keep the one we have.
      refreshToken: tokens.refreshToken ?? session.refreshToken,
      expiresAt: tokens.expiresAt,
    },
    changed: true,
  };
}

/** Reads, refreshes, and throws NotConnectedError when there is no usable session. */
export async function requireSession(req: NextRequest): Promise<{ session: Session; changed: boolean }> {
  const existing = readSession(req);
  if (!existing) throw new NotConnectedError();
  return ensureFreshSession(existing, req.nextUrl.origin);
}

/**
 * Picks the credential to read a channel with: the connected creator's token
 * when they're looking at their own channel, the public API key otherwise.
 * Shared by /api/channel and /api/plan so the two never disagree.
 */
export async function resolveChannelAuth(
  req: NextRequest,
  input: string
): Promise<{
  auth: ChannelAuth | null;
  session: Session | null;
  refreshed: boolean;
  reason?: "no_api_key";
}> {
  const existing = readSession(req);
  if (existing && !input) {
    try {
      const fresh = await ensureFreshSession(existing, req.nextUrl.origin);
      return { auth: { kind: "token", token: fresh.session.accessToken }, session: fresh.session, refreshed: fresh.changed };
    } catch {
      // Fall through to the key path rather than failing the whole request.
    }
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { auth: null, session: existing, refreshed: false, reason: "no_api_key" };
  return { auth: { kind: "key", key }, session: existing, refreshed: false };
}

export function setSessionCookie(res: NextResponse, session: Session): NextResponse {
  const secret = getSessionSecret();
  if (!secret) return res;
  res.cookies.set(SESSION_COOKIE, signSession(session, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

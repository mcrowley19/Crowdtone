import crypto from "crypto";

/**
 * The signed-in creator's session. Lives entirely in one HMAC-signed httpOnly
 * cookie — no database, no server-side store, so a deployment stays stateless
 * and there is nowhere for someone else's tokens to pile up.
 */
export interface Session {
  accessToken: string;
  refreshToken?: string;
  /** Epoch millis at which accessToken stops working. */
  expiresAt: number;
  channelId: string;
  channelTitle: string;
  uploadsPlaylistId?: string;
}

export const SESSION_COOKIE = "as_session";
export const OAUTH_STATE_COOKIE = "as_oauth_state";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

/**
 * Falls back to the client secret so a working OAuth setup needs one fewer
 * environment variable; SESSION_SECRET is still honoured when set.
 */
export function getSessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  return env.SESSION_SECRET || env.GOOGLE_CLIENT_SECRET || null;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function hmac(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(session: Session, secret: string): string {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${hmac(secret, payload)}`;
}

/** Returns null for anything tampered with, truncated, or not our JSON shape. */
export function verifySession(token: string | undefined, secret: string): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = hmac(secret, payload);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed?.accessToken !== "string" || typeof parsed?.channelId !== "string") return null;
    return parsed as Session;
  } catch {
    return null;
  }
}

export function randomState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

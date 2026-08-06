const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * `youtube.force-ssl` is the scope that lets us write: update a video's
 * snippet, upload a thumbnail, post and reply to comments. `youtube.readonly`
 * covers reading the signed-in creator's own uploads and their stats, and
 * `yt-analytics.readonly` unlocks the numbers Studio shows but the Data API
 * doesn't: audience retention, traffic sources, watch geography.
 */
export const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * The redirect URI defaults to the origin the request arrived on, so the same
 * build works on localhost and on a preview URL without reconfiguration.
 * Set OAUTH_REDIRECT_URI when the app sits behind a proxy that rewrites host.
 */
export function getOAuthConfig(
  origin: string,
  env: Record<string, string | undefined> = process.env
): OAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: env.OAUTH_REDIRECT_URI || `${origin.replace(/\/$/, "")}/api/auth/callback`,
  };
}

export function buildAuthUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent is what actually yields a refresh token; without both,
    // Google returns one only on a user's very first authorization ever.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export function mapTokenResponse(body: any, now = Date.now()): TokenResponse {
  if (typeof body?.access_token !== "string") {
    throw new Error(body?.error_description || body?.error || "Token response had no access_token");
  }
  const expiresIn = Number(body.expires_in);
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : undefined,
    // 60s of slack so a token never expires mid-request.
    expiresAt: now + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3600_000) - 60_000,
  };
}

async function postToken(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error_description || body?.error || `Token exchange failed (HTTP ${res.status})`);
  }
  return mapTokenResponse(body);
}

export function exchangeCode(config: OAuthConfig, code: string): Promise<TokenResponse> {
  return postToken({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
}

export function refreshAccessToken(config: OAuthConfig, refreshToken: string): Promise<TokenResponse> {
  return postToken({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
}

/** Best-effort revocation on sign-out, so the grant does not outlive the cookie. */
export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }).toString(),
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}

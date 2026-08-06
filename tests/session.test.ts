import { describe, expect, it } from "vitest";
import { getSessionSecret, randomState, signSession, verifySession, type Session } from "@/lib/session";
import { buildAuthUrl, getOAuthConfig, mapTokenResponse, SCOPES } from "@/lib/oauth";

const SECRET = "test-secret";

const session: Session = {
  accessToken: "ya29.token",
  refreshToken: "1//refresh",
  expiresAt: 1_800_000_000_000,
  channelId: "UC0000000000000000000000",
  channelTitle: "Test channel",
};

describe("session cookie", () => {
  it("round-trips a session", () => {
    expect(verifySession(signSession(session, SECRET), SECRET)).toEqual(session);
  });

  it("rejects a tampered payload", () => {
    const token = signSession(session, SECRET);
    const forged = Buffer.from(
      JSON.stringify({ ...session, channelId: "UCsomeoneelse00000000000" })
    ).toString("base64url");
    expect(verifySession(`${forged}.${token.split(".")[1]}`, SECRET)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", () => {
    expect(verifySession(signSession(session, "other-secret"), SECRET)).toBeNull();
  });

  it("rejects junk without throwing", () => {
    expect(verifySession(undefined, SECRET)).toBeNull();
    expect(verifySession("", SECRET)).toBeNull();
    expect(verifySession("no-dot", SECRET)).toBeNull();
    expect(verifySession("a.b", SECRET)).toBeNull();
  });

  it("issues unguessable state values", () => {
    expect(new Set([randomState(), randomState(), randomState()]).size).toBe(3);
    expect(randomState().length).toBeGreaterThan(16);
  });

  it("falls back to the client secret so setup needs one fewer variable", () => {
    expect(getSessionSecret({ GOOGLE_CLIENT_SECRET: "cs" })).toBe("cs");
    expect(getSessionSecret({ SESSION_SECRET: "ss", GOOGLE_CLIENT_SECRET: "cs" })).toBe("ss");
    expect(getSessionSecret({})).toBeNull();
  });
});

describe("oauth", () => {
  const env = { GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "csecret" };

  it("derives the redirect URI from the request origin", () => {
    expect(getOAuthConfig("https://example.com", env)!.redirectUri).toBe(
      "https://example.com/api/auth/callback"
    );
    expect(getOAuthConfig("http://localhost:3000/", env)!.redirectUri).toBe(
      "http://localhost:3000/api/auth/callback"
    );
  });

  it("honours an explicit override", () => {
    expect(
      getOAuthConfig("https://example.com", { ...env, OAUTH_REDIRECT_URI: "https://x.dev/cb" })!.redirectUri
    ).toBe("https://x.dev/cb");
  });

  it("is null without a client", () => {
    expect(getOAuthConfig("https://example.com", {})).toBeNull();
  });

  it("asks for offline access and the write scope", () => {
    const url = new URL(buildAuthUrl(getOAuthConfig("https://example.com", env)!, "state123"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(" "));
    expect(SCOPES).toContain("https://www.googleapis.com/auth/youtube.force-ssl");
  });

  it("expires tokens a minute early so none dies mid-request", () => {
    const now = 1_000_000;
    const tokens = mapTokenResponse({ access_token: "at", expires_in: 3600 }, now);
    expect(tokens.expiresAt).toBe(now + 3600_000 - 60_000);
    expect(tokens.refreshToken).toBeUndefined();
  });

  it("throws with Google's own message when there is no token", () => {
    expect(() => mapTokenResponse({ error_description: "bad grant" })).toThrow("bad grant");
  });
});

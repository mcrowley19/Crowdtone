"use client";

export interface Connection {
  configured: boolean;
  connected: boolean;
  channelId: string | null;
  channelTitle: string | null;
}

const AUTH_ERRORS: Record<string, string> = {
  not_configured: "This deployment has no Google OAuth client set up, so it can only read, not write.",
  bad_state: "That sign-in didn't come back the way it left. Try connecting again.",
  no_code: "Google didn't return an authorization code. Try again.",
  no_channel: "That Google account has no YouTube channel on it.",
  exchange_failed: "Google refused the token exchange. Check the client ID, secret, and redirect URI.",
  access_denied: "Sign-in was cancelled.",
};

export function ConnectBar({
  connection,
  authError,
  onDisconnect,
}: {
  connection: Connection | null;
  authError: string | null;
  onDisconnect: () => void;
}) {
  if (!connection) return null;

  return (
    <div className="connectbar">
      {connection.connected ? (
        <>
          <span className="cdot on" aria-hidden />
          <span className="ctext">
            Connected as <b>{connection.channelTitle}</b> — AudienceSignal can publish changes to this
            channel's videos.
          </span>
          <button className="textlink" onClick={onDisconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          <span className="cdot" aria-hidden />
          <span className="ctext">
            {connection.configured
              ? "Read-only. Connect your channel to let AudienceSignal make the changes instead of just listing them."
              : "Read-only: no Google OAuth client is configured on this deployment, so changes can be previewed but not published."}
          </span>
          {connection.configured && (
            <a className="connectbtn" href="/api/auth/start">
              Connect YouTube channel
            </a>
          )}
        </>
      )}
      {authError && <div className="cerror">{AUTH_ERRORS[authError] ?? `Sign-in failed: ${authError}`}</div>}
    </div>
  );
}

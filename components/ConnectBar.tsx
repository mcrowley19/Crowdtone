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

export function authErrorMessage(code: string): string {
  return AUTH_ERRORS[code] ?? `Sign-in failed: ${code}`;
}

/**
 * Write access, stated in a chip. Connected shows whose channel is on the
 * hook; disconnected shows the one button that changes that.
 */
export function ConnectBar({
  connection,
  onDisconnect,
}: {
  connection: Connection | null;
  onDisconnect: () => void;
}) {
  if (!connection) return null;

  if (connection.connected) {
    return (
      <div className="connectbar">
        <span className="cdot on" aria-hidden />
        <span className="ctext" title={`Connected as ${connection.channelTitle}. Changes can be published`}>
          <b>{connection.channelTitle}</b>
        </span>
        <button className="textlink" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="connectbar">
      <span className="cdot" aria-hidden />
      <span
        className="ctext"
        title={
          connection.configured
            ? "Read-only. Connect your channel to publish changes instead of just listing them."
            : "Read-only: no Google OAuth client is configured on this deployment."
        }
      >
        Read-only
      </span>
      {connection.configured && (
        <a className="connectbtn" href="/api/auth/start">
          Connect channel
        </a>
      )}
    </div>
  );
}

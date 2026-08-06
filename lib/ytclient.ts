import { YouTubeApiError } from "./youtube";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

function toAuthError(status: number, body: any): YouTubeApiError {
  const reason = body?.error?.errors?.[0]?.reason ?? "";
  const message = body?.error?.message ?? `YouTube API error (HTTP ${status})`;
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || reason === "dailyLimitExceeded") {
    return new YouTubeApiError(message, "quota", status);
  }
  if (status === 401) {
    return new YouTubeApiError("Your YouTube sign-in expired — connect again.", "invalid_key", 401);
  }
  if (status === 403) {
    return new YouTubeApiError(
      message || "YouTube refused the change — check that this channel owns the video.",
      "invalid_key",
      403
    );
  }
  if (status === 404) return new YouTubeApiError(message, "not_found", 404);
  return new YouTubeApiError(message, "http", status);
}

async function request(
  url: string,
  accessToken: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<any> {
  const { timeoutMs = 20000, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { Authorization: `Bearer ${accessToken}`, ...(headers as Record<string, string>) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 204) return {};
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw toAuthError(res.status, body);
  return body;
}

export function ytAuthedGet(
  accessToken: string,
  path: string,
  params: Record<string, string>
): Promise<any> {
  return request(`${API_BASE}/${path}?${new URLSearchParams(params).toString()}`, accessToken);
}

export function ytAuthedWrite(
  accessToken: string,
  path: string,
  params: Record<string, string>,
  body: unknown,
  method: "POST" | "PUT" = "POST"
): Promise<any> {
  return request(`${API_BASE}/${path}?${new URLSearchParams(params).toString()}`, accessToken, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function ytAuthedDelete(
  accessToken: string,
  path: string,
  params: Record<string, string>
): Promise<any> {
  return request(`${API_BASE}/${path}?${new URLSearchParams(params).toString()}`, accessToken, {
    method: "DELETE",
  });
}

/** thumbnails.set is a media upload, so the JPEG bytes go up as the raw body. */
export function ytAuthedUpload(
  accessToken: string,
  path: string,
  params: Record<string, string>,
  bytes: Buffer,
  contentType: string
): Promise<any> {
  return request(`${UPLOAD_BASE}/${path}?${new URLSearchParams(params).toString()}`, accessToken, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes),
    timeoutMs: 45000,
  });
}

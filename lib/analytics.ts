import type { TimestampMention } from "./chapters";
import { formatTimestamp } from "./chapters";
import { median } from "./channel";
import { YouTubeApiError } from "./youtube";

/**
 * YouTube Analytics API v2 — the numbers Studio shows a creator but the Data
 * API doesn't carry: second-by-second audience retention, traffic sources,
 * and watch geography. Only works for the connected channel's own videos,
 * which is exactly where Crowdtone's writes are allowed anyway.
 */

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";

export class AnalyticsScopeError extends Error {
  constructor(
    message = "Your sign-in predates analytics support. Disconnect and connect again to grant it."
  ) {
    super(message);
    this.name = "AnalyticsScopeError";
  }
}

async function report(accessToken: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ids: "channel==MINE", ...params }).toString();
  const res = await fetch(`${ANALYTICS_BASE}?${qs}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    // Sessions created before the yt-analytics scope was added land here.
    throw new AnalyticsScopeError();
  }
  if (!res.ok) {
    throw new YouTubeApiError(body?.error?.message ?? `Analytics error (HTTP ${res.status})`, "http", res.status);
  }
  return body;
}

/** Column-name → value objects, so callers never index rows by position. */
export function mapReportRows(body: any): Record<string, number | string>[] {
  const headers: string[] = Array.isArray(body?.columnHeaders)
    ? body.columnHeaders.map((h: any) => h?.name ?? "")
    : [];
  const rows: any[][] = Array.isArray(body?.rows) ? body.rows : [];
  return rows.map((row) => {
    const out: Record<string, number | string> = {};
    headers.forEach((name, i) => {
      if (name) out[name] = row[i];
    });
    return out;
  });
}

/* ------------------------------ retention ------------------------------- */

export interface RetentionPoint {
  /** 0–1 position in the video. */
  ratio: number;
  /** Share of the starting audience still watching, 0–1. */
  watchRatio: number;
}

export interface RetentionDip {
  seconds: number;
  timestamp: string;
  /** Percentage points of audience lost across this moment. */
  dropPercent: number;
  /** What viewers said about this exact moment, when any comment points here. */
  mentions: { count: number; quote: string } | null;
}

export interface RetentionAnalysis {
  curve: RetentionPoint[];
  dips: RetentionDip[];
  /** Share of the audience still there at the halfway mark. */
  atHalfway: number | null;
}

export function mapRetentionCurve(rows: Record<string, number | string>[]): RetentionPoint[] {
  return rows
    .map((r) => ({
      ratio: Number(r.elapsedVideoTimeRatio),
      watchRatio: Number(r.audienceWatchRatio),
    }))
    .filter((p) => Number.isFinite(p.ratio) && Number.isFinite(p.watchRatio))
    .sort((a, b) => a.ratio - b.ratio);
}

/**
 * The steepest falls in the curve — where the audience actually left. Looks
 * at the drop across a ~4% window of the video, keeps the local maxima, and
 * skips the first 10%: everyone loses viewers in the opening stretch, and
 * telling a creator "people leave at 0:03" is noise, not insight. A dip only
 * counts if it falls at least 3× as fast as the curve's own typical drop, so
 * ordinary decay — however steep the channel's normal is — never qualifies.
 */
export function findRetentionDips(
  curve: RetentionPoint[],
  durationSeconds: number,
  maxDips = 3
): Omit<RetentionDip, "mentions">[] {
  if (curve.length < 10 || durationSeconds <= 0) return [];
  const window = Math.max(1, Math.round(curve.length * 0.04));
  const drops: { index: number; drop: number }[] = [];
  for (let i = window; i < curve.length; i++) {
    if (curve[i].ratio < 0.1) continue;
    drops.push({ index: i, drop: curve[i - window].watchRatio - curve[i].watchRatio });
  }
  const typicalDrop = median(drops.map((d) => Math.max(0, d.drop)));
  const floor = Math.max(0.015, typicalDrop * 3);
  drops.sort((a, b) => b.drop - a.drop);

  const picked: { index: number; drop: number }[] = [];
  for (const d of drops) {
    if (d.drop < floor) break;
    // Two picks inside the same window are the same cliff, not two cliffs.
    if (picked.some((p) => Math.abs(p.index - d.index) <= window * 2)) continue;
    picked.push(d);
    if (picked.length >= maxDips) break;
  }

  return picked
    .sort((a, b) => a.index - b.index)
    .map(({ index, drop }) => {
      // The drop is measured across [index - window, index], so the cliff
      // itself sits mid-window — report that, not the window's trailing edge.
      const ratio = (curve[index - window].ratio + curve[index].ratio) / 2;
      const seconds = Math.round(ratio * durationSeconds);
      return {
        seconds,
        timestamp: formatTimestamp(seconds),
        dropPercent: Math.round(drop * 1000) / 10,
      };
    });
}

/**
 * The join that makes retention actionable: a dip is a mystery, but a dip
 * that three comments point at by timestamp is a diagnosis. Mentions within
 * ±25s of a dip are treated as being about that moment.
 */
export function joinDipsWithMentions(
  dips: Omit<RetentionDip, "mentions">[],
  mentions: TimestampMention[]
): RetentionDip[] {
  return dips.map((dip) => {
    const near = mentions.filter((m) => Math.abs(m.seconds - dip.seconds) <= 25);
    if (near.length === 0) return { ...dip, mentions: null };
    const count = near.reduce((n, m) => n + m.count, 0);
    const quote = near.sort((a, b) => b.count - a.count)[0].quotes[0] ?? "";
    return { ...dip, mentions: { count, quote } };
  });
}

/**
 * The one concrete edit a creator can make about this dip, derived from what
 * is actually known: a dip with comment evidence gets a targeted fix; a dip
 * without gets the honest instruction to go look.
 */
export function dipEditAction(dip: RetentionDip): string {
  if (dip.mentions) {
    return (
      `Pin a correction or reply at ${dip.timestamp} answering "${dip.mentions.quote.slice(0, 120)}", ` +
      `and add a chapter just before it so viewers can navigate instead of leaving.`
    );
  }
  return `Rewatch ${dip.timestamp} ±15s. No comment explains this drop, so the answer is in the footage. Tighten or cut the segment in the next edit.`;
}

export interface VideoAnalytics {
  totals: {
    views: number;
    estimatedMinutesWatched: number;
    averageViewDuration: number;
    averageViewPercentage: number;
    subscribersGained: number;
  } | null;
  retention: RetentionAnalysis | null;
  trafficSources: { source: string; views: number }[];
  countries: { country: string; views: number }[];
}

const TRAFFIC_LABEL: Record<string, string> = {
  ADVERTISING: "Ads",
  ANNOTATION: "Annotations",
  CAMPAIGN_CARD: "Campaign cards",
  END_SCREEN: "End screens",
  EXT_URL: "External links",
  HASHTAGS: "Hashtags",
  IMMERSIVE_LIVE_FEED: "Live feed",
  LIVE_REDIRECT: "Live redirect",
  NO_LINK_EMBEDDED: "Embedded players",
  NO_LINK_OTHER: "Direct or unknown",
  NOTIFICATION: "Notifications",
  PLAYLIST: "Playlists",
  PRODUCT_PAGE: "Product pages",
  PROMOTED: "Promoted",
  RELATED_VIDEO: "Suggested videos",
  SHORTS: "Shorts feed",
  SHORTS_CONTENT_LINKS: "Shorts links",
  SOUND_PAGE: "Sound pages",
  SUBSCRIBER: "Subscriptions feed",
  YT_CHANNEL: "Channel pages",
  YT_OTHER_PAGE: "Other YouTube pages",
  YT_PLAYLIST_PAGE: "Playlist pages",
  YT_SEARCH: "YouTube search",
  VIDEO_REMIXES: "Remixes",
};

export function labelTrafficSource(code: string): string {
  return TRAFFIC_LABEL[code] ?? code.replace(/_/g, " ").toLowerCase();
}

/** Every section fetched independently: one 400 must not blank the others. */
export async function fetchVideoAnalytics(
  accessToken: string,
  videoId: string,
  publishedAt: string,
  durationSeconds: number,
  mentions: TimestampMention[]
): Promise<VideoAnalytics> {
  const start = (publishedAt || "2010-01-01").slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const base = { startDate: start, endDate: end, filters: `video==${videoId}` };

  const [totalsBody, retentionBody, trafficBody, geoBody] = await Promise.all([
    report(accessToken, {
      ...base,
      metrics: "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained",
    }),
    report(accessToken, {
      ...base,
      dimensions: "elapsedVideoTimeRatio",
      metrics: "audienceWatchRatio",
    }).catch(() => null),
    report(accessToken, {
      ...base,
      dimensions: "insightTrafficSourceType",
      metrics: "views",
      sort: "-views",
    }).catch(() => null),
    report(accessToken, {
      ...base,
      dimensions: "country",
      metrics: "views",
      sort: "-views",
      maxResults: "10",
    }).catch(() => null),
  ]);

  const totalsRow = mapReportRows(totalsBody)[0];
  const curve = retentionBody ? mapRetentionCurve(mapReportRows(retentionBody)) : [];
  const dips = joinDipsWithMentions(findRetentionDips(curve, durationSeconds), mentions);
  const halfway = curve.find((p) => p.ratio >= 0.5);

  return {
    totals: totalsRow
      ? {
          views: Number(totalsRow.views ?? 0),
          estimatedMinutesWatched: Number(totalsRow.estimatedMinutesWatched ?? 0),
          averageViewDuration: Number(totalsRow.averageViewDuration ?? 0),
          averageViewPercentage: Number(totalsRow.averageViewPercentage ?? 0),
          subscribersGained: Number(totalsRow.subscribersGained ?? 0),
        }
      : null,
    retention:
      curve.length > 0
        ? { curve, dips, atHalfway: halfway ? Math.round(halfway.watchRatio * 1000) / 10 : null }
        : null,
    trafficSources: trafficBody
      ? mapReportRows(trafficBody)
          .map((r) => ({
            source: labelTrafficSource(String(r.insightTrafficSourceType ?? "")),
            views: Number(r.views ?? 0),
          }))
          .filter((t) => t.views > 0)
          .slice(0, 8)
      : [],
    countries: geoBody
      ? mapReportRows(geoBody)
          .map((r) => ({ country: String(r.country ?? ""), views: Number(r.views ?? 0) }))
          .filter((c) => c.country && c.views > 0)
      : [],
  };
}

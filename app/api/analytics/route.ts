import { NextRequest, NextResponse } from "next/server";
import {
  AnalyticsScopeError,
  fetchVideoAnalytics,
  findRetentionDips,
  joinDipsWithMentions,
  type VideoAnalytics,
} from "@/lib/analytics";
import { NotConnectedError, requireSession, setSessionCookie } from "@/lib/authserver";
import { extractTimestampMentions } from "@/lib/chapters";
import { DEMO_DURATION_SECONDS, getDemoRetentionCurve, isDemoId } from "@/lib/demo";
import type { Comment } from "@/lib/types";
import { YouTubeApiError } from "@/lib/youtube";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  const publishedAt = typeof body?.publishedAt === "string" ? body.publishedAt : "";
  const durationSeconds = Number(body?.durationSeconds) || 0;
  const comments: Comment[] = Array.isArray(body?.comments) ? body.comments : [];

  if (!videoId) return NextResponse.json({ error: "No videoId." }, { status: 400 });

  // The demo video gets a bundled retention curve, but the dips, the joins to
  // comment timestamps, and everything downstream run through the same code
  // as a live channel.
  if (isDemoId(videoId)) {
    const curve = getDemoRetentionCurve();
    const mentions = extractTimestampMentions(comments, DEMO_DURATION_SECONDS);
    const dips = joinDipsWithMentions(findRetentionDips(curve, DEMO_DURATION_SECONDS), mentions);
    const halfway = curve.find((p) => p.ratio >= 0.5);
    const analytics: VideoAnalytics = {
      totals: {
        views: 48213,
        estimatedMinutesWatched: 301400,
        averageViewDuration: 375,
        averageViewPercentage: 26.1,
        subscribersGained: 412,
      },
      retention: { curve, dips, atHalfway: halfway ? Math.round(halfway.watchRatio * 1000) / 10 : null },
      trafficSources: [
        { source: "Suggested videos", views: 21400 },
        { source: "YouTube search", views: 12800 },
        { source: "Browse features", views: 8200 },
        { source: "External links", views: 3100 },
        { source: "Channel pages", views: 1900 },
      ],
      countries: [
        { country: "US", views: 19100 },
        { country: "IN", views: 6400 },
        { country: "GB", views: 4300 },
        { country: "DE", views: 3600 },
        { country: "BR", views: 2900 },
        { country: "MX", views: 2200 },
        { country: "JP", views: 1800 },
      ],
    };
    return NextResponse.json({ analytics, demo: true });
  }

  try {
    const { session, changed } = await requireSession(req);
    const mentions = extractTimestampMentions(comments, durationSeconds);
    const analytics = await fetchVideoAnalytics(
      session.accessToken,
      videoId,
      publishedAt,
      durationSeconds,
      mentions
    );
    const res = NextResponse.json({ analytics, demo: false });
    return changed ? setSessionCookie(res, session) : res;
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return NextResponse.json({ error: err.message, code: "not_connected" }, { status: 401 });
    }
    if (err instanceof AnalyticsScopeError) {
      return NextResponse.json({ error: err.message, code: "no_analytics_scope" }, { status: 403 });
    }
    if (err instanceof YouTubeApiError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("Analytics fetch failed:", err);
    return NextResponse.json({ error: "Analytics fetch failed." }, { status: 500 });
  }
}

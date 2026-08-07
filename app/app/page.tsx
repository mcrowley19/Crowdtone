"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Analysis, Comment, ThumbnailVariant, VideoMeta } from "@/lib/types";
import { buildMarkdownSummary } from "@/lib/markdown";
import { ThemeGrid } from "@/components/ThemeGrid";
import { BriefCard } from "@/components/BriefCard";
import { FixList } from "@/components/FixList";
import { ThumbnailLab } from "@/components/ThumbnailLab";
import { ActionDeck } from "@/components/ActionDeck";
import { ConnectBar, authErrorMessage, type Connection } from "@/components/ConnectBar";
import { NextVideoPanel } from "@/components/NextVideoPanel";
import { PatrolPanel } from "@/components/PatrolPanel";
import { AnalyticsCard } from "@/components/AnalyticsCard";
import { LocalizePanel } from "@/components/LocalizePanel";
import { ClipFinder } from "@/components/ClipFinder";
import { SentimentCard } from "@/components/SentimentCard";
import { SuperfanList } from "@/components/SuperfanList";
import { DigestCard } from "@/components/DigestCard";
import { PremierePanel } from "@/components/PremierePanel";
import { rankSuperfans } from "@/lib/superfans";
import { sentimentTimeline } from "@/lib/sentiment";
import type { VideoAnalytics } from "@/lib/analytics";
import { DEMO_DURATION_SECONDS, isDemoId } from "@/lib/demo";

type Stage = "idle" | "video" | "comments" | "analyzing" | "done";
type Mode = "video" | "channel" | "patrol" | "premiere";
type View = "signals" | "retention" | "plan" | "assets" | "people" | "publish";

interface Health {
  youtube: boolean;
  llm: string | null;
}

const MODES: { id: Mode; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "channel", label: "Next up" },
  { id: "patrol", label: "Patrol" },
  { id: "premiere", label: "Premiere" },
];

const STEPS: Partial<Record<Stage, { n: number; text: string }>> = {
  video: { n: 1, text: "Looking up the video" },
  comments: { n: 2, text: "Pulling comments" },
  analyzing: { n: 3, text: "Reading comments" },
};

const THEME_LABEL: Record<string, string> = {
  praise: "Praise",
  complaint: "Complaints",
  request: "Requests",
  confusion: "Confusion",
};

const fmt = new Intl.NumberFormat("en-US");

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("video");
  const [view, setView] = useState<View>("signals");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [offerDemo, setOfferDemo] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSource, setCommentSource] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [variants, setVariants] = useState<ThumbnailVariant[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const [analyticsNote, setAnalyticsNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => undefined);
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setConnection)
      .catch(() => undefined);
    // The OAuth callback lands back here with a query string; read it, then
    // strip it so a refresh doesn't replay the banner.
    const params = new URLSearchParams(window.location.search);
    setAuthError(params.get("auth_error"));
    if (params.has("auth_error") || params.has("connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Switching views swaps the whole panel stack — landing mid-scroll in the
  // new one reads as a jump cut. Explicitly instant: the page sets
  // scroll-behavior: smooth, and a smooth scroll gets clamped halfway when
  // the incoming view is shorter than the one it replaced.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [view]);

  const disconnect = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    setConnection((prev) => (prev ? { ...prev, connected: false, channelId: null, channelTitle: null } : prev));
  }, []);

  const busy = stage === "video" || stage === "comments" || stage === "analyzing";

  const analyze = useCallback(
    async (rawInput: string) => {
      if (busy) return;
      setError(null);
      setOfferDemo(false);
      setVideo(null);
      setComments([]);
      setCommentSource(null);
      setAnalysis(null);
      setVariants([]);
      setAnalytics(null);
      setAnalyticsNote(null);
      setView("signals");

      try {
        setStage("video");
        const vRes = await fetch(`/api/video?input=${encodeURIComponent(rawInput)}`);
        const vBody = await vRes.json();
        if (!vRes.ok) {
          setOfferDemo(vBody.code === "no_api_key" || vBody.code === "quota");
          throw new Error(vBody.error ?? "Failed to load video.");
        }
        const v: VideoMeta = vBody.video;
        setVideo(v);

        setStage("comments");
        const cRes = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: v.videoId }),
        });
        const cBody = await cRes.json();
        if (!cRes.ok) {
          setOfferDemo(cBody.code === "no_api_key" || cBody.code === "quota");
          throw new Error(cBody.error ?? "Failed to fetch comments.");
        }
        setComments(cBody.comments);
        setCommentSource(cBody.source);

        setStage("analyzing");
        const aRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoTitle: v.title, comments: cBody.comments }),
        });
        const aBody = await aRes.json();
        if (!aRes.ok) throw new Error(aBody.error ?? "Analysis failed.");
        setAnalysis(aBody.analysis);
        setStage("done");

        // Analytics are owner-only (or bundled, for the demo), so this fetch
        // is best-effort: the report stands on its own without it.
        if (isDemoId(v.videoId) || connection?.connected) {
          fetch("/api/analytics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoId: v.videoId,
              publishedAt: v.publishedAt,
              durationSeconds: v.durationSeconds ?? 0,
              comments: cBody.comments,
            }),
          })
            .then(async (r) => {
              const body = await r.json();
              if (r.ok && body.analytics) setAnalytics(body.analytics);
              else if (body.code === "no_analytics_scope") setAnalyticsNote(body.error);
            })
            .catch(() => undefined);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStage("idle");
      }
    },
    [busy, connection]
  );

  const generateThumbs = useCallback(async () => {
    if (!video || !analysis) return;
    setThumbsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/thumbnails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.videoId, texts: analysis.thumbnailTexts }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Thumbnail generation failed.");
      setVariants(body.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thumbnail generation failed.");
    } finally {
      setThumbsLoading(false);
    }
  }, [video, analysis]);

  const downloadJson = useCallback(() => {
    if (!video || !analysis) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      video,
      commentsAnalyzed: comments.length,
      analysis,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `crowdtone-${video.videoId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [video, analysis, comments]);

  const copyMarkdown = useCallback(async () => {
    if (!video || !analysis) return;
    await navigator.clipboard.writeText(buildMarkdownSummary(video, analysis, comments.length));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [video, analysis, comments]);

  const fans = useMemo(
    () =>
      video
        ? rankSuperfans([{ videoTitle: video.title, comments }], {
            ownerChannelId: video.channelId,
            ownerName: video.channelTitle,
          })
        : [],
    [video, comments]
  );

  const mood = useMemo(() => {
    if (comments.length === 0) return null;
    const { overall } = sentimentTimeline(comments);
    return overall.score > 0.12 ? "warm" : overall.score < -0.12 ? "rough" : "mixed";
  }, [comments]);

  const loudest = useMemo(() => {
    if (!analysis) return null;
    const themes = [...analysis.clusters.themes].sort((a, b) => b.count - a.count);
    return themes[0] ?? null;
  }, [analysis]);

  const dips = analytics?.retention?.dips.length ?? 0;
  const reportReady = Boolean(analysis && video);
  const duration = video
    ? isDemoId(video.videoId)
      ? DEMO_DURATION_SECONDS
      : (video.durationSeconds ?? 0)
    : 0;

  const views: { id: View; label: string; count?: number }[] = [
    { id: "signals", label: "Signals" },
    { id: "retention", label: "Retention", count: dips || undefined },
    { id: "plan", label: "Plan", count: analysis ? analysis.ideas.length + analysis.fixes.length : undefined },
    { id: "assets", label: "Assets" },
    { id: "people", label: "People", count: fans.length || undefined },
    { id: "publish", label: "Publish" },
  ];

  const step = STEPS[stage];

  const showView = (id: View) => setView(id);

  return (
    <div className="dash">
      <header className="dtop">
        <div className="dtop-in">
          <Link href="/" className="dmark">
            Crowd<span>tone</span>
          </Link>
          <nav className="dmodes" role="tablist">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={mode === m.id}
                className={mode === m.id ? "on" : ""}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </nav>
          <div className="dtop-right">
            {health && (
              <div className="dkeys">
                <span
                  className={`dkey${health.youtube ? " set" : ""}`}
                  title={health.youtube ? "YouTube API key set" : "No YouTube API key. The demo dataset still runs"}
                >
                  <i aria-hidden />
                  YT
                </span>
                <span
                  className={`dkey${health.llm ? " set" : ""}`}
                  title={health.llm ? `Language model: ${health.llm}` : "No LLM key. Clustering falls back to a keyword scan"}
                >
                  <i aria-hidden />
                  {health.llm ?? "LLM"}
                </span>
              </div>
            )}
            <ConnectBar connection={connection} onDisconnect={disconnect} />
          </div>
        </div>
      </header>

      <div className="dbody">
        {authError && <div className="dbanner">{authErrorMessage(authError)}</div>}

        {mode === "premiere" ? (
          <div className="dmode">
            <h1>
              Premiere <span>co-pilot</span>
            </h1>
            <PremierePanel />
          </div>
        ) : mode === "patrol" ? (
          <div className="dmode">
            <h1>
              Patrol the <span>comments</span>
            </h1>
            <PatrolPanel connected={Boolean(connection?.connected)} />
          </div>
        ) : mode === "channel" ? (
          <div className="dmode">
            <h1>
              Plan the <span>next one</span>
            </h1>
            <NextVideoPanel connected={Boolean(connection?.connected)} />
          </div>
        ) : !reportReady ? (
          <div className="dconsole">
            <h1>
              What did the
              <br />
              comments <span>say?</span>
            </h1>
            <form
              className="dsearch"
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) analyze(input);
              }}
            >
              <input
                aria-label="YouTube video address or ID"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="youtube.com/watch?v="
                spellCheck={false}
                disabled={busy}
              />
              <button type="submit" className="go" disabled={busy || !input.trim()}>
                {busy ? "Working" : "Analyze"}
              </button>
            </form>

            <div className="ddemo">
              <button className="textlink" onClick={() => analyze("DEMO")} disabled={busy}>
                Run the demo dataset
              </button>
            </div>

            {step && (
              <div className="dprog">
                <div className="dprog-bar">
                  <i style={{ width: `${(step.n / 3) * 100}%` }} />
                </div>
                <span>
                  {step.n}/3 · {step.text}
                </span>
              </div>
            )}

            {error && (
              <div className="errorline">
                {error}{" "}
                {offerDemo && (
                  <button className="textlink" onClick={() => analyze("DEMO")}>
                    Run the demo instead
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          video &&
          analysis && (
            <>
              <div className="dhead">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.thumbnailUrl} alt="" />
                <div className="dhead-t">
                  <h1>{video.title}</h1>
                  <div className="dmeta">
                    <span>{video.channelTitle}</span>
                    <span>{fmt.format(video.viewCount)} views</span>
                    <span>{fmt.format(comments.length)} comments read</span>
                    {commentSource === "cache" && <span>cached</span>}
                    {video.source === "demo" && <span className="hot">Demo data</span>}
                  </div>
                </div>
                <div className="dhead-acts">
                  <button onClick={copyMarkdown}>{copied ? "Copied" : "Markdown"}</button>
                  <button onClick={downloadJson}>JSON</button>
                  <button
                    onClick={() => {
                      setVideo(null);
                      setAnalysis(null);
                      setStage("idle");
                      setInput("");
                    }}
                  >
                    New
                  </button>
                </div>
              </div>

              <dl className="dstats">
                {loudest && (
                  <div className={loudest.name === "complaint" ? "hot" : ""}>
                    <dt>Loudest signal</dt>
                    <dd>
                      {THEME_LABEL[loudest.name] ?? loudest.name} <small>{loudest.count}</small>
                    </dd>
                  </div>
                )}
                {mood && (
                  <div className={mood === "rough" ? "hot" : ""}>
                    <dt>Room</dt>
                    <dd>{mood}</dd>
                  </div>
                )}
                <div>
                  <dt>Fixes queued</dt>
                  <dd>{analysis.fixes.length}</dd>
                </div>
                <div>
                  <dt>Next-video ideas</dt>
                  <dd>{analysis.ideas.length}</dd>
                </div>
                {analytics?.totals && (
                  <div>
                    <dt>Avg. watched</dt>
                    <dd>
                      {analytics.totals.averageViewPercentage
                        ? `${analytics.totals.averageViewPercentage.toFixed(0)}%`
                        : "n/a"}
                    </dd>
                  </div>
                )}
                {dips > 0 && (
                  <div className="hot">
                    <dt>Drop-offs</dt>
                    <dd>{dips}</dd>
                  </div>
                )}
              </dl>

              <div className="dgrid">
                <nav className="drail" role="tablist">
                  {views.map((v, i) => (
                    <button
                      key={v.id}
                      role="tab"
                      aria-selected={view === v.id}
                      className={view === v.id ? "on" : ""}
                      onClick={() => showView(v.id)}
                    >
                      <i>{String(i + 1).padStart(2, "0")}</i>
                      {v.label}
                      {v.count ? <b>{v.count}</b> : null}
                    </button>
                  ))}
                </nav>

                <div className="dview">
                  {view === "signals" && (
                    <>
                      <ThemeGrid clusters={analysis.clusters} source={analysis.source} />
                      <SentimentCard comments={comments} />
                    </>
                  )}

                  {view === "retention" &&
                    (analytics ? (
                      <AnalyticsCard
                        analytics={analytics}
                        demo={isDemoId(video.videoId)}
                        durationSeconds={duration}
                        onDraftReply={() => showView("publish")}
                      />
                    ) : (
                      <div className="dempty">
                        {analyticsNote ?? "Retention is owner-only. Connect this channel to read it."}
                      </div>
                    ))}

                  {view === "plan" && (
                    <>
                      <BriefCard ideas={analysis.ideas} />
                      <FixList fixes={analysis.fixes} />
                    </>
                  )}

                  {view === "assets" && (
                    <>
                      <ThumbnailLab
                        video={video}
                        topComplaint={analysis.topComplaint}
                        variants={variants}
                        loading={thumbsLoading}
                        onGenerate={generateThumbs}
                      />
                      <ClipFinder video={video} comments={comments} durationSeconds={duration} />
                      <LocalizePanel
                        video={video}
                        countries={analytics?.countries ?? []}
                        connected={Boolean(connection?.connected)}
                        isDemo={isDemoId(video.videoId)}
                      />
                    </>
                  )}

                  {view === "people" && (
                    <SuperfanList fans={fans} chip="Ranked by likes · questions · timestamps" />
                  )}

                  {view === "publish" && (
                    <>
                      <ActionDeck
                        video={video}
                        comments={comments}
                        analysis={analysis}
                        connected={Boolean(connection?.connected)}
                        isDemo={isDemoId(video.videoId)}
                      />
                      <DigestCard
                        video={video}
                        comments={comments}
                        analysis={analysis}
                        analytics={analytics}
                        fans={fans.slice(0, 5)}
                      />
                    </>
                  )}

                  {error && <div className="errorline">{error}</div>}
                </div>
              </div>
            </>
          )
        )}
      </div>

      <footer className="dfoot">
        <span>Public YouTube data only</span>
        <span>Comments cached briefly, never stored</span>
        <span>No viewer accounts read</span>
      </footer>
    </div>
  );
}

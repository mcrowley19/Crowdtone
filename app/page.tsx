"use client";

import { useCallback, useEffect, useState } from "react";
import type { Analysis, Comment, ThumbnailVariant, VideoMeta } from "@/lib/types";
import { buildMarkdownSummary } from "@/lib/markdown";
import { VideoCard } from "@/components/VideoCard";
import { ThemeGrid } from "@/components/ThemeGrid";
import { BriefCard } from "@/components/BriefCard";
import { FixList } from "@/components/FixList";
import { ThumbnailLab } from "@/components/ThumbnailLab";

type Stage = "idle" | "video" | "comments" | "analyzing" | "done";

interface Health {
  youtube: boolean;
  llm: string | null;
}

const STEPS: Array<{ key: Stage; label: string }> = [
  { key: "video", label: "Fetch video" },
  { key: "comments", label: "Pull comments" },
  { key: "analyzing", label: "Cluster & plan" },
  { key: "done", label: "Ready" },
];

export default function Home() {
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [offerDemo, setOfferDemo] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);

  const [video, setVideo] = useState<VideoMeta | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSource, setCommentSource] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [variants, setVariants] = useState<ThumbnailVariant[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => undefined);
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStage("idle");
      }
    },
    [busy]
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
    a.download = `audiencesignal-${video.videoId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [video, analysis, comments]);

  const copyMarkdown = useCallback(async () => {
    if (!video || !analysis) return;
    await navigator.clipboard.writeText(buildMarkdownSummary(video, analysis, comments.length));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [video, analysis, comments]);

  const stepState = (key: Stage): string => {
    const order: Stage[] = ["video", "comments", "analyzing", "done"];
    if (stage === "idle") return "";
    const cur = order.indexOf(stage);
    const mine = order.indexOf(key);
    if (stage === "done") return "done";
    if (mine < cur) return "done";
    if (mine === cur) return "active";
    return "";
  };

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-dot">▲</div>
          AudienceSignal
        </div>
        <div className="keychips">
          <span className={`chip ${health?.youtube ? "on" : ""}`}>
            YouTube API {health?.youtube ? "connected" : "not set"}
          </span>
          <span className={`chip ${health?.llm ? "on" : ""}`}>
            LLM {health?.llm ? `(${health.llm})` : "not set"}
          </span>
        </div>
      </div>

      <section className="hero">
        <h1>Comments in. Next video out.</h1>
        <p>
          Paste a public YouTube video. AudienceSignal pulls real comments, clusters what viewers
          are saying, and hands you a ranked next-video brief, concrete fixes, and thumbnail
          variants that answer the top complaint.
        </p>
        <form
          className="inputrow"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) analyze(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…  or a video ID"
            spellCheck={false}
            disabled={busy}
          />
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
            {busy ? "Working…" : "Analyze"}
          </button>
        </form>
        <button className="demolink" onClick={() => analyze("DEMO")} disabled={busy}>
          No API key? Run the built-in demo dataset →
        </button>

        {stage !== "idle" && (
          <div className="progress">
            {STEPS.map((s) => (
              <div className={`step ${stepState(s.key)}`} key={s.key}>
                <span className="dot" />
                {s.label}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="error">
            <span>{error}</span>
            {offerDemo && (
              <button className="btn small" onClick={() => analyze("DEMO")}>
                Try demo data
              </button>
            )}
          </div>
        )}
      </section>

      {video && (
        <VideoCard
          video={video}
          commentCount={comments.length > 0 ? comments.length : null}
          commentSource={commentSource}
        />
      )}

      {analysis && video && (
        <>
          <ThemeGrid clusters={analysis.clusters} source={analysis.source} />
          <BriefCard ideas={analysis.ideas} />
          <FixList fixes={analysis.fixes} />
          <ThumbnailLab
            video={video}
            topComplaint={analysis.topComplaint}
            variants={variants}
            loading={thumbsLoading}
            onGenerate={generateThumbs}
          />
          <div className="exportrow">
            <button className="btn small" onClick={downloadJson}>
              Download JSON
            </button>
            <button className="btn small" onClick={copyMarkdown}>
              {copied ? "Copied!" : "Copy markdown summary"}
            </button>
          </div>
        </>
      )}

      <div className="footer">
        AudienceSignal · YouTube Data API v3 · comments cached locally in <code>data/cache/</code>
      </div>
    </main>
  );
}

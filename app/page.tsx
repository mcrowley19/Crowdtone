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

const STATUS_TEXT: Partial<Record<Stage, string>> = {
  video: "Step 1 of 3 · Looking up the video",
  comments: "Step 2 of 3 · Pulling up to 200 comments",
  analyzing: "Step 3 of 3 · Reading comments, drafting the plan",
};

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

  return (
    <main className="sheet">
      <header className="masthead">
        <h1>
          Audience
          <br />
          <span>Signal</span>
        </h1>
        <div className="mastnote">
          {health ? (
            <>
              <div className={health.youtube ? "ok" : "off"}>
                YouTube key: {health.youtube ? "set" : "not set"}
              </div>
              <div className={health.llm ? "ok" : "off"}>
                LLM key: {health.llm ? health.llm : "not set"}
              </div>
              <div>Demo works without keys</div>
            </>
          ) : (
            <div>Checking keys</div>
          )}
        </div>
      </header>
      <div className="kicker">The comment section already wrote your next video</div>

      <p className="intro">
        Paste the address of any public YouTube video. AudienceSignal reads its comments and
        writes back a plan: what viewers praised, complained about, asked for, and found
        confusing, then three ideas for the next video, a fix list for this one, and redrawn
        thumbnails that answer the loudest complaint.
      </p>

      <form
        className="queryform"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) analyze(input);
        }}
      >
        <label htmlFor="video-input">Video address or ID</label>
        <div className="queryrow">
          <input
            id="video-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://www.youtube.com/watch?v="
            spellCheck={false}
            disabled={busy}
          />
          <button type="submit" className="go" disabled={busy || !input.trim()}>
            {busy ? "Working" : "Analyze"}
          </button>
        </div>
      </form>
      <button className="textlink" onClick={() => analyze("DEMO")} disabled={busy}>
        No keys yet? Run the report on the bundled demo dataset.
      </button>

      {busy && <p className="statusline">{STATUS_TEXT[stage]}</p>}

      {error && (
        <div className="errorline">
          {error}{" "}
          {offerDemo && (
            <button className="textlink" onClick={() => analyze("DEMO")}>
              Run the demo dataset instead.
            </button>
          )}
        </div>
      )}

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
          <div className="exports">
            <button onClick={downloadJson}>Save report as JSON</button>
            <button onClick={copyMarkdown}>
              {copied ? "Copied to clipboard" : "Copy report as markdown"}
            </button>
          </div>
        </>
      )}

      <footer className="colophon">
        <div className="inner">
          AudienceSignal reads public data through the YouTube Data API and briefly caches
          fetched comments to spare your quota. Comments are sent only to YouTube and the
          model provider configured on this deployment; nothing is stored permanently and
          no viewer accounts or private data are ever read.
        </div>
      </footer>
    </main>
  );
}

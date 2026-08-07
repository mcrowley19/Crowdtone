"use client";

import { useMemo, useState } from "react";
import { buildAudienceDigest } from "@/lib/digest";
import { sentimentTimeline } from "@/lib/sentiment";
import type { Superfan } from "@/lib/superfans";
import type { VideoAnalytics } from "@/lib/analytics";
import type { Analysis, Comment, VideoMeta } from "@/lib/types";
import { Panel } from "@/components/Panel";

/**
 * The "State of the Audience" email. Composed in code (lib/digest) from what
 * the report already computed — the button copies ready-to-send markdown for
 * any newsletter tool, or downloads it as a file.
 */
export function DigestCard({
  video,
  comments,
  analysis,
  analytics,
  fans,
}: {
  video: VideoMeta;
  comments: Comment[];
  analysis: Analysis;
  analytics: VideoAnalytics | null;
  fans: Superfan[];
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const digest = useMemo(
    () =>
      buildAudienceDigest({
        channelTitle: video.channelTitle,
        videoTitle: video.title,
        commentsAnalyzed: comments.length,
        analysis,
        sentiment: sentimentTimeline(comments),
        dips: analytics?.retention?.dips.map((d) => ({
          timestamp: d.timestamp,
          dropPercent: d.dropPercent,
          quote: d.mentions?.quote,
        })),
        superfans: fans,
        generatedAt: new Date().toISOString(),
      }),
    [video, comments, analysis, analytics, fans]
  );

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${digest.subject}\n\n${digest.markdown}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const blob = new Blob([digest.markdown], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "state-of-the-audience.md";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Panel title="State of the Audience" chip="Composed in code · nothing sent from here">
      <p className="lede">
        Subject: <b>{digest.subject}</b>
      </p>
      <div className="thumbactions">
        <button className="go" onClick={copy}>
          {copied ? "Copied" : "Copy the email"}
        </button>
        <button onClick={download}>Markdown</button>
        <button className="textlink" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide preview" : "Preview"}
        </button>
      </div>
      {open && <pre className="planpre digestpre">{digest.markdown}</pre>}
    </Panel>
  );
}

"use client";

import { useMemo, useState } from "react";
import { suggestClips, TONE_LABEL } from "@/lib/clips";
import type { Comment, VideoMeta } from "@/lib/types";

/**
 * Shorts worth cutting, straight from the timestamps viewers left. Pure
 * client-side logic over comments already in memory — no extra API cost.
 */
export function ClipFinder({
  video,
  comments,
  durationSeconds,
}: {
  video: VideoMeta;
  comments: Comment[];
  durationSeconds: number;
}) {
  const [copied, setCopied] = useState<number | null>(null);
  const clips = useMemo(
    () => suggestClips(comments, video.videoId, durationSeconds),
    [comments, video, durationSeconds]
  );

  if (clips.length === 0) return null;

  const copy = async (i: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 1600);
  };

  return (
    <section className="report">
      <h2>Cut these into Shorts</h2>
      <p className="deck">
        The moments viewers timestamped — the free, ground-truth highlight reel
      </p>
      <div className="clipgrid">
        {clips.map((c, i) => (
          <div className="cliprow" key={c.startSeconds}>
            <div className="cliprange">{c.range}</div>
            <div className="clipbody">
              <b>{TONE_LABEL[c.tone]}</b> — {c.mentions} comment
              {c.mentions === 1 ? " points" : "s point"} here.
              <div className="devidence">{c.quote}&rdquo;</div>
              <div className="clipactions">
                <a href={c.watchUrl} target="_blank" rel="noreferrer" className="textlink">
                  Watch from {c.range.split("–")[0]}
                </a>
                <button
                  className="textlink"
                  onClick={() => copy(i, `${c.range} — ${TONE_LABEL[c.tone]}: "${c.quote}"`)}
                >
                  {copied === i ? "Copied" : "Copy the cut notes"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="drationale" style={{ margin: "10px 0 0" }}>
        Cut them in your editor or YouTube&rsquo;s own clip tool — the Data API can&rsquo;t upload
        Shorts on your behalf, so this stops honestly at the cut list.
      </p>
    </section>
  );
}

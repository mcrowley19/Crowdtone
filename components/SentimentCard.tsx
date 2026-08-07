"use client";

import { useMemo, useState } from "react";
import { sentimentTimeline, type SentimentBucket } from "@/lib/sentiment";
import type { Comment } from "@/lib/types";
import { Panel } from "@/components/Panel";

const W = 800;
const H = 220;
const PAD = { top: 18, right: 12, bottom: 26, left: 44 };

/**
 * How the room feels, over the life of the thread. Scored by the lexicon in
 * lib/sentiment — deterministic, no model — and drawn as bars diverging from
 * zero: above the line the audience is with you, below it they're not.
 * Position carries the meaning; color only repeats it.
 */
export function SentimentCard({ comments }: { comments: Comment[] }) {
  const timeline = useMemo(() => sentimentTimeline(comments), [comments]);
  const [hover, setHover] = useState<number | null>(null);

  if (timeline.buckets.length < 2) return null;

  const { buckets, overall } = timeline;
  const y = (score: number) => {
    const mid = PAD.top + (H - PAD.top - PAD.bottom) / 2;
    return mid - score * ((H - PAD.top - PAD.bottom) / 2);
  };
  const plotW = W - PAD.left - PAD.right;
  const step = plotW / buckets.length;
  const barW = Math.min(48, step * 0.6);

  const hovered: SentimentBucket | null = hover === null ? null : buckets[hover];

  return (
    <Panel
      title="How the room feels"
      chip={timeline.datedBuckets ? "Lexicon · no model · by date" : "Lexicon · no model · thread order"}
    >
      <div className="statrow">
        <div>
          <span>Positive</span>
          <b>{overall.positive}</b>
        </div>
        <div>
          <span>Neutral</span>
          <b>{overall.neutral}</b>
        </div>
        <div>
          <span>Negative</span>
          <b>{overall.negative}</b>
        </div>
      </div>

      <svg
        className="retention sentchart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Comment sentiment over time, diverging from neutral"
        onMouseLeave={() => setHover(null)}
      >
        {[1, 0.5, -0.5, -1].map((v) => (
          <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="grid" />
        ))}
        <text x={PAD.left - 6} y={y(1) + 4} className="axis" textAnchor="end">
          praise
        </text>
        <text x={PAD.left - 6} y={y(-1) + 4} className="axis" textAnchor="end">
          gripes
        </text>
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="zeroline" />
        {buckets.map((b, i) => {
          const cx = PAD.left + step * i + step / 2;
          const top = Math.min(y(0), y(b.score));
          const height = Math.max(2, Math.abs(y(b.score) - y(0)));
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {/* oversized hit target so the tooltip isn't a pixel hunt */}
              <rect x={cx - step / 2} y={PAD.top} width={step} height={H - PAD.top - PAD.bottom} fill="transparent" />
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={height}
                rx={3}
                className={b.score >= 0 ? "sentbar pos" : "sentbar neg"}
              />
              <text x={cx} y={H - PAD.bottom + 16} className="axis" textAnchor="middle">
                {b.label}
              </text>
            </g>
          );
        })}
        {hovered && hover !== null && (
          <text
            x={PAD.left + step * hover + step / 2}
            y={PAD.top - 4}
            className="hoverlabel"
            textAnchor={hover > buckets.length * 0.7 ? "end" : hover < buckets.length * 0.3 ? "start" : "middle"}
          >
            {hovered.count} comment{hovered.count === 1 ? "" : "s"} · {hovered.positive} up ·{" "}
            {hovered.negative} down
          </text>
        )}
      </svg>

      {hovered?.quote && <div className="devidence">{hovered.quote}&rdquo;</div>}
    </Panel>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import type { VideoAnalytics } from "@/lib/analytics";
import { formatTimestamp } from "@/lib/chapters";

const fmt = new Intl.NumberFormat("en-US");

const W = 720;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 40 };

/**
 * Audience retention drawn against the moments viewers complained about.
 * One series, so the curve needs no legend; the dips carry the story and
 * each is labeled with the comment evidence when there is any.
 */
export function AnalyticsCard({
  analytics,
  demo,
  durationSeconds,
}: {
  analytics: VideoAnalytics;
  demo: boolean;
  durationSeconds: number;
}) {
  const { retention, totals, trafficSources, countries } = analytics;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ x: number; ratio: number; watch: number } | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (ratio: number) => PAD.left + ratio * plotW;
  const y = (watch: number) => PAD.top + (1 - Math.min(1, watch)) * plotH;

  const curve = retention?.curve ?? [];
  const linePath = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.ratio).toFixed(1)},${y(p.watchRatio).toFixed(1)}`).join(" ");
  const areaPath = curve.length
    ? `${linePath} L${x(curve[curve.length - 1].ratio).toFixed(1)},${y(0)} L${x(curve[0].ratio).toFixed(1)},${y(0)} Z`
    : "";

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || curve.length === 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, ((e.clientX - rect.left) / rect.width) * (W / plotW) - PAD.left / plotW));
      const nearest = curve.reduce((a, b) => (Math.abs(b.ratio - ratio) < Math.abs(a.ratio - ratio) ? b : a));
      setHover({ x: x(nearest.ratio), ratio: nearest.ratio, watch: nearest.watchRatio });
    },
    [curve, plotW]
  );

  return (
    <section className="report">
      <h2>The numbers behind it</h2>
      <p className="deck">
        {demo
          ? "Demo analytics — a bundled retention curve, run through the real dip detector"
          : "From the YouTube Analytics API — only the channel's owner can see these"}
      </p>

      {totals && (
        <div className="statrow">
          <div>
            <span>Views</span>
            <b>{fmt.format(totals.views)}</b>
          </div>
          <div>
            <span>Avg. watched</span>
            <b>
              {formatTimestamp(Math.round(totals.averageViewDuration))}
              {totals.averageViewPercentage ? ` · ${totals.averageViewPercentage.toFixed(0)}%` : ""}
            </b>
          </div>
          <div>
            <span>Watch hours</span>
            <b>{fmt.format(Math.round(totals.estimatedMinutesWatched / 60))}</b>
          </div>
          <div>
            <span>Subs gained</span>
            <b>+{fmt.format(totals.subscribersGained)}</b>
          </div>
        </div>
      )}

      {retention && curve.length > 0 && (
        <div className="planblock">
          <h3>Where the audience leaves</h3>
          <svg
            ref={svgRef}
            className="retention"
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Audience retention curve with drop-off points marked"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="grid" />
                <text x={PAD.left - 6} y={y(v) + 4} className="axis" textAnchor="end">
                  {Math.round(v * 100)}%
                </text>
              </g>
            ))}
            <path d={areaPath} className="area" />
            <path d={linePath} className="line" />
            {retention.dips.map((d) => (
              <g key={d.seconds}>
                <line
                  x1={x(d.seconds / Math.max(1, durationSeconds))}
                  x2={x(d.seconds / Math.max(1, durationSeconds))}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  className="dipline"
                />
                <text
                  x={x(d.seconds / Math.max(1, durationSeconds))}
                  y={H - PAD.bottom + 16}
                  className="diplabel"
                  textAnchor="middle"
                >
                  {d.timestamp}
                </text>
              </g>
            ))}
            {hover && (
              <g>
                <line x1={hover.x} x2={hover.x} y1={PAD.top} y2={H - PAD.bottom} className="crosshair" />
                <text
                  x={hover.x}
                  y={PAD.top + 2}
                  className="hoverlabel"
                  textAnchor={hover.ratio > 0.85 ? "end" : hover.ratio < 0.15 ? "start" : "middle"}
                >
                  {formatTimestamp(Math.round(hover.ratio * durationSeconds))} ·{" "}
                  {Math.round(hover.watch * 100)}% watching
                </text>
              </g>
            )}
          </svg>

          {retention.dips.length > 0 ? (
            <ul className="diplist">
              {retention.dips.map((d) => (
                <li key={d.seconds}>
                  <b>
                    {d.timestamp} — {d.dropPercent}% of the audience leaves.
                  </b>{" "}
                  {d.mentions ? (
                    <>
                      {d.mentions.count} comment{d.mentions.count === 1 ? " points" : "s point"} at
                      this moment: &ldquo;{d.mentions.quote}&rdquo;
                    </>
                  ) : (
                    "No comment mentions this moment — rewatch it to see what happened."
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="lede">No sharp drop-offs — the audience leaves gradually, not at a moment.</p>
          )}
          {retention.atHalfway !== null && (
            <p className="drationale" style={{ margin: "8px 0 0" }}>
              {retention.atHalfway}% of the starting audience is still watching at the halfway mark.
            </p>
          )}
        </div>
      )}

      {(trafficSources.length > 0 || countries.length > 0) && (
        <div className="srcgrid">
          {trafficSources.length > 0 && (
            <div className="planblock">
              <h3>Where views come from</h3>
              <ul className="barlist">
                {trafficSources.map((t) => {
                  const max = trafficSources[0].views || 1;
                  return (
                    <li key={t.source}>
                      <span className="blabel">{t.source}</span>
                      <span className="bbar">
                        <i style={{ width: `${Math.max(2, (t.views / max) * 100)}%` }} />
                      </span>
                      <span className="bval">{fmt.format(t.views)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {countries.length > 0 && (
            <div className="planblock">
              <h3>Where the audience is</h3>
              <ul className="barlist">
                {countries.slice(0, 7).map((c) => {
                  const max = countries[0].views || 1;
                  return (
                    <li key={c.country}>
                      <span className="blabel">{c.country}</span>
                      <span className="bbar">
                        <i style={{ width: `${Math.max(2, (c.views / max) * 100)}%` }} />
                      </span>
                      <span className="bval">{fmt.format(c.views)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

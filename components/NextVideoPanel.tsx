"use client";

import { useCallback, useState } from "react";
import { SuperfanList } from "@/components/SuperfanList";
import type { ChannelInfo, ChannelStats } from "@/lib/channel";
import type { NextVideoPlan } from "@/lib/plan";
import type { Superfan } from "@/lib/superfans";

const fmt = new Intl.NumberFormat("en-US");

interface PlanResponse {
  channel: ChannelInfo;
  stats: ChannelStats;
  plan: NextVideoPlan;
  superfans?: Superfan[];
  videosRead: { videoId: string; title: string; comments: number }[];
  demo?: boolean;
}

export function NextVideoPanel({ connected }: { connected: boolean }) {
  const [input, setInput] = useState("");
  const [data, setData] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = useCallback(
    async (channelInput: string) => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: channelInput }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not build the plan.");
        setData(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build the plan.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const copy = useCallback(async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  }, []);

  const plan = data?.plan;

  return (
    <>
      <p className="intro">
        This one looks at the whole channel, not one video: the last 20 uploads, how each actually
        performed against the channel's own normal, and what the comment sections keep asking for.
        Out the other end comes one video, specified well enough to film.
      </p>

      <form
        className="queryform"
        onSubmit={(e) => {
          e.preventDefault();
          run(input.trim());
        }}
      >
        <label htmlFor="channel-input">
          {connected ? "Your channel — or paste another one" : "Channel address, @handle, or channel ID"}
        </label>
        <div className="queryrow">
          <input
            id="channel-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={connected ? "leave blank for your own channel" : "https://www.youtube.com/@"}
            spellCheck={false}
            disabled={loading}
          />
          <button type="submit" className="go" disabled={loading || (!connected && !input.trim())}>
            {loading ? "Working" : "Plan it"}
          </button>
        </div>
      </form>
      <button className="textlink" onClick={() => run("DEMO")} disabled={loading}>
        No keys yet? Plan the bundled demo channel.
      </button>

      {loading && <p className="statusline">Reading the channel, its numbers, and its comment sections</p>}
      {error && <div className="errorline">{error}</div>}

      {data && plan && (
        <>
          <div className="videohead">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.channel.thumbnailUrl && <img src={data.channel.thumbnailUrl} alt="" />}
            <div>
              <div className="vtitle">
                {data.channel.title}
                {data.demo && <span className="stamp">Demo data</span>}
              </div>
              <div className="byline">
                {fmt.format(data.channel.subscriberCount)} subscribers &middot;{" "}
                {fmt.format(data.channel.videoCount)} videos &middot; last {data.stats.videos.length}{" "}
                uploads read
              </div>
              <div className="byline">
                {plan.evidence.commentsAnalyzed} comments across {plan.evidence.videosAnalyzed} videos
                &middot; {plan.source === "llm" ? `drafted by ${plan.model ?? "the model"}` : "keyword heuristic"}
              </div>
            </div>
          </div>

          <section className="report">
            <h2>Make this next</h2>
            <p className="deck">
              Confidence: {plan.confidence} &middot; publish by {plan.publishBy}
              {plan.targetLengthMinutes ? ` · aim for ~${plan.targetLengthMinutes} min` : ""}
            </p>

            <div className="plantitle">
              {plan.title}
              <button className="textlink" onClick={() => copy("title", plan.title)}>
                {copied === "title" ? "Copied" : "Copy"}
              </button>
            </div>
            {plan.angle && <p className="lede">{plan.angle}</p>}

            {plan.alternativeTitles.length > 0 && (
              <div className="planalts">
                <span>Other titles</span>
                <ul>
                  {plan.alternativeTitles.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.hook && (
              <div className="planblock">
                <h3>Open with this</h3>
                <p className="hookline">&ldquo;{plan.hook}&rdquo;</p>
              </div>
            )}

            {plan.outline.length > 0 && (
              <div className="planblock">
                <h3>Outline</h3>
                <ol className="beats">
                  {plan.outline.map((b, i) => (
                    <li key={i}>
                      <b>{b.beat}</b>
                      <span>{b.detail}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {plan.description && (
              <div className="planblock">
                <h3>
                  Description
                  <button className="textlink" onClick={() => copy("description", plan.description)}>
                    {copied === "description" ? "Copied" : "Copy"}
                  </button>
                </h3>
                <pre className="planpre">{plan.description}</pre>
              </div>
            )}

            <div className="planmeta">
              {plan.thumbnailText && (
                <div>
                  <span>Thumbnail text</span>
                  <b>{plan.thumbnailText}</b>
                </div>
              )}
              {plan.tags.length > 0 && (
                <div>
                  <span>Tags</span>
                  <b>{plan.tags.join(", ")}</b>
                </div>
              )}
            </div>

            {plan.avoid.length > 0 && (
              <div className="planblock">
                <h3>Don&rsquo;t repeat</h3>
                <ul className="quotelist plain">
                  {plan.avoid.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="report">
            <h2>Why this one</h2>
            <p className="deck">The numbers and the quotes the plan was built from</p>
            <ul className="notelist">
              {plan.evidence.performanceNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            {plan.evidence.demandQuotes.length > 0 && (
              <div className="planblock">
                <h3>What they asked for</h3>
                <ul className="quotelist">
                  {plan.evidence.demandQuotes.map((q, i) => (
                    <li key={i}>
                      {q.quote}&rdquo;
                      <span className="qsrc">
                        {q.likeCount} likes &middot; on &ldquo;{q.videoTitle}&rdquo;
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <SuperfanList
            fans={data.superfans ?? []}
            deck="The viewers who keep showing up across the comment sections read for this plan"
          />

          <section className="report">
            <h2>The channel, by the numbers</h2>
            <p className="deck">Views per day against this channel&rsquo;s own median, newest first</p>
            <table className="perftable">
              <thead>
                <tr>
                  <th>Video</th>
                  <th>Views</th>
                  <th>Views/day</th>
                  <th>vs normal</th>
                </tr>
              </thead>
              <tbody>
                {data.stats.videos.slice(0, 12).map((p) => (
                  <tr key={p.video.videoId}>
                    <td>
                      {p.video.title}
                      {p.isShort && <span className="tag">short</span>}
                    </td>
                    <td>{fmt.format(p.video.viewCount)}</td>
                    <td>{fmt.format(p.viewsPerDay)}</td>
                    <td className={p.outlierScore >= 1.2 ? "up" : p.outlierScore <= 0.7 ? "down" : ""}>
                      {p.outlierScore ? `${p.outlierScore}×` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}

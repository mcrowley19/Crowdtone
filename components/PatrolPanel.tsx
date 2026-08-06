"use client";

import { useCallback, useState } from "react";
import type { FlaggedComment, ModerationResult, PatrolReport } from "@/lib/moderation";
import { REASON_LABEL } from "@/lib/moderation";

interface ScanResponse {
  channelTitle: string;
  demo: boolean;
  report: PatrolReport;
}

export function PatrolPanel({ connected }: { connected: boolean }) {
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ModerationResult>>({});
  const [restored, setRestored] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  // Hiding comments takes two deliberate clicks, same as publishing changes.
  const [armed, setArmed] = useState(false);
  const [showCleared, setShowCleared] = useState(false);

  const scan = useCallback(async (demo: boolean) => {
    setLoading(true);
    setError(null);
    setData(null);
    setResults({});
    setRestored({});
    setArmed(false);
    try {
      const res = await fetch("/api/patrol/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Patrol scan failed.");
      setData(body);
      // Scams start ticked; plain spam starts unticked — the creator decides.
      setSelected(
        new Set(
          body.report.flagged
            .filter((f: FlaggedComment) => f.verdict === "scam")
            .map((f: FlaggedComment) => f.comment.id)
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Patrol scan failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const moderate = useCallback(
    async (confirm: boolean) => {
      if (!data) return;
      const ids = data.report.flagged.map((f) => f.comment.id).filter((id) => selected.has(id));
      if (ids.length === 0) return;
      setApplying(true);
      setError(null);
      try {
        const res = await fetch("/api/patrol/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentIds: ids, status: "rejected", confirm, demo: data.demo }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Moderation failed.");
        const next: Record<string, ModerationResult> = {};
        for (const r of body.results as ModerationResult[]) next[r.commentId] = r;
        setResults(next);
        setArmed(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Moderation failed.");
      } finally {
        setApplying(false);
      }
    },
    [data, selected]
  );

  const restore = useCallback(async (commentId: string) => {
    // Simulated hides get simulated restores — pure state, no network.
    if (results[commentId]?.status === "simulated") {
      setRestored((prev) => ({
        ...prev,
        [commentId]: "Simulated restore — the demo comment is back; YouTube was never touched.",
      }));
      return;
    }
    try {
      const res = await fetch("/api/patrol/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds: [commentId], status: "published", confirm: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Restore failed.");
      const r = (body.results as ModerationResult[])[0];
      if (r?.status !== "applied") throw new Error(r?.message ?? "Restore failed.");
      setRestored((prev) => ({ ...prev, [commentId]: r.message }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed.");
    }
  }, [results]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setArmed(false);
      return next;
    });

  const flagged = data?.report.flagged ?? [];
  const cleared = data?.report.cleared ?? [];
  const chosenCount = flagged.filter((f) => selected.has(f.comment.id)).length;
  const applied = Object.values(results).some((r) => r.status === "applied");

  return (
    <>
      <p className="intro">
        The comments you&rsquo;d delete if you had time to read them all. Patrol reads the comment
        sections of your recent uploads and flags the impersonators wearing your channel&rsquo;s name,
        the &ldquo;message me on WhatsApp&rdquo; lures, the crypto bait, and the paste-bots — then hides
        the ones you tick, in bulk, through YouTube&rsquo;s own moderation endpoint. Every hidden
        comment can be put back.
      </p>

      <div className="thumbactions">
        <button className="go" onClick={() => scan(false)} disabled={loading || !connected}>
          {loading ? "Scanning…" : "Patrol my channel"}
        </button>
        <button className="textlink" onClick={() => scan(true)} disabled={loading}>
          No channel connected? Run the patrol on the bundled demo channel.
        </button>
      </div>
      {!connected && (
        <p className="statusline">
          Connect your channel above to patrol your own comments — the demo below shows the full
          sweep on a fictional channel with seeded scams.
        </p>
      )}

      {loading && <p className="statusline">Reading recent uploads and their comment sections</p>}
      {error && <div className="errorline">{error}</div>}

      {data && (
        <>
          <section className="report">
            <h2>Patrol report</h2>
            <p className="deck">
              {data.report.commentsScanned} comments across {data.report.videosScanned} videos on{" "}
              {data.channelTitle} &middot; {flagged.length} flagged &middot;{" "}
              {data.report.verdictSource === "llm"
                ? "verdicts checked by the model"
                : "pattern-matched verdicts"}
            </p>

            {flagged.length === 0 && (
              <p className="lede">Nothing worth hiding — this comment section is clean.</p>
            )}

            {flagged.length > 0 && (
              <>
                <div className="deckgrid">
                  {flagged.map((f) => {
                    const result = results[f.comment.id];
                    return (
                      <div
                        className={`deckrow${selected.has(f.comment.id) ? " picked" : ""}`}
                        key={f.comment.id}
                      >
                        <label className="deckhead">
                          <input
                            type="checkbox"
                            checked={selected.has(f.comment.id)}
                            onChange={() => toggle(f.comment.id)}
                            disabled={applying || result?.status === "applied"}
                          />
                          <span className={`kind${f.verdict === "scam" ? " scam" : ""}`}>
                            {f.verdict === "scam" ? "Scam" : "Spam"}
                          </span>
                          <span className="dlabel">
                            {f.comment.author} &middot; on &ldquo;{f.videoTitle}&rdquo;
                          </span>
                        </label>
                        <div className="diff before">
                          <span>The comment</span>
                          <p>{f.comment.text}</p>
                        </div>
                        <p className="drationale">{f.explanation}</p>
                        <div className="reasonrow">
                          {f.reasons.map((r) => (
                            <span className="tag" key={r}>
                              {REASON_LABEL[r]}
                            </span>
                          ))}
                        </div>
                        {result && (
                          <div className={`dresult ${result.status}`}>
                            <b>
                              {result.status === "applied"
                                ? "Hidden"
                                : result.status === "simulated"
                                  ? "Simulated"
                                  : result.status === "dry_run"
                                    ? "Preview"
                                    : "Failed"}
                            </b>{" "}
                            {restored[f.comment.id] ?? result.message}
                            {(result.status === "applied" || result.status === "simulated") &&
                              !restored[f.comment.id] && (
                                <button className="textlink" onClick={() => restore(f.comment.id)}>
                                  {result.status === "simulated"
                                    ? "Put it back (simulated)"
                                    : "Put it back"}
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="deckfoot">
                  <button onClick={() => moderate(false)} disabled={applying || chosenCount === 0}>
                    {applying && !armed
                      ? "Checking…"
                      : `Preview hiding ${chosenCount} comment${chosenCount === 1 ? "" : "s"}`}
                  </button>
                  {data.demo ? (
                    armed ? (
                      <button className="go danger" onClick={() => moderate(true)} disabled={applying}>
                        {applying ? "Simulating…" : `Yes — simulate hiding ${chosenCount}`}
                      </button>
                    ) : (
                      <button className="go" onClick={() => setArmed(true)} disabled={chosenCount === 0}>
                        Simulated hide (demo) — {chosenCount} comment{chosenCount === 1 ? "" : "s"}
                      </button>
                    )
                  ) : armed ? (
                    <button className="go danger" onClick={() => moderate(true)} disabled={applying}>
                      {applying ? "Hiding…" : `Yes — hide ${chosenCount} from YouTube now`}
                    </button>
                  ) : (
                    <button className="go" onClick={() => setArmed(true)} disabled={chosenCount === 0}>
                      Hide {chosenCount} comment{chosenCount === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
                {armed && (
                  <p className="deckarmed">
                    {data.demo ? (
                      <>
                        These are the bundled demo comments, so the hide is <b>simulated</b> —
                        nothing is sent to YouTube.
                      </>
                    ) : (
                      <>
                        This sets each ticked comment to <b>rejected</b> on YouTube — viewers stop
                        seeing it immediately. Every one gets a &ldquo;put it back&rdquo; button
                        afterwards.
                      </>
                    )}
                  </p>
                )}
                {applied && (
                  <p className="deckarmed">
                    Hidden comments are rejected, not deleted — restoring one republishes it exactly
                    as it was.
                  </p>
                )}
              </>
            )}

            {cleared.length > 0 && (
              <div className="clearedlog">
                <button className="textlink" onClick={() => setShowCleared((v) => !v)}>
                  {showCleared ? "Hide" : "Show"} the false-positive diary — {cleared.length} flagged
                  comment{cleared.length === 1 ? "" : "s"} the model cleared
                </button>
                {showCleared && (
                  <ul className="quotelist plain">
                    {cleared.map((c) => (
                      <li key={c.comment.id}>
                        <b>{c.comment.author}</b> — &ldquo;{c.comment.text.slice(0, 140)}&rdquo;
                        <span className="qsrc">
                          Pattern-matched as {c.reasons.map((r) => REASON_LABEL[r].toLowerCase()).join(", ")};
                          cleared because: {c.explanation}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="drationale" style={{ margin: "6px 0 0" }}>
                  Every heuristic hit the model overturns is logged here with its reason — bulk hide
                  is a decision you can audit, not a black box.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

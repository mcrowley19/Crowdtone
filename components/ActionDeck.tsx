"use client";

import { useCallback, useState } from "react";
import type { ActionResult, Analysis, Comment, ProposedAction, VideoMeta } from "@/lib/types";

const KIND_LABEL: Record<ProposedAction["kind"], string> = {
  retitle: "Title",
  update_description: "Description",
  add_chapters: "Chapters",
  set_thumbnail: "Thumbnail",
  post_comment: "New comment",
  reply_to_comment: "Reply",
  set_localizations: "Localizations",
};

export function ActionDeck({
  video,
  comments,
  analysis,
  connected,
  isDemo,
}: {
  video: VideoMeta;
  comments: Comment[];
  analysis: Analysis;
  connected: boolean;
  isDemo: boolean;
}) {
  const [actions, setActions] = useState<ProposedAction[] | null>(null);
  const [voice, setVoice] = useState<{ sampleSize: number; summary: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<ActionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  // Publishing takes two deliberate clicks: the first arms, the second sends.
  const [armed, setArmed] = useState(false);
  // One idempotency key per armed publish: if the confirm fires twice, the
  // server refuses the second with a 409 instead of double-posting.
  const [requestId, setRequestId] = useState("");
  const arm = () => {
    setRequestId(
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    );
    setArmed(true);
  };
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState<Record<string, string>>({});

  const draft = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setArmed(false);
    try {
      const res = await fetch("/api/actions/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video, comments, analysis }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not draft the changes.");
      setActions(body.actions);
      setVoice(body.voice ?? null);
      setSelected(new Set(body.actions.map((a: ProposedAction) => a.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft the changes.");
    } finally {
      setLoading(false);
    }
  }, [video, comments, analysis]);

  const send = useCallback(
    async (confirm: boolean) => {
      if (!actions) return;
      const chosen = actions.filter((a) => selected.has(a.id));
      if (chosen.length === 0) return;
      setApplying(true);
      setError(null);
      try {
        const res = await fetch("/api/actions/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoId: video.videoId,
            actions: chosen,
            confirm,
            ...(confirm && requestId ? { requestId } : {}),
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Apply failed.");
        setResults(body.results);
        setArmed(false);
        if (body.simulated) {
          try {
            for (const r of body.results as ActionResult[]) {
              localStorage.setItem(`as_demo_publish_${r.id}`, new Date().toISOString());
            }
          } catch {}
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Apply failed.");
      } finally {
        setApplying(false);
      }
    },
    [actions, selected, video, requestId]
  );

  const undo = useCallback(async (result: ActionResult) => {
    // A simulated publish gets a simulated undo: pure state, no network —
    // the demo mirrors the real loop without ever touching YouTube.
    if (result.status === "simulated") {
      setUndone((prev) => ({
        ...prev,
        [result.id]: "Simulated undo. The demo publish is reverted; YouTube was never touched.",
      }));
      try {
        localStorage.removeItem(`as_demo_publish_${result.id}`);
      } catch {}
      return;
    }
    if (!result.undo) return;
    try {
      const res = await fetch("/api/actions/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: result.undo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Undo failed.");
      setUndone((prev) => ({ ...prev, [result.id]: body.message }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed.");
    }
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setArmed(false);
      return next;
    });

  const chosenCount = actions ? actions.filter((a) => selected.has(a.id)).length : 0;
  const resultById = new Map(results.map((r) => [r.id, r]));
  const postedComment = results.some((r) => r.status === "applied" && r.kind === "post_comment");

  return (
    <section className="report" id="do-it">
      <div className="panelhead">
        <h2>Do it</h2>
        <span className="prov">Findings, written as publishable changes</span>
        {!actions && (
          <span className="panelacts">
            <button className="go" onClick={draft} disabled={loading}>
              {loading ? "Drafting…" : "Draft the changes"}
            </button>
          </span>
        )}
      </div>

      {!actions && (
        <p className="lede">
          Title, chapters mined from viewer timestamps, a pinned comment, replies to the questions
          people asked, and a new thumbnail. Apply whichever you tick.
        </p>
      )}

      {error && <div className="errorline">{error}</div>}

      {actions && actions.length === 0 && (
        <p className="lede">Nothing worth changing on this video. The comments aren't asking for it.</p>
      )}

      {actions && actions.length > 0 && (
        <>
          <p className="drationale">
            {voice ? (
              <>
                <b>Replies drafted in your voice</b>, learned from {voice.sampleSize} of the
                creator&rsquo;s own replies, then enforced in code: emoji habits, typical length,
                and sign-offs are measured, not guessed. ({voice.summary})
              </>
            ) : (
              <>
                No past replies from this creator in the fetched comments, so replies are drafted
                in a neutral voice. Connect and reply once, and future drafts learn your style.
              </>
            )}
          </p>
          <div className="deckgrid">
            {actions.map((a) => {
              const result = resultById.get(a.id);
              return (
                <div className={`deckrow${selected.has(a.id) ? " picked" : ""}`} key={a.id}>
                  <label className="deckhead">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      disabled={applying || Boolean(result?.status === "applied")}
                    />
                    <span className="kind">{KIND_LABEL[a.kind]}</span>
                    <span className="dlabel">{a.label}</span>
                  </label>
                  <p className="drationale">{a.rationale}</p>
                  {a.before && (
                    <div className="diff before">
                      <span>Now</span>
                      <p>{a.before}</p>
                    </div>
                  )}
                  <div className="diff after">
                    <span>After</span>
                    <p>{a.after}</p>
                  </div>
                  {a.evidence && <div className="devidence">{a.evidence}&rdquo;</div>}
                  {result && (
                    <div className={`dresult ${result.status}`}>
                      <b>
                        {result.status === "applied"
                          ? "Published"
                          : result.status === "simulated"
                            ? "Simulated"
                            : result.status === "dry_run"
                              ? "Preview"
                              : "Failed"}
                      </b>{" "}
                      {undone[result.id] ?? result.message}
                      {result.verified && result.status === "applied" && !undone[result.id] && (
                        <span className="dverified">
                          Verified live: re-read from YouTube after the write.
                        </span>
                      )}
                      {result.url && result.status === "applied" && (
                        <>
                          {" "}
                          <a href={result.url} target="_blank" rel="noreferrer">
                            View on YouTube
                          </a>
                        </>
                      )}
                      {(result.undo || result.status === "simulated") && !undone[result.id] && (
                        <button className="textlink" onClick={() => undo(result)}>
                          {result.status === "simulated" ? "Undo this (simulated)" : "Undo this"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="deckfoot">
            <button onClick={() => send(false)} disabled={applying || chosenCount === 0}>
              {applying && !armed ? "Checking…" : `Preview ${chosenCount} change${chosenCount === 1 ? "" : "s"}`}
            </button>
            {isDemo ? (
              armed ? (
                <button className="go danger" onClick={() => send(true)} disabled={applying}>
                  {applying ? "Simulating…" : `Yes, simulate publishing ${chosenCount}`}
                </button>
              ) : (
                <button className="go" onClick={arm} disabled={chosenCount === 0}>
                  Simulated publish (demo): {chosenCount} change{chosenCount === 1 ? "" : "s"}
                </button>
              )
            ) : !connected ? (
              <span className="deckwarn">
                Connect your channel above to publish these. Until then this is a preview.
              </span>
            ) : armed ? (
              <button className="go danger" onClick={() => send(true)} disabled={applying}>
                {applying ? "Publishing…" : `Yes, publish ${chosenCount} to YouTube now`}
              </button>
            ) : (
              <button className="go" onClick={arm} disabled={chosenCount === 0}>
                Publish {chosenCount} change{chosenCount === 1 ? "" : "s"} to YouTube
              </button>
            )}
            <button className="textlink" onClick={draft} disabled={loading || applying}>
              Redraft
            </button>
          </div>
          {armed && (
            <p className="deckarmed">
              {isDemo ? (
                <>
                  This is the bundled demo dataset, so the publish is <b>simulated</b>: the full
                  confirm-and-undo loop runs, and nothing is ever sent to YouTube.
                </>
              ) : (
                <>
                  This writes to <b>{video.title}</b> on YouTube for real. Anything you can undo gets
                  an undo button next to it afterwards.
                </>
              )}
            </p>
          )}
          {postedComment && (
            <p className="deckarmed">
              Note: YouTube's Data API has no endpoint for pinning a comment, so that one click still has
              to happen in Studio.
            </p>
          )}
        </>
      )}
    </section>
  );
}

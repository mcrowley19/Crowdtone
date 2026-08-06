"use client";

import { useCallback, useState } from "react";
import type { Localization } from "@/lib/localize";
import type { ActionResult, ProposedAction, VideoMeta } from "@/lib/types";

/**
 * Translate the packaging: the title and description your non-English (or
 * non-whatever-you-speak) viewers see. Drafts via the LLM, publishes through
 * the same confirmed-write path as every other change.
 */
export function LocalizePanel({
  video,
  countries,
  connected,
  isDemo,
}: {
  video: VideoMeta;
  countries: { country: string; views: number }[];
  connected: boolean;
  isDemo: boolean;
}) {
  const [localizations, setLocalizations] = useState<Localization[] | null>(null);
  const [action, setAction] = useState<ProposedAction | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const draft = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setUndone(null);
    setArmed(false);
    try {
      const res = await fetch("/api/localize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video, countries }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Translation failed.");
      setLocalizations(body.localizations);
      setAction(body.action);
      setExcluded(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation failed.");
    } finally {
      setLoading(false);
    }
  }, [video, countries]);

  const publish = useCallback(
    async (confirm: boolean) => {
      if (!action || !localizations) return;
      const chosen = localizations.filter((l) => !excluded.has(l.language));
      if (chosen.length === 0) return;
      const trimmed: ProposedAction = {
        ...action,
        payload: {
          ...action.payload,
          localizations: Object.fromEntries(
            chosen.map((l) => [l.language, { title: l.title, description: l.description }])
          ),
        },
      };
      setApplying(true);
      setError(null);
      try {
        const res = await fetch("/api/actions/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: video.videoId, actions: [trimmed], confirm }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Publish failed.");
        setResult(body.results?.[0] ?? null);
        setArmed(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Publish failed.");
      } finally {
        setApplying(false);
      }
    },
    [action, localizations, excluded, video]
  );

  const undo = useCallback(async () => {
    if (!result?.undo) return;
    try {
      const res = await fetch("/api/actions/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: result.undo }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Undo failed.");
      setUndone(body.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undo failed.");
    }
  }, [result]);

  const toggle = (language: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(language)) next.delete(language);
      else next.add(language);
      setArmed(false);
      return next;
    });

  const chosenCount = localizations ? localizations.length - excluded.size : 0;

  return (
    <section className="report">
      <h2>Speak their language</h2>
      <p className="deck">
        Localized titles and descriptions — YouTube shows each viewer the version in their language
      </p>

      {!localizations && (
        <>
          <p className="lede">
            {countries.length > 0
              ? `This video's audience watches from ${countries
                  .slice(0, 4)
                  .map((c) => c.country)
                  .join(", ")} and beyond, but its packaging only exists in one language. Draft it in theirs.`
              : "Most videos never fill in YouTube's localized metadata, because Studio buries it one language at a time. Draft the translations in one pass."}
          </p>
          <div className="thumbactions">
            <button className="go" onClick={draft} disabled={loading}>
              {loading ? "Translating…" : "Draft the translations"}
            </button>
          </div>
        </>
      )}

      {error && <div className="errorline">{error}</div>}

      {localizations && (
        <>
          <div className="deckgrid">
            {localizations.map((l) => (
              <div className={`deckrow${excluded.has(l.language) ? "" : " picked"}`} key={l.language}>
                <label className="deckhead">
                  <input
                    type="checkbox"
                    checked={!excluded.has(l.language)}
                    onChange={() => toggle(l.language)}
                    disabled={applying || result?.status === "applied"}
                  />
                  <span className="kind">{l.languageName}</span>
                  <span className="dlabel">{l.title}</span>
                </label>
                {l.description && (
                  <>
                    <button
                      className="textlink"
                      style={{ marginLeft: 27 }}
                      onClick={() => setOpen(open === l.language ? null : l.language)}
                    >
                      {open === l.language ? "Hide the description" : "Show the description"}
                    </button>
                    {open === l.language && <pre className="planpre">{l.description}</pre>}
                  </>
                )}
              </div>
            ))}
          </div>

          {result && (
            <div className={`dresult ${result.status}`}>
              <b>
                {result.status === "applied"
                  ? "Published"
                  : result.status === "dry_run"
                    ? "Preview"
                    : "Failed"}
              </b>{" "}
              {undone ?? result.message}
              {result.url && result.status === "applied" && (
                <>
                  {" "}
                  <a href={result.url} target="_blank" rel="noreferrer">
                    View on YouTube
                  </a>
                </>
              )}
              {result.undo && !undone && (
                <button className="textlink" onClick={undo}>
                  Undo this
                </button>
              )}
            </div>
          )}

          <div className="deckfoot">
            <button onClick={() => publish(false)} disabled={applying || chosenCount === 0}>
              {applying && !armed ? "Checking…" : `Preview ${chosenCount} language${chosenCount === 1 ? "" : "s"}`}
            </button>
            {isDemo ? (
              <span className="deckwarn">
                The demo dataset isn&rsquo;t a real video — analyze one of your own to publish.
              </span>
            ) : !connected ? (
              <span className="deckwarn">Connect your channel above to publish these.</span>
            ) : armed ? (
              <button className="go danger" onClick={() => publish(true)} disabled={applying}>
                {applying ? "Publishing…" : `Yes — publish ${chosenCount} to YouTube now`}
              </button>
            ) : (
              <button className="go" onClick={() => setArmed(true)} disabled={chosenCount === 0}>
                Publish {chosenCount} language{chosenCount === 1 ? "" : "s"} to YouTube
              </button>
            )}
            <button className="textlink" onClick={draft} disabled={loading || applying}>
              Redraft
            </button>
          </div>
          {armed && (
            <p className="deckarmed">
              This adds localized metadata to <b>{video.title}</b> on YouTube. The original title and
              description are untouched — localizations sit alongside them, and undo removes them.
            </p>
          )}
        </>
      )}
    </section>
  );
}

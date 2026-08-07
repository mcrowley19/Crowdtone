"use client";

import { useCallback, useState } from "react";
import { LanguageGlobe } from "@/components/LanguageGlobe";
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
    if (result?.status === "simulated") {
      setUndone("Simulated undo. The demo publish is reverted; YouTube was never touched.");
      return;
    }
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
      <div className="panelhead">
        <h2>Speak their language</h2>
        <span className="prov">YouTube serves each viewer their own language</span>
        {!localizations && (
          <span className="panelacts">
            <button className="go" onClick={draft} disabled={loading}>
              {loading ? "Translating…" : "Draft the translations"}
            </button>
          </span>
        )}
      </div>

      <LanguageGlobe countries={countries} />

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
                  : result.status === "simulated"
                    ? "Simulated"
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
              {(result.undo || result.status === "simulated") && !undone && (
                <button className="textlink" onClick={undo}>
                  {result.status === "simulated" ? "Undo this (simulated)" : "Undo this"}
                </button>
              )}
            </div>
          )}

          <div className="deckfoot">
            <button onClick={() => publish(false)} disabled={applying || chosenCount === 0}>
              {applying && !armed ? "Checking…" : `Preview ${chosenCount} language${chosenCount === 1 ? "" : "s"}`}
            </button>
            {isDemo ? (
              armed ? (
                <button className="go danger" onClick={() => publish(true)} disabled={applying}>
                  {applying ? "Simulating…" : `Yes, simulate publishing ${chosenCount}`}
                </button>
              ) : (
                <button className="go" onClick={() => setArmed(true)} disabled={chosenCount === 0}>
                  Simulated publish (demo): {chosenCount} language{chosenCount === 1 ? "" : "s"}
                </button>
              )
            ) : !connected ? (
              <span className="deckwarn">Connect your channel above to publish these.</span>
            ) : armed ? (
              <button className="go danger" onClick={() => publish(true)} disabled={applying}>
                {applying ? "Publishing…" : `Yes, publish ${chosenCount} to YouTube now`}
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
              {isDemo ? (
                <>
                  This is the bundled demo dataset, so the publish is <b>simulated</b>. Nothing is
                  sent to YouTube.
                </>
              ) : (
                <>
                  This adds localized metadata to <b>{video.title}</b> on YouTube. The original title
                  and description are untouched. Localizations sit alongside them, and undo removes
                  them.
                </>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}

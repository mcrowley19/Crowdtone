"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import premiereData from "@/examples/demo_premiere.json";
import { formatTimestamp } from "@/lib/chapters";
import {
  buildPremiereRecap,
  clusterQuestions,
  detectSpikes,
  triageMessage,
  type ChatMessage,
  type TriagedMessage,
} from "@/lib/premiere";

const SPEED = 12; // replay clock: 12 premiere-seconds per real second

/**
 * The live premiere co-pilot. The demo replays a bundled premiere chat on a
 * fast clock; triage, question clustering, and spike detection are the same
 * deterministic code a real stream would run — only the transport is canned.
 * (Reading a real premiere's chat needs the liveChatMessages API and an
 * actually-live video, which is why the demo is a replay and says so.)
 */
export function PremierePanel() {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [restored, setRestored] = useState<Set<string>>(new Set());
  const feedRef = useRef<HTMLDivElement>(null);

  const all = useMemo(
    () =>
      (premiereData.messages as ChatMessage[]).map((m) =>
        triageMessage(m, {
          channelTitle: premiereData.channel.title,
          ownerChannelId: premiereData.channel.channelId,
        })
      ),
    []
  );
  const spikes = useMemo(() => detectSpikes(all), [all]);
  const duration = premiereData.durationSeconds;

  useEffect(() => {
    if (elapsed === null || ended) return;
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = (prev ?? 0) + SPEED / 4;
        if (next >= duration) {
          setEnded(true);
          return duration;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [elapsed !== null, ended, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(
    () => (elapsed === null ? [] : all.filter((m) => m.atSeconds <= elapsed)),
    [all, elapsed]
  );

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [visible.length]);

  const questions = useMemo(
    () => clusterQuestions(visible.filter((m) => m.kind === "question")),
    [visible]
  );
  const hidden = visible.filter((m) => m.kind === "scam");
  const liveSpike =
    elapsed !== null &&
    spikes.find((s) => elapsed >= s.atSeconds && elapsed <= s.atSeconds + 45);
  const recap = useMemo(() => (ended ? buildPremiereRecap(all) : null), [ended, all]);

  const toggleRestore = (id: string) =>
    setRestored((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <p className="intro">
        During a premiere or livestream, the chat moves faster than any human can triage. The
        co-pilot reads it as it comes: surfacing the questions worth answering on air, hiding the
        scam bots the moment they appear, and timestamping the seconds chat lights up — which
        become your Shorts cut list before the stream even ends.
      </p>

      {elapsed === null && (
        <>
          <button className="go" onClick={() => setElapsed(0)}>
            Replay the bundled premiere (demo)
          </button>
          <p className="drationale" style={{ marginTop: 10 }}>
            A recorded chat from the demo channel&rsquo;s premiere, replayed at {SPEED}× — the
            triage, question clustering, and spike detection are the exact code a live stream
            would run; only the chat transport is bundled. Reading a real premiere requires the
            live chat API and a stream that is actually on air.
          </p>
        </>
      )}

      {elapsed !== null && (
        <>
          <div className="premhead">
            <div className="vtitle">{premiereData.title}</div>
            <div className="byline">
              <span className="stamp">Demo replay</span> {formatTimestamp(Math.floor(elapsed))} /{" "}
              {formatTimestamp(duration)} · {visible.length} messages
              {!ended && (
                <button className="textlink" onClick={() => setEnded(true)}>
                  Skip to the end
                </button>
              )}
            </div>
          </div>

          {liveSpike && !ended && (
            <div className="spikebanner">
              Chat is running {liveSpike.ratio}× its normal speed right now — mark{" "}
              {formatTimestamp(liveSpike.atSeconds)} for the clip reel.
            </div>
          )}

          <div className="premgrid">
            <div className="premfeed" ref={feedRef}>
              {visible.map((m) => (
                <div key={m.id} className={`premmsg ${m.kind}${restored.has(m.id) ? " restored" : ""}`}>
                  <span className="premat">{formatTimestamp(m.atSeconds)}</span>
                  <div>
                    <b>{m.author}</b>{" "}
                    {m.kind === "scam" && !restored.has(m.id) ? (
                      <s>{m.text}</s>
                    ) : (
                      <span>{m.text}</span>
                    )}
                    {m.kind === "scam" && (
                      <div className="premreasons">
                        {restored.has(m.id) ? "Put back — visible to viewers." : `Auto-hidden (simulated): ${m.reasons.join(" · ")}`}{" "}
                        <button className="textlink" onClick={() => toggleRestore(m.id)}>
                          {restored.has(m.id) ? "Hide it again" : "Put it back"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="premrail">
              <h3>Answer these on air</h3>
              {questions.length === 0 && <p className="drationale">No questions yet.</p>}
              <ul className="premq">
                {questions.slice(0, 6).map((q) => (
                  <li key={q.text}>
                    <b>
                      {q.count > 1 ? `${q.count}× · ` : ""}
                      {q.text}
                    </b>
                    <span>
                      {q.authors.slice(0, 3).join(", ")} · first at {formatTimestamp(q.firstAtSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
              <h3>Kept out of chat</h3>
              {hidden.length === 0 ? (
                <p className="drationale">Nothing hidden yet.</p>
              ) : (
                <p className="drationale">
                  {hidden.length - restored.size} hidden of {hidden.length} flagged — same detector
                  as Comment Patrol, reversible above.
                </p>
              )}
            </div>
          </div>

          {recap && (
            <section className="report">
              <h2>The stream, debriefed</h2>
              <p className="deck">
                Written the second the premiere ends — {recap.messagesSeen} messages triaged
              </p>
              <div className="planblock">
                <h3>Questions the room asked</h3>
                <ul className="quotelist plain">
                  {recap.questions.slice(0, 6).map((q) => (
                    <li key={q.text}>
                      <b>{q.count > 1 ? `Asked ${q.count} times: ` : ""}</b>
                      {q.text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="planblock">
                <h3>Clip these moments</h3>
                <ul className="notelist">
                  {recap.clipNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="planblock">
                <h3>Hidden from chat</h3>
                <ul className="quotelist plain">
                  {recap.hidden.map((m) => (
                    <li key={m.id}>
                      <b>{m.author}</b> — {m.reasons.join(" · ")}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="drationale">
                All of this is deterministic: the scam detector is Comment Patrol&rsquo;s, question
                grouping is keyword clustering, and a &ldquo;moment&rdquo; is a window where chat
                beat its own median pace 2.5× — the stream is its own baseline.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}

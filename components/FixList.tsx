import type { VideoFix } from "@/lib/types";

export function FixList({ fixes }: { fixes: VideoFix[] }) {
  return (
    <section className="report">
      <h2>What to fix on this video</h2>
      <p className="deck">Changes you can make today, each tied to a comment</p>
      <div className="fixgrid">
        {fixes.map((f, i) => (
          <div className="fix" key={i}>
            <div className="issue">{f.issue}</div>
            <div className="fixtext">{f.fix}</div>
            {f.evidence_quote && <div className="evidence">{f.evidence_quote}&rdquo;</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

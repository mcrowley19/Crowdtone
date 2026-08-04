import type { VideoFix } from "@/lib/types";

export function FixList({ fixes }: { fixes: VideoFix[] }) {
  return (
    <section className="report">
      <h2>What to fix on this video</h2>
      <p className="deck">Changes you can make today, each tied to a comment that asked for it.</p>
      <dl className="fixes">
        {fixes.map((f, i) => (
          <div key={i}>
            <dt>{f.issue}</dt>
            <dd>
              {f.fix}
              {f.evidence_quote && (
                <div className="evidence">&ldquo;{f.evidence_quote}&rdquo;</div>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

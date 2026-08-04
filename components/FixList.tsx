import type { VideoFix } from "@/lib/types";

export function FixList({ fixes }: { fixes: VideoFix[] }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h2>
          Fix this video
          <span className="sub">actionable changes backed by comments</span>
        </h2>
      </div>
      {fixes.map((f, i) => (
        <div className="fix" key={i}>
          <div className="issue">{f.issue}</div>
          <div className="fixtext">{f.fix}</div>
          {f.evidence_quote && <div className="quote">“{f.evidence_quote}”</div>}
        </div>
      ))}
    </div>
  );
}

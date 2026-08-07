import type { VideoFix } from "@/lib/types";
import { Panel } from "@/components/Panel";

export function FixList({ fixes }: { fixes: VideoFix[] }) {
  return (
    <Panel title="What to fix on this video" chip="Each tied to a comment">
      <div className="fixgrid">
        {fixes.map((f, i) => (
          <div className="fix" key={i}>
            <div className="issue">{f.issue}</div>
            <div className="fixtext">{f.fix}</div>
            {f.evidence_quote && <div className="evidence">{f.evidence_quote}&rdquo;</div>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

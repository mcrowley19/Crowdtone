import type { VideoIdea } from "@/lib/types";
import { Panel } from "@/components/Panel";

export function BriefCard({ ideas }: { ideas: VideoIdea[] }) {
  return (
    <Panel title="What to make next" chip="Ranked by how loudly the comments ask">
      <ol className="brief">
        {ideas.map((idea, i) => (
          <li key={i}>
            <div>
              <span className="ititle">{idea.title}</span>
              <span className={`interest ${idea.estimated_interest}`}>
                {idea.estimated_interest} interest
              </span>
              {idea.hook && (
                <p className="hook">
                  <b>Open with:</b> &ldquo;{idea.hook}&rdquo;
                </p>
              )}
              {idea.evidence_quotes.length > 0 && (
                <ul className="quotelist">
                  {idea.evidence_quotes.map((q, j) => (
                    <li key={j}>{q}&rdquo;</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

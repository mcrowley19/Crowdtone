import type { VideoIdea } from "@/lib/types";

export function BriefCard({ ideas }: { ideas: VideoIdea[] }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h2>
          Next video brief
          <span className="sub">3 ideas ranked by audience demand</span>
        </h2>
      </div>
      {ideas.map((idea, i) => (
        <div className="idea" key={i}>
          <div className="rank">{i + 1}</div>
          <div>
            <div className="ititle">
              {idea.title}
              <span className={`interest ${idea.estimated_interest}`}>
                {idea.estimated_interest} interest
              </span>
            </div>
            {idea.hook && <div className="hook">Hook: “{idea.hook}”</div>}
            {idea.evidence_quotes.map((q, j) => (
              <div className="quote" key={j}>
                “{q}”
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

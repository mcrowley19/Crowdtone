import type { ClusterResult, ThemeName } from "@/lib/types";

const COLORS: Record<ThemeName, string> = {
  praise: "var(--green)",
  complaint: "var(--red)",
  request: "var(--blue)",
  confusion: "var(--amber)",
};

const LABELS: Record<ThemeName, string> = {
  praise: "Praise",
  complaint: "Complaints",
  request: "Requests",
  confusion: "Confusion",
};

export function ThemeGrid({ clusters, source }: { clusters: ClusterResult; source: string }) {
  return (
    <div className="card">
      <div className="cardhead">
        <h2>
          Comment themes
          <span className="sub">
            clustered by {source === "llm" ? "LLM" : "keyword heuristic (add an LLM key for deeper analysis)"}
          </span>
        </h2>
      </div>
      <div className="summarybox">{clusters.summary}</div>
      <div className="themes">
        {clusters.themes.map((t) => (
          <div className="theme" key={t.name}>
            <div className="thead">
              <span className="tname">
                <span className="tdot" style={{ background: COLORS[t.name] }} />
                {LABELS[t.name]}
              </span>
              <span className="tcount">{t.count}</span>
            </div>
            {t.top_quotes.slice(0, 5).map((q, i) => (
              <div className="quote" key={i}>
                “{q}”
              </div>
            ))}
            {t.top_quotes.length === 0 && <div className="quote">No notable quotes.</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

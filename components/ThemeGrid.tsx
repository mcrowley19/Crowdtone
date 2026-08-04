import type { ClusterResult, ThemeName } from "@/lib/types";

const LABELS: Record<ThemeName, string> = {
  praise: "Praise",
  complaint: "Complaints",
  request: "Requests",
  confusion: "Confusion",
};

export function ThemeGrid({ clusters, source }: { clusters: ClusterResult; source: string }) {
  const total = clusters.themes.reduce((n, t) => n + t.count, 0);
  const maxCount = Math.max(1, ...clusters.themes.map((t) => t.count));

  return (
    <section className="report">
      <h2>What the comments say</h2>
      <p className="deck">
        {source === "llm"
          ? "Clustered by language model"
          : "Matched by keyword scan · add an LLM key for deeper clustering"}
      </p>
      <p className="lede">{clusters.summary}</p>
      <div style={{ marginTop: 14 }}>
        {clusters.themes.map((t) => (
          <div className={`themeband${t.name === "complaint" ? " hot" : ""}`} key={t.name}>
            <div className="tfacts">
              <span className="big">{t.count}</span>
              <span className="tname">
                {LABELS[t.name]}
                {total > 0 && ` · ${Math.round((t.count / total) * 100)}%`}
              </span>
              <div className="bar">
                <i style={{ width: `${Math.round((t.count / maxCount) * 100)}%` }} />
              </div>
            </div>
            {t.top_quotes.length > 0 ? (
              <ul className="quotelist">
                {t.top_quotes.slice(0, 5).map((q, i) => (
                  <li key={i}>{q}&rdquo;</li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 14, color: "var(--grey)" }}>No notable quotes.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

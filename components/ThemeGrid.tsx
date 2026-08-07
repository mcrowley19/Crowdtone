import type { ClusterResult, ThemeName } from "@/lib/types";
import { Panel } from "@/components/Panel";

const LABELS: Record<ThemeName, string> = {
  praise: "Praise",
  complaint: "Complaints",
  request: "Requests",
  confusion: "Confusion",
};

/**
 * The model tier is batched and capped, so the chip states how much of the
 * set it actually reached rather than implying it read all of it.
 */
function provenance(clusters: ClusterResult, source: string): string {
  const { total = 0, byModel = 0 } = clusters.coverage ?? {};
  if (source !== "llm" || byModel === 0) return "Keyword scan";
  if (byModel >= total) return "Clustered by model";
  return `${byModel.toLocaleString()} of ${total.toLocaleString()} clustered by model`;
}

export function ThemeGrid({ clusters, source }: { clusters: ClusterResult; source: string }) {
  const total = clusters.themes.reduce((n, t) => n + t.count, 0);
  const maxCount = Math.max(1, ...clusters.themes.map((t) => t.count));

  return (
    <Panel title="What the comments say" chip={provenance(clusters, source)}>
      <div style={{ marginTop: 4 }}>
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
    </Panel>
  );
}

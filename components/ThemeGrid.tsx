import type { ClusterResult, ThemeName } from "@/lib/types";

const LABELS: Record<ThemeName, string> = {
  praise: "Praise",
  complaint: "Complaints",
  request: "Requests",
  confusion: "Confusion",
};

export function ThemeGrid({ clusters, source }: { clusters: ClusterResult; source: string }) {
  const total = clusters.themes.reduce((n, t) => n + t.count, 0);

  return (
    <section className="report">
      <h2>What the comments say</h2>
      <p className="deck">
        {source === "llm"
          ? "Comments clustered by language model."
          : "Comments matched by keyword scan; add an LLM key in .env.local for deeper clustering."}
      </p>
      <p>{clusters.summary}</p>
      <table>
        <thead>
          <tr>
            <th>Theme</th>
            <th>Comments</th>
            <th>Most-liked quotes</th>
          </tr>
        </thead>
        <tbody>
          {clusters.themes.map((t) => (
            <tr key={t.name}>
              <td className="label">{LABELS[t.name]}</td>
              <td className="num">
                {t.count}
                {total > 0 && ` (${Math.round((t.count / total) * 100)}%)`}
              </td>
              <td>
                {t.top_quotes.length > 0 ? (
                  <ul className="quotelist">
                    {t.top_quotes.slice(0, 5).map((q, i) => (
                      <li key={i}>&ldquo;{q}&rdquo;</li>
                    ))}
                  </ul>
                ) : (
                  <span className="note">No notable quotes.</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

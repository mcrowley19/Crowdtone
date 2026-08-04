import type { Analysis, VideoMeta } from "./types";

/** Renders the full analysis as a copy-pasteable markdown summary. */
export function buildMarkdownSummary(video: VideoMeta, analysis: Analysis, commentCount: number): string {
  const lines: string[] = [];
  lines.push(`# AudienceSignal — ${video.title}`);
  lines.push("");
  lines.push(
    `Channel: **${video.channelTitle}** · Comments analyzed: **${commentCount}** · Engine: ${
      analysis.source === "llm" ? `LLM (${analysis.model ?? "unknown"})` : "keyword heuristic"
    }`
  );
  lines.push("");
  lines.push(`> ${analysis.clusters.summary}`);
  lines.push("");
  lines.push("## Comment themes");
  for (const t of analysis.clusters.themes) {
    lines.push(`### ${t.name} (${t.count})`);
    for (const q of t.top_quotes) lines.push(`- "${q}"`);
    if (t.top_quotes.length === 0) lines.push("- _no notable quotes_");
  }
  lines.push("");
  lines.push("## Next video brief");
  analysis.ideas.forEach((idea, i) => {
    lines.push(`${i + 1}. **${idea.title}** _(${idea.estimated_interest} interest)_`);
    lines.push(`   - Hook: ${idea.hook}`);
    for (const q of idea.evidence_quotes) lines.push(`   - Evidence: "${q}"`);
  });
  lines.push("");
  lines.push("## Fix this video");
  for (const f of analysis.fixes) {
    lines.push(`- **${f.issue}** — ${f.fix}`);
    if (f.evidence_quote) lines.push(`  - Evidence: "${f.evidence_quote}"`);
  }
  lines.push("");
  lines.push("## Thumbnail overlay ideas");
  for (const t of analysis.thumbnailTexts) lines.push(`- ${t}`);
  lines.push("");
  return lines.join("\n");
}

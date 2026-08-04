import { chatJSON, getLLMConfig } from "./llm";
import { heuristicAnalysis } from "./heuristic";
import { SYSTEM_PROMPT, clusteringPrompt, fixVideoPrompt, nextVideoPrompt, thumbnailTextPrompt } from "./prompts";
import type { Analysis, ClusterResult, Comment, Theme, ThemeName, VideoFix, VideoIdea } from "./types";

const THEME_NAMES: ThemeName[] = ["praise", "complaint", "request", "confusion"];

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max);
}

function normalizeThemeName(raw: string): ThemeName | null {
  const s = raw.toLowerCase().trim();
  if (s.startsWith("prais")) return "praise";
  if (s.startsWith("complain")) return "complaint";
  if (s.startsWith("request")) return "request";
  if (s.startsWith("confus")) return "confusion";
  return null;
}

/** Coerces a raw LLM clustering payload into a complete, well-typed ClusterResult. */
export function validateClusters(raw: any): ClusterResult {
  const byName = new Map<ThemeName, Theme>();
  const rawThemes = Array.isArray(raw?.themes) ? raw.themes : [];
  for (const t of rawThemes) {
    const name = normalizeThemeName(asString(t?.name));
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      name,
      count: Number.isFinite(Number(t?.count)) ? Math.max(0, Math.round(Number(t.count))) : 0,
      top_quotes: asStringArray(t?.top_quotes, 5),
    });
  }
  const themes = THEME_NAMES.map(
    (name) => byName.get(name) ?? { name, count: 0, top_quotes: [] }
  );
  return { themes, summary: asString(raw?.summary, "No summary produced.") };
}

export function validateIdeas(raw: any): VideoIdea[] {
  const list = Array.isArray(raw?.ideas) ? raw.ideas : Array.isArray(raw) ? raw : [];
  return list
    .map((i: any): VideoIdea | null => {
      const title = asString(i?.title);
      if (!title) return null;
      return {
        title,
        hook: asString(i?.hook),
        evidence_quotes: asStringArray(i?.evidence_quotes, 3),
        estimated_interest: asString(i?.estimated_interest).toLowerCase() === "high" ? "high" : "medium",
      };
    })
    .filter((i: VideoIdea | null): i is VideoIdea => i !== null)
    .slice(0, 3);
}

export function validateFixes(raw: any): VideoFix[] {
  const list = Array.isArray(raw?.fixes) ? raw.fixes : Array.isArray(raw) ? raw : [];
  return list
    .map((f: any): VideoFix | null => {
      const issue = asString(f?.issue);
      const fix = asString(f?.fix);
      if (!issue || !fix) return null;
      return { issue, fix, evidence_quote: asString(f?.evidence_quote) };
    })
    .filter((f: VideoFix | null): f is VideoFix => f !== null)
    .slice(0, 5);
}

/** Thumbnail overlay texts: exactly the spec's "max 6 words each", capped at 3. */
export function validateThumbnailTexts(raw: any): string[] {
  const list = Array.isArray(raw?.texts) ? raw.texts : Array.isArray(raw) ? raw : [];
  return list
    .filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t: string) => t.trim().split(/\s+/).slice(0, 6).join(" "))
    .slice(0, 3);
}

export function deriveTopComplaint(clusters: ClusterResult): string {
  const complaint = clusters.themes.find((t) => t.name === "complaint");
  const confusion = clusters.themes.find((t) => t.name === "confusion");
  return (
    complaint?.top_quotes[0] ??
    confusion?.top_quotes[0] ??
    "Viewers want the title and thumbnail to match the content"
  );
}

/**
 * Full analysis pipeline: LLM clustering first, then the three downstream
 * prompts in parallel. Falls back to the heuristic analyzer on any failure.
 */
export async function runAnalysis(comments: Comment[], videoTitle: string): Promise<Analysis> {
  const config = getLLMConfig();
  if (!config || comments.length === 0) {
    return heuristicAnalysis(comments, videoTitle);
  }
  try {
    const clusters = validateClusters(
      await chatJSON(config, SYSTEM_PROMPT, clusteringPrompt(comments, videoTitle))
    );
    const topComplaint = deriveTopComplaint(clusters);
    const [rawIdeas, rawFixes, rawTexts] = await Promise.all([
      chatJSON(config, SYSTEM_PROMPT, nextVideoPrompt(clusters, videoTitle)),
      chatJSON(config, SYSTEM_PROMPT, fixVideoPrompt(clusters, videoTitle)),
      chatJSON(config, SYSTEM_PROMPT, thumbnailTextPrompt(topComplaint, videoTitle)),
    ]);

    const fallback = heuristicAnalysis(comments, videoTitle);
    const ideas = validateIdeas(rawIdeas);
    const fixes = validateFixes(rawFixes);
    const texts = validateThumbnailTexts(rawTexts);
    return {
      clusters,
      ideas: ideas.length > 0 ? ideas : fallback.ideas,
      fixes: fixes.length > 0 ? fixes : fallback.fixes,
      thumbnailTexts: texts.length === 3 ? texts : [...texts, ...fallback.thumbnailTexts].slice(0, 3),
      topComplaint,
      source: "llm",
      model: config.model,
    };
  } catch (err) {
    console.error("LLM analysis failed, using heuristic fallback:", err);
    return heuristicAnalysis(comments, videoTitle);
  }
}

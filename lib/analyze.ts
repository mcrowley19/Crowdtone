import { chatJSON, getLLMConfig, type LLMConfig } from "./llm";
import { clusterHeuristically, heuristicAnalysis } from "./heuristic";
import { SYSTEM_PROMPT, clusteringPrompt, fixVideoPrompt, nextVideoPrompt, thumbnailTextPrompt } from "./prompts";
import type { Analysis, ClusterResult, Comment, Theme, ThemeName, VideoFix, VideoIdea } from "./types";

const THEME_NAMES: ThemeName[] = ["praise", "complaint", "request", "confusion"];

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Clustering is the only step whose cost grows with the comment count, so it
 * is the only one that needs rationing. One prompt per batch keeps every
 * request inside a small context window (free-tier models are the target),
 * and batches run a few at a time so a 1,000-comment video does not open
 * fifty concurrent connections at a provider that rate-limits free keys.
 *
 * Comments arrive ordered by YouTube's relevance ranking, so the batches the
 * model does see are the highest-signal ones; anything past the cap falls to
 * the keyword scan, which is pure code and has no ceiling.
 */
function batchConfig() {
  return {
    size: envInt("LLM_BATCH_SIZE", 150, 20, 500),
    maxBatches: envInt("LLM_MAX_BATCHES", 6, 1, 40),
    concurrency: envInt("LLM_BATCH_CONCURRENCY", 4, 1, 8),
    timeoutMs: envInt("LLM_BATCH_TIMEOUT_MS", 60000, 5000, 280000),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs tasks with a bounded number in flight, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Quotes come back from the model as bare strings, so to rank them across
 * batches they are matched to the comment they were copied from and sorted by
 * that comment's like count. A quote that matches nothing sorts last rather
 * than being dropped.
 */
function likeCountLookup(comments: Comment[]): (quote: string) => number {
  const index = new Map<string, number>();
  for (const c of comments) {
    const key = normalize(c.text).slice(0, 60);
    if (!key) continue;
    index.set(key, Math.max(index.get(key) ?? 0, c.likeCount));
  }
  return (quote: string) => index.get(normalize(quote).slice(0, 60)) ?? -1;
}

/** Sums counts across batches and keeps the most-liked quotes for each theme. */
export function mergeClusters(
  parts: ClusterResult[],
  comments: Comment[],
  byModel: number
): ClusterResult {
  const likesOf = likeCountLookup(comments);
  const themes: Theme[] = THEME_NAMES.map((name) => {
    let count = 0;
    const seen = new Set<string>();
    const quotes: string[] = [];
    for (const part of parts) {
      const theme = part.themes.find((t) => t.name === name);
      if (!theme) continue;
      count += theme.count;
      for (const q of theme.top_quotes) {
        const key = normalize(q);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        quotes.push(q);
      }
    }
    quotes.sort((a, b) => likesOf(b) - likesOf(a));
    return { name, count, top_quotes: quotes.slice(0, 5) };
  });

  const total = comments.length;
  const matched = themes.reduce((n, t) => n + t.count, 0);
  const loudest = [...themes].sort((a, b) => b.count - a.count)[0];
  const tail = total - byModel;
  const how =
    byModel === 0
      ? "Classified by keyword scan."
      : tail > 0
        ? `${byModel.toLocaleString()} clustered by the model, ${tail.toLocaleString()} by keyword scan.`
        : "Every comment clustered by the model.";
  return {
    themes,
    summary:
      `${total.toLocaleString()} comments read. ${matched.toLocaleString()} matched a theme; ` +
      `the loudest signal is ${loudest.name} (${loudest.count.toLocaleString()} comments). ${how}`,
    coverage: { total, byModel },
  };
}

/**
 * Clusters the whole set: the model takes as many batches as the cap allows,
 * the keyword scan takes the remainder, and any batch the model fails on
 * falls back to the scan for that batch alone.
 */
async function clusterAll(
  config: LLMConfig,
  comments: Comment[],
  videoTitle: string
): Promise<ClusterResult> {
  const { size, maxBatches, concurrency, timeoutMs } = batchConfig();
  const modelLimit = size * maxBatches;
  const forModel = comments.slice(0, modelLimit);
  const forScan = comments.slice(modelLimit);
  const batches = chunk(forModel, size);

  let byModel = 0;
  const parts = await mapWithConcurrency(batches, concurrency, async (batch) => {
    try {
      const result = validateClusters(
        await chatJSON(config, SYSTEM_PROMPT, clusteringPrompt(batch, videoTitle), timeoutMs)
      );
      byModel += batch.length;
      return result;
    } catch (err) {
      console.error(`Clustering batch of ${batch.length} failed, scanning it instead:`, err);
      return clusterHeuristically(batch);
    }
  });

  if (forScan.length > 0) parts.push(clusterHeuristically(forScan));
  return mergeClusters(parts, comments, byModel);
}

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
    const clusters = await clusterAll(config, comments, videoTitle);
    // Every batch failing means the provider is down or the key is dead, so
    // there is nothing to gain from three more calls to it.
    if ((clusters.coverage?.byModel ?? 0) === 0) return heuristicAnalysis(comments, videoTitle);
    const topComplaint = deriveTopComplaint(clusters);
    // Each section degrades on its own. Free-tier models are slow and flaky enough
    // that one timed-out call used to discard perfectly good clustering and drop the
    // whole report to heuristics; now only the section that failed falls back.
    const section = async <T,>(p: Promise<any>, validate: (raw: any) => T, name: string): Promise<T | null> => {
      try {
        return validate(await p);
      } catch (err) {
        console.error(`LLM section "${name}" failed, falling back for that section:`, err);
        return null;
      }
    };

    const [ideasRes, fixesRes, textsRes] = await Promise.all([
      section(chatJSON(config, SYSTEM_PROMPT, nextVideoPrompt(clusters, videoTitle)), validateIdeas, "ideas"),
      section(chatJSON(config, SYSTEM_PROMPT, fixVideoPrompt(clusters, videoTitle)), validateFixes, "fixes"),
      section(chatJSON(config, SYSTEM_PROMPT, thumbnailTextPrompt(topComplaint, videoTitle)), validateThumbnailTexts, "thumbnailTexts"),
    ]);

    const fallback = heuristicAnalysis(comments, videoTitle);
    const ideas = ideasRes ?? [];
    const fixes = fixesRes ?? [];
    const texts = textsRes ?? [];
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

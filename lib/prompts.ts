import type { ClusterResult, Comment } from "./types";

export const SYSTEM_PROMPT =
  "You are AudienceSignal, an analyst that turns YouTube comment sections into actionable plans for creators. " +
  "Always respond with a single valid JSON object matching the requested schema — no markdown, no commentary. " +
  "Every quote you return must be copied verbatim from the provided comments.";

function commentBlock(comments: Comment[]): string {
  return comments
    .map((c, i) => `${i + 1}. [${c.likeCount} likes] ${c.text.replace(/\s+/g, " ").slice(0, 280)}`)
    .join("\n");
}

export function clusteringPrompt(comments: Comment[], videoTitle: string): string {
  return (
    `Given these YouTube comments, classify each into: praise, complaint, request, confusion. ` +
    `Return JSON: {"themes": [{"name": string, "count": number, "top_quotes": [string]}], "summary": string}\n\n` +
    `Rules:\n` +
    `- "name" must be exactly one of: praise, complaint, request, confusion (include all four, even if count is 0).\n` +
    `- "count" is how many comments fall in that theme; "top_quotes" is up to 5 verbatim quotes, most-liked and most representative first.\n` +
    `- "summary" is 2-3 sentences on what the audience is telling this creator overall.\n\n` +
    `Video title: "${videoTitle}"\n\nComments:\n${commentBlock(comments)}`
  );
}

export function nextVideoPrompt(clusters: ClusterResult, videoTitle: string): string {
  return (
    `Based on comment themes, suggest 3 next video ideas ranked by demand. ` +
    `Each: {"title": string, "hook": string, "evidence_quotes": [string], "estimated_interest": "high"|"medium"}. ` +
    `Return JSON: {"ideas": [ ... ]} with the highest-demand idea first.\n\n` +
    `"title" is a ready-to-use YouTube title, "hook" is the opening line for the video, and ` +
    `"evidence_quotes" are 1-3 verbatim comment quotes proving viewers want it.\n\n` +
    `The current video is titled "${videoTitle}".\n\nComment themes:\n${JSON.stringify(clusters, null, 2)}`
  );
}

export function fixVideoPrompt(clusters: ClusterResult, videoTitle: string): string {
  const relevant = clusters.themes.filter((t) => t.name === "complaint" || t.name === "confusion");
  return (
    `Based on complaints/confusion, list 3-5 specific fixes for THIS video. ` +
    `Each: {"issue": string, "fix": string, "evidence_quote": string}. ` +
    `Return JSON: {"fixes": [ ... ]}\n\n` +
    `Fixes must be concretely actionable on this exact video (title/description edits, pinned comment, ` +
    `chapters, follow-up clarification, thumbnail change) — not generic advice.\n\n` +
    `Video title: "${videoTitle}"\n\nComplaint and confusion themes:\n${JSON.stringify(relevant, null, 2)}`
  );
}

export function thumbnailTextPrompt(topComplaint: string, videoTitle: string): string {
  return (
    `Given top complaint about title/thumbnail, suggest 3 short overlay texts (max 6 words each) ` +
    `that address the complaint. Return JSON: {"texts": [string, string, string]}\n\n` +
    `Top complaint: "${topComplaint}"\n` +
    `Video title: "${videoTitle}"\n` +
    `The texts will be rendered in bold on the thumbnail, so they must be punchy, honest, and readable at a glance.`
  );
}

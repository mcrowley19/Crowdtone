import type { TimestampMention } from "./chapters";
import { formatTimestamp } from "./chapters";
import type { Analysis, ClusterResult, Comment, VideoMeta } from "./types";

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

/**
 * The channel-level brief: what to make next, argued from demand in the
 * comments and from how this channel's own videos actually performed.
 */
export function nextVideoPlanPrompt(
  channel: { title: string; subscriberCount: number },
  stats: { top: { video: { title: string }; outlierScore: number }[]; bottom: { video: { title: string }; outlierScore: number }[]; medianDurationSeconds: number },
  performanceNotes: string[],
  demand: { quote: string; videoTitle: string; likeCount: number }[]
): string {
  const demandBlock = demand
    .map((d) => `- [${d.likeCount} likes, on "${d.videoTitle}"] ${d.quote}`)
    .join("\n");
  const recent = stats.top.map((p) => `- "${p.video.title}" — ${p.outlierScore}× normal`).join("\n");
  const weak = stats.bottom.map((p) => `- "${p.video.title}" — ${p.outlierScore}× normal`).join("\n");

  return (
    `Plan the next video for this channel. Decide ONE video to make and specify it well enough that the ` +
    `creator could start filming from your answer alone.\n\n` +
    `Return JSON:\n` +
    `{\n` +
    `  "title": string,\n` +
    `  "alternative_titles": [string, string],\n` +
    `  "angle": string,\n` +
    `  "hook": string,\n` +
    `  "outline": [{"beat": string, "detail": string}],\n` +
    `  "description": string,\n` +
    `  "tags": [string],\n` +
    `  "thumbnail_text": string,\n` +
    `  "target_length_minutes": number,\n` +
    `  "avoid": [string],\n` +
    `  "confidence": "high"|"medium"|"low"\n` +
    `}\n\n` +
    `Rules:\n` +
    `- "title" is a real, publishable YouTube title, max 100 characters. No clickbait the video can't pay off.\n` +
    `- "angle" is one sentence on why THIS video, for THIS channel, now.\n` +
    `- "hook" is the actual spoken first 15 seconds, written out.\n` +
    `- "outline" is 4-7 beats; "beat" is a 2-4 word section name, "detail" says what happens in it.\n` +
    `- "description" is a ready-to-paste YouTube description, first two lines carrying the search value.\n` +
    `- "thumbnail_text" is max 6 words for the overlay.\n` +
    `- "avoid" lists what the comments show goes badly on this channel — mistakes not to repeat.\n` +
    `- "confidence" is how strongly the comment demand supports this specific video.\n` +
    `- Ground the idea in the demand quotes below. Do not propose a topic nobody asked for.\n\n` +
    `Channel: "${channel.title}" (${channel.subscriberCount} subscribers)\n\n` +
    `How this channel performs:\n${performanceNotes.map((n) => `- ${n}`).join("\n")}\n\n` +
    `Best performers:\n${recent || "(none)"}\n\nWeakest performers:\n${weak || "(none)"}\n\n` +
    `What viewers are asking for, most-liked first:\n${demandBlock || "(no requests found)"}`
  );
}

/**
 * Unlike the other prompts, everything this one returns gets published to a
 * real channel, so it asks for finished copy rather than advice — and the
 * replies are addressed by list position, never by comment id.
 */
export function actionPlanPrompt(
  video: VideoMeta,
  analysis: Analysis,
  questions: Comment[],
  mentions: TimestampMention[]
): string {
  const questionBlock = questions.length
    ? questions
        .map((q, i) => `${i + 1}. [${q.likeCount} likes] ${q.author}: ${q.text.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n")
    : "(none)";
  const momentBlock = mentions.length
    ? mentions
        .slice(0, 8)
        .map((m) => `- ${formatTimestamp(m.seconds)} (${m.count} mentions): ${m.quotes[0]?.slice(0, 160) ?? ""}`)
        .join("\n")
    : "(none)";

  return (
    `Write the actual changes to publish on this video. Everything you return will be applied to a live ` +
    `YouTube video by its own creator, so return finished copy in the creator's voice — no placeholders, ` +
    `no square brackets, no "insert X here".\n\n` +
    `Return JSON:\n` +
    `{\n` +
    `  "new_title": {"text": string, "why": string},\n` +
    `  "description_intro": string,\n` +
    `  "chapter_labels": [{"timestamp": "M:SS", "label": string}],\n` +
    `  "pinned_comment": {"text": string, "why": string},\n` +
    `  "replies": [{"comment_index": number, "text": string}]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- "new_title": max 100 characters, honest about what the video contains, and only if it beats the ` +
    `current title at answering the complaints below. Omit the key entirely if the current title is fine.\n` +
    `- "description_intro": 2-3 sentences for the top of the description, the part shown in search results.\n` +
    `- "chapter_labels": use ONLY the timestamps listed under "Moments viewers timestamped", copied exactly. ` +
    `Label each in 2-5 words describing what happens there, inferred from what viewers said about it.\n` +
    `- "pinned_comment": one comment from the creator that resolves the most repeated confusion. Under 600 characters.\n` +
    `- "replies": answer up to 5 of the numbered viewer questions below. "comment_index" is the number in ` +
    `that list. Each reply is 1-3 sentences, direct, and answers the actual question — no "great question!".\n` +
    `- Never promise anything the creator has not said they will do.\n\n` +
    `Current title: "${video.title}"\n` +
    `Current description (first 600 chars):\n${(video.description ?? "(empty)").slice(0, 600)}\n\n` +
    `What the audience said:\n${JSON.stringify(analysis.clusters, null, 2)}\n\n` +
    `Top complaint: "${analysis.topComplaint}"\n\n` +
    `Moments viewers timestamped:\n${momentBlock}\n\n` +
    `Viewer questions:\n${questionBlock}`
  );
}

/**
 * The patrol's second opinion. The heuristics have already flagged these; the
 * model's job is to read each in context and clear the false positives — a
 * legitimate viewer linking a source, a fan whose name resembles the channel.
 * Verdicts come back by list index, never by comment id.
 */
export function moderationPrompt(
  channelTitle: string,
  candidates: { comment: Comment; videoTitle: string; reasons: string[] }[]
): string {
  const block = candidates
    .map(
      (c, i) =>
        `${i + 1}. author: "${c.comment.author}" | on video: "${c.videoTitle}" | flagged for: ${c.reasons.join(", ")}\n` +
        `   text: ${c.comment.text.replace(/\s+/g, " ").slice(0, 400)}`
    )
    .join("\n");
  return (
    `These comments on the YouTube channel "${channelTitle}" were flagged by pattern-matching as likely ` +
    `scams or spam. Judge each one: is it really a scam (impersonation, investment bait, luring viewers ` +
    `to WhatsApp/Telegram/phone numbers, fake giveaways), ordinary spam (link dumping, copy-paste ` +
    `self-promotion), or a clean comment wrongly flagged?\n\n` +
    `Return JSON: {"verdicts": [{"index": number, "verdict": "scam"|"spam"|"clean", "reason": string}]}\n\n` +
    `Rules:\n` +
    `- "index" is the number from the list below. Return a verdict for every item.\n` +
    `- Be conservative with "clean": a real viewer linking a relevant source is clean; anything asking to ` +
    `be contacted off-platform about money never is.\n` +
    `- "reason" is one sentence a creator can read before clicking Hide.\n\n` +
    `Flagged comments:\n${block}`
  );
}

/**
 * Translation for publication, not gist: the output goes straight into the
 * video's `localizations` map, so it must read like a native-speaker creator
 * wrote it — and leave URLs, handles, and timestamps exactly as they are.
 */
export function localizePrompt(video: VideoMeta, languages: string[]): string {
  return (
    `Translate this YouTube video's title and description into each requested language, for the ` +
    `video's official localized metadata.\n\n` +
    `Return JSON:\n` +
    `{\n` +
    `  "detected_language": string,  // BCP-47 code of the CURRENT title/description's language\n` +
    `  "localizations": { "<language code>": {"title": string, "description": string}, ... }\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Provide exactly these language codes: ${languages.join(", ")}.\n` +
    `- Titles stay under 100 characters and keep the promise of the original — adapt idioms, don't ` +
    `translate them word for word.\n` +
    `- Descriptions keep their structure and line breaks. Leave URLs, @handles, #hashtags, timestamps ` +
    `(like 8:14), product names, and numbers untouched.\n` +
    `- Write like a native-speaker creator, not a translation engine.\n\n` +
    `Title: "${video.title}"\n\n` +
    `Description:\n${(video.description ?? "").slice(0, 3000) || "(empty)"}`
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

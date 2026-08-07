import { buildChapters, extractTimestampMentions, mergeChaptersIntoDescription, renderChapterBlock, parseTimestamp } from "./chapters";
import { chatJSON, getLLMConfig } from "./llm";
import { applyStyleGuards, describeStyleProfile, type StyleProfile } from "./replystyle";
import { SYSTEM_PROMPT, actionPlanPrompt } from "./prompts";
import type {
  ActionPayload,
  ActionResult,
  Analysis,
  Comment,
  ProposedAction,
  UndoTicket,
  VideoMeta,
} from "./types";
import { YouTubeApiError } from "./youtube";
import { ytAuthedDelete, ytAuthedGet, ytAuthedUpload, ytAuthedWrite } from "./ytclient";
import { generateVariants, OVERLAY_STYLES } from "./thumbnails";

export const MAX_TITLE_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_COMMENT_LENGTH = 9000;

export interface ActionContext {
  video: VideoMeta;
  comments: Comment[];
  analysis: Analysis;
}

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/* ------------------------------- proposing ------------------------------- */

/**
 * Comments that read like questions are the ones worth answering, and the
 * only ones we'll ever draft a public reply to. Most-liked first, so the
 * reply lands where the most viewers will see it.
 */
export function pickQuestions(comments: Comment[], max = 5): Comment[] {
  return comments
    .filter((c) => c.text.includes("?") || /^(how|what|why|where|when|which|can|does|did|is|are)\b/i.test(c.text.trim()))
    .filter((c) => c.id && c.text.length >= 12)
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, max);
}

export interface ActionPlanDraft {
  newTitle?: { text: string; why: string };
  pinnedComment?: { text: string; why: string };
  chapterLabels: { seconds: number; label: string }[];
  replies: { commentId: string; text: string }[];
  descriptionIntro?: string;
}

/** Coerces the raw LLM action plan into something we would be willing to publish. */
export function validateActionPlan(raw: any, questions: Comment[]): ActionPlanDraft {
  const draft: ActionPlanDraft = { chapterLabels: [], replies: [] };

  const title = asString(raw?.new_title?.text ?? raw?.new_title);
  if (title) {
    draft.newTitle = { text: clamp(title, MAX_TITLE_LENGTH), why: asString(raw?.new_title?.why) };
  }

  const pinned = asString(raw?.pinned_comment?.text ?? raw?.pinned_comment);
  if (pinned) {
    draft.pinnedComment = {
      text: clamp(pinned, MAX_COMMENT_LENGTH),
      why: asString(raw?.pinned_comment?.why),
    };
  }

  const intro = asString(raw?.description_intro);
  if (intro) draft.descriptionIntro = clamp(intro, 900);

  for (const c of Array.isArray(raw?.chapter_labels) ? raw.chapter_labels : []) {
    const label = asString(c?.label);
    const stamp = asString(c?.timestamp);
    const seconds = Number.isFinite(Number(c?.seconds)) ? Number(c.seconds) : parseTimestamp(stamp);
    if (!label || seconds === null || !Number.isFinite(seconds)) continue;
    draft.chapterLabels.push({ seconds: Math.floor(Number(seconds)), label: clamp(label, 60) });
  }

  for (const r of Array.isArray(raw?.replies) ? raw.replies : []) {
    const text = asString(r?.text);
    if (!text) continue;
    // The model addresses comments by their position in the list we gave it;
    // never by an id it could hallucinate into a reply on someone else's video.
    const idx = Number(r?.comment_index);
    const target = Number.isInteger(idx) ? questions[idx - 1] : undefined;
    if (!target?.id) continue;
    if (draft.replies.some((existing) => existing.commentId === target.id)) continue;
    draft.replies.push({ commentId: target.id, text: clamp(text, MAX_COMMENT_LENGTH) });
  }

  return draft;
}

function trimForDiff(s: string, max = 400): string {
  const t = (s ?? "").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Turns an analysis into a list of concrete, applyable changes. Everything
 * here is a proposal — nothing touches YouTube until applyAction runs with an
 * explicit confirmation.
 */
export function buildProposedActions(ctx: ActionContext, draft: ActionPlanDraft, source: "llm" | "heuristic"): ProposedAction[] {
  const { video, comments, analysis } = ctx;
  const actions: ProposedAction[] = [];
  const currentDescription = video.description ?? "";

  if (draft.newTitle && draft.newTitle.text !== video.title) {
    actions.push({
      id: "retitle",
      kind: "retitle",
      label: "Retitle the video",
      rationale: draft.newTitle.why || "Viewers said the title set the wrong expectation.",
      evidence: analysis.topComplaint,
      before: video.title,
      after: draft.newTitle.text,
      payload: { title: draft.newTitle.text },
      source,
    });
  }

  const mentions = extractTimestampMentions(comments, video.durationSeconds ?? 0);
  const labelled = draft.chapterLabels.length > 0
    ? draft.chapterLabels
    : mentions.slice(0, 6).map((m) => ({ seconds: m.seconds, label: "Moment viewers pointed at" }));
  const chapters = buildChapters(labelled, video.durationSeconds ?? 0);
  if (chapters.length > 0) {
    const nextDescription = mergeChaptersIntoDescription(currentDescription, chapters);
    if (nextDescription !== currentDescription) {
      actions.push({
        id: "add_chapters",
        kind: "add_chapters",
        label: `Add ${chapters.length} chapters viewers already timestamped`,
        rationale: `${mentions.reduce((n, m) => n + m.count, 0)} comments cite a timestamp; those are the moments people rewatch and link to.`,
        evidence: mentions[0]?.quotes[0],
        before: trimForDiff(currentDescription) || "(no chapters in the description)",
        after: renderChapterBlock(chapters),
        payload: { chapters, description: clamp(nextDescription, MAX_DESCRIPTION_LENGTH) },
        source,
      });
    }
  }

  if (draft.descriptionIntro) {
    const rest = currentDescription.trim();
    const nextDescription = clamp(
      rest ? `${draft.descriptionIntro}\n\n${rest}` : draft.descriptionIntro,
      MAX_DESCRIPTION_LENGTH
    );
    actions.push({
      id: "update_description",
      kind: "update_description",
      label: "Rewrite the opening of the description",
      rationale: "The first two lines are all most viewers see in search and suggested.",
      before: trimForDiff(currentDescription) || "(empty description)",
      after: trimForDiff(nextDescription),
      payload: { description: nextDescription },
      source,
    });
  }

  if (draft.pinnedComment) {
    actions.push({
      id: "post_comment",
      kind: "post_comment",
      label: "Post a comment answering the top confusion",
      rationale:
        draft.pinnedComment.why ||
        "One comment from the creator clears up the thing the whole thread keeps asking.",
      evidence: analysis.topComplaint,
      after: draft.pinnedComment.text,
      payload: { text: draft.pinnedComment.text },
      source,
    });
  }

  const byId = new Map(comments.map((c) => [c.id, c]));
  draft.replies.forEach((reply, i) => {
    const parent = byId.get(reply.commentId);
    actions.push({
      id: `reply_${i}`,
      kind: "reply_to_comment",
      label: `Reply to ${parent?.author ?? "a viewer"}`,
      rationale: "Answered questions keep a thread alive and signal an active creator.",
      evidence: parent?.text,
      before: parent ? trimForDiff(parent.text, 200) : undefined,
      after: reply.text,
      payload: {
        text: reply.text,
        parentId: reply.commentId,
        parentAuthor: parent?.author,
        parentText: parent ? trimForDiff(parent.text, 200) : undefined,
      },
      source,
    });
  });

  const overlay = analysis.thumbnailTexts[0];
  if (overlay) {
    actions.push({
      id: "set_thumbnail",
      kind: "set_thumbnail",
      label: "Replace the thumbnail with the top variant",
      rationale: "Answers the loudest complaint on the image people actually click.",
      evidence: analysis.topComplaint,
      before: "The thumbnail currently published (shown above)",
      after: `Overlay: “${overlay}” on a real frame of the video`,
      payload: { overlayText: overlay, overlayStyle: OVERLAY_STYLES[0] },
      source,
    });
  }

  return actions;
}

/** No LLM key, or the model failed: still propose what pure logic can justify. */
export function heuristicActionPlan(ctx: ActionContext): ActionPlanDraft {
  const { analysis, comments, video } = ctx;
  const mentions = extractTimestampMentions(comments, video.durationSeconds ?? 0);
  const confusion = analysis.clusters.themes.find((t) => t.name === "confusion");
  const topConfusion = confusion?.top_quotes[0];
  const draft: ActionPlanDraft = {
    chapterLabels: mentions.slice(0, 6).map((m) => ({ seconds: m.seconds, label: "Moment viewers pointed at" })),
    replies: [],
  };
  if (topConfusion) {
    draft.pinnedComment = {
      text:
        `Pinned answer: a lot of you asked about this: "${trimForDiff(topConfusion, 160)}". ` +
        `Short version: here's the clarification, and I'll cover it properly in the next video.`,
      why: "Most-repeated confusion in the thread, unanswered.",
    };
  }
  return draft;
}

/**
 * "Reply as me", the deterministic half: whatever the model drafted, the
 * measured style profile is enforced in code — emoji stripped for creators
 * who never use them, lengths brought back into their range, sign-offs
 * appended. Runs on exactly the texts that get posted under the creator's
 * name: replies and the pinned-style comment.
 */
export function applyVoiceToDraft(draft: ActionPlanDraft, profile: StyleProfile): ActionPlanDraft {
  return {
    ...draft,
    pinnedComment: draft.pinnedComment
      ? { ...draft.pinnedComment, text: applyStyleGuards(draft.pinnedComment.text, profile) }
      : undefined,
    replies: draft.replies.map((r) => ({ ...r, text: applyStyleGuards(r.text, profile) })),
  };
}

export async function planActions(ctx: ActionContext, voice?: StyleProfile | null): Promise<ProposedAction[]> {
  const config = getLLMConfig();
  const questions = pickQuestions(ctx.comments);
  if (config) {
    try {
      const prompt = actionPlanPrompt(
        ctx.video,
        ctx.analysis,
        questions,
        extractTimestampMentions(ctx.comments, ctx.video.durationSeconds ?? 0)
      );
      const voiced = voice
        ? `${prompt}\n\nVoice for "pinned_comment" and every reply: ${describeStyleProfile(voice)}`
        : prompt;
      const raw = await chatJSON(config, SYSTEM_PROMPT, voiced);
      let draft = validateActionPlan(raw, questions);
      if (voice) draft = applyVoiceToDraft(draft, voice);
      const actions = buildProposedActions(ctx, draft, "llm");
      if (actions.length > 0) return actions;
    } catch (err) {
      console.error("Action planning failed, falling back to heuristic actions:", err);
    }
  }
  let fallback = heuristicActionPlan(ctx);
  if (voice) fallback = applyVoiceToDraft(fallback, voice);
  return buildProposedActions(ctx, fallback, "heuristic");
}

/* -------------------------------- applying ------------------------------- */

export interface OwnedVideo {
  channelId: string;
  title: string;
  description: string;
  categoryId: string;
  tags?: string[];
  thumbnailUrl: string;
  defaultLanguage?: string;
  localizations: Record<string, { title: string; description: string }> | null;
}

export async function fetchOwnVideo(accessToken: string, videoId: string): Promise<OwnedVideo> {
  const body = await ytAuthedGet(accessToken, "videos", { part: "snippet,localizations", id: videoId });
  const item = body?.items?.[0];
  if (!item) throw new YouTubeApiError("Video not found", "not_found", 404);
  return {
    channelId: item.snippet?.channelId ?? "",
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    categoryId: item.snippet?.categoryId ?? "22",
    tags: item.snippet?.tags,
    thumbnailUrl: item.snippet?.thumbnails?.maxres?.url ?? item.snippet?.thumbnails?.high?.url ?? "",
    defaultLanguage: item.snippet?.defaultLanguage,
    localizations:
      item.localizations && typeof item.localizations === "object" ? item.localizations : null,
  };
}

export class OwnershipError extends Error {
  constructor(message = "You can only change videos on the channel you connected.") {
    super(message);
    this.name = "OwnershipError";
  }
}

/**
 * videos.update replaces the whole snippet part, so anything we don't send is
 * wiped. Every write starts from the video's current snippet and changes only
 * the fields the action asked for.
 */
async function updateSnippet(
  accessToken: string,
  videoId: string,
  current: OwnedVideo,
  changes: { title?: string; description?: string }
): Promise<void> {
  await ytAuthedWrite(
    accessToken,
    "videos",
    { part: "snippet" },
    {
      id: videoId,
      snippet: {
        title: clamp(changes.title ?? current.title, MAX_TITLE_LENGTH),
        description: clamp(changes.description ?? current.description, MAX_DESCRIPTION_LENGTH),
        categoryId: current.categoryId,
        ...(current.tags ? { tags: current.tags } : {}),
      },
    },
    "PUT"
  );
}

/** YouTube caps custom thumbnails at 2MB; anything bigger isn't ours to restore. */
const MAX_THUMBNAIL_BYTES = 4 * 1024 * 1024;

/**
 * Snapshots the current thumbnail as a data URL that travels inside the undo
 * ticket itself. No server-side storage means no cold-start amnesia: as long
 * as the creator's browser holds the ticket, undo works.
 */
async function snapshotThumbnail(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_THUMBNAIL_BYTES) return null;
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Decodes a restore ticket's data URL, refusing anything but a plausible image. */
export function decodeThumbnailTicket(imageDataUrl: string): Buffer | null {
  const match = /^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl ?? "");
  if (!match) return null;
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0 || bytes.length > MAX_THUMBNAIL_BYTES) return null;
  return bytes;
}

function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Re-reads the snippet after a write, so "published" in the UI means "read
 * back from YouTube", not "the request didn't error". Costs one videos.list
 * unit; a verification failure never fails the action it verifies.
 */
async function verifySnippet(
  accessToken: string,
  videoId: string
): Promise<{ title: string; description: string } | undefined> {
  try {
    const after = await fetchOwnVideo(accessToken, videoId);
    return { title: after.title, description: trimForDiff(after.description, 200) };
  } catch {
    return undefined;
  }
}

/**
 * Executes one proposed action. `dryRun` returns exactly what would happen
 * without calling a single write endpoint — that is the default everywhere
 * upstream, and a real write only happens when the caller confirms.
 */
export async function applyAction(
  accessToken: string,
  channelId: string,
  videoId: string,
  action: { id: string; kind: ProposedAction["kind"]; payload: ActionPayload },
  dryRun: boolean
): Promise<ActionResult> {
  const base = { id: action.id, kind: action.kind };

  if (dryRun) {
    return { ...base, status: "dry_run", message: "Previewed. Nothing was sent to YouTube." };
  }

  // Every write, including replies, is gated on the connected channel owning
  // this video. Replying elsewhere is technically allowed by the API; letting a
  // tool do it on your behalf is how you end up spamming strangers' comments.
  const current = await fetchOwnVideo(accessToken, videoId);
  if (current.channelId !== channelId) throw new OwnershipError();

  switch (action.kind) {
    case "retitle": {
      const title = asString(action.payload.title);
      if (!title) throw new Error("No title in the action payload.");
      await updateSnippet(accessToken, videoId, current, { title });
      return {
        ...base,
        status: "applied",
        message: `Title is now “${title}”.`,
        url: videoUrl(videoId),
        verified: await verifySnippet(accessToken, videoId),
        undo: {
          kind: "restore_snippet",
          videoId,
          title: current.title,
          description: current.description,
        },
      };
    }

    case "add_chapters":
    case "update_description": {
      const description = asString(action.payload.description);
      if (!description) throw new Error("No description in the action payload.");
      await updateSnippet(accessToken, videoId, current, { description });
      return {
        ...base,
        status: "applied",
        message:
          action.kind === "add_chapters"
            ? `Added ${action.payload.chapters?.length ?? 0} chapters to the description.`
            : "Description updated.",
        url: videoUrl(videoId),
        verified: await verifySnippet(accessToken, videoId),
        undo: {
          kind: "restore_snippet",
          videoId,
          title: current.title,
          description: current.description,
        },
      };
    }

    case "set_thumbnail": {
      const text = asString(action.payload.overlayText);
      if (!text) throw new Error("No overlay text in the action payload.");
      const [variant] = await generateVariants(videoId, [text]);
      const bytes = Buffer.from(variant.dataUrl.split(",")[1] ?? "", "base64");
      // Snapshot first: once thumbnails.set lands, the old image is gone.
      const imageDataUrl = await snapshotThumbnail(current.thumbnailUrl);
      await ytAuthedUpload(accessToken, "thumbnails/set", { videoId }, bytes, "image/jpeg");
      return {
        ...base,
        status: "applied",
        message: "New thumbnail uploaded. YouTube takes a minute to show it everywhere.",
        url: videoUrl(videoId),
        undo: imageDataUrl ? { kind: "restore_thumbnail", videoId, imageDataUrl } : undefined,
      };
    }

    case "set_localizations": {
      const additions = action.payload.localizations;
      if (!additions || Object.keys(additions).length === 0) {
        throw new Error("No localizations in the action payload.");
      }
      // localizations only display once the video declares what language the
      // original is in. If it doesn't yet, set it — from the model's detection
      // of the existing metadata, never a guess hardcoded here.
      const needsDefaultLanguage = !current.defaultLanguage;
      const parts = needsDefaultLanguage ? "snippet,localizations" : "localizations";
      const merged = { ...(current.localizations ?? {}), ...additions };
      const payload: Record<string, unknown> = { id: videoId, localizations: merged };
      if (needsDefaultLanguage) {
        payload.snippet = {
          title: current.title,
          description: current.description,
          categoryId: current.categoryId,
          ...(current.tags ? { tags: current.tags } : {}),
          defaultLanguage: action.payload.detectedLanguage || "en",
        };
      }
      await ytAuthedWrite(accessToken, "videos", { part: parts }, payload, "PUT");
      const languages = Object.keys(additions).join(", ");
      return {
        ...base,
        status: "applied",
        message: `Localized title and description published for: ${languages}. Viewers in those languages now see the video packaged in theirs.`,
        url: videoUrl(videoId),
        undo: { kind: "restore_localizations", videoId, localizations: current.localizations },
      };
    }

    case "post_comment": {
      const text = asString(action.payload.text);
      if (!text) throw new Error("No comment text in the action payload.");
      const body = await ytAuthedWrite(
        accessToken,
        "commentThreads",
        { part: "snippet" },
        { snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } } }
      );
      const commentId = body?.snippet?.topLevelComment?.id ?? body?.id;
      return {
        ...base,
        status: "applied",
        // The Data API has no pin endpoint — say so rather than imply it happened.
        message: "Comment posted. Pinning it still has to be done from YouTube Studio.",
        url: `${videoUrl(videoId)}&lc=${commentId ?? ""}`,
        undo: commentId ? { kind: "delete_comment", commentId } : undefined,
      };
    }

    case "reply_to_comment": {
      const text = asString(action.payload.text);
      const parentId = asString(action.payload.parentId);
      if (!text || !parentId) throw new Error("Reply needs both a parent comment and text.");
      const body = await ytAuthedWrite(
        accessToken,
        "comments",
        { part: "snippet" },
        { snippet: { parentId, textOriginal: text } }
      );
      return {
        ...base,
        status: "applied",
        message: `Replied to ${action.payload.parentAuthor ?? "the viewer"}.`,
        url: `${videoUrl(videoId)}&lc=${body?.id ?? parentId}`,
        undo: body?.id ? { kind: "delete_comment", commentId: body.id } : undefined,
      };
    }

    default:
      throw new Error(`Unknown action kind: ${action.kind}`);
  }
}

/** Puts back what an applied action replaced. */
export async function undoAction(accessToken: string, channelId: string, ticket: UndoTicket): Promise<string> {
  switch (ticket.kind) {
    case "restore_snippet": {
      const current = await fetchOwnVideo(accessToken, ticket.videoId);
      if (current.channelId !== channelId) throw new OwnershipError();
      await updateSnippet(accessToken, ticket.videoId, current, {
        title: ticket.title,
        description: ticket.description,
      });
      return "Title and description put back the way they were.";
    }
    case "delete_comment": {
      await ytAuthedDelete(accessToken, "comments", { id: ticket.commentId });
      return "Comment deleted.";
    }
    case "restore_localizations": {
      const current = await fetchOwnVideo(accessToken, ticket.videoId);
      if (current.channelId !== channelId) throw new OwnershipError();
      await ytAuthedWrite(
        accessToken,
        "videos",
        { part: "localizations" },
        { id: ticket.videoId, localizations: ticket.localizations ?? {} },
        "PUT"
      );
      return ticket.localizations
        ? "Previous localizations put back."
        : "Localizations removed. The video is back to its original language only.";
    }
    case "restore_thumbnail": {
      const current = await fetchOwnVideo(accessToken, ticket.videoId);
      if (current.channelId !== channelId) throw new OwnershipError();
      const bytes = decodeThumbnailTicket(ticket.imageDataUrl);
      if (!bytes) throw new Error("This undo ticket doesn't carry a valid image.");
      await ytAuthedUpload(accessToken, "thumbnails/set", { videoId: ticket.videoId }, bytes, "image/jpeg");
      return "Previous thumbnail restored.";
    }
    default:
      throw new Error("Nothing to undo.");
  }
}

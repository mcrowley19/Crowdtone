import { chatJSON, getLLMConfig } from "./llm";
import { SYSTEM_PROMPT, moderationPrompt } from "./prompts";
import type { Comment } from "./types";
import { ytAuthedWrite } from "./ytclient";

/**
 * Comment Patrol: finds the comments a creator would remove if they had time
 * to read them all — impersonation scams, crypto/forex bait, phone-number
 * lures, link spam — and hands them to comments.setModerationStatus in bulk.
 *
 * Detection is two-layered on purpose. The heuristics here are pure functions
 * that never miss the shapes scams reuse (they're cheap, deterministic, and
 * testable), and an optional LLM pass then reads each candidate in context to
 * cut false positives. With no LLM key the heuristic verdicts stand alone.
 */

export type FlagReason =
  | "impersonation"
  | "contact_lure"
  | "money_bait"
  | "link_spam"
  | "repeated_across_videos"
  | "styled_unicode";

export const REASON_LABEL: Record<FlagReason, string> = {
  impersonation: "Poses as the creator",
  contact_lure: "Pushes viewers to WhatsApp/Telegram or a phone number",
  money_bait: "Investment / giveaway bait",
  link_spam: "Drops an off-platform link",
  repeated_across_videos: "Identical comment pasted on several videos",
  styled_unicode: "Styled-unicode name, the impersonator's font",
};

export interface FlaggedComment {
  comment: Comment;
  videoId: string;
  videoTitle: string;
  reasons: FlagReason[];
  /** 0–1: how many independent detectors fired, weighted. */
  score: number;
  verdict: "scam" | "spam" | "clean";
  explanation: string;
  verdictSource: "llm" | "heuristic";
}

export interface PatrolReport {
  flagged: FlaggedComment[];
  /** The false-positive diary: heuristic hits the model read in context and
   * cleared, each with its reason. Shown to the creator so bulk-hide is a
   * decision they can audit, not a black box. */
  cleared: FlaggedComment[];
  videosScanned: number;
  commentsScanned: number;
  verdictSource: "llm" | "heuristic";
}

/* ------------------------------ detectors ------------------------------- */

// The lures scammers can't write around: a way to be contacted off-platform.
const CONTACT_RE =
  /\b(what'?s ?app|telegram|signal me|text me|dm me|message me|reach (?:me|out)|contact me)\b|(?:\+|00)\d[\d\s().-]{7,}\d/i;

// The payload: money for nothing. Kept to phrases that essentially never
// appear in honest comments, so this can fire on its own.
const MONEY_RE =
  /\b(crypto|bitcoin|btc|forex|binary options?|invest(?:ment|ing)? (?:with|in|now)|trading signals?|profit(?:s|ed)? (?:of|over|weekly|daily)|financial advisor|broker(?:age)? (?:mrs?|miss|expert)|made \$?\d[\d,]*|earn(?:ed)? \$?\d[\d,]* (?:daily|weekly|in)|giveaway.{0,30}(claim|winner|selected)|you (?:have been|were|are) (?:selected|chosen)|claim your (?:prize|reward)|cash ?app me)\b/i;

const LINK_RE = /https?:\/\/(?!(?:www\.)?youtu(?:\.be|be\.com))[^\s]+/i;

// Scam display names lean on Unicode's "mathematical alphanumeric" and
// fullwidth blocks to look bold/fancy and dodge string filters. Written as a
// surrogate pair so it compiles without the ES2015+ `u` flag.
const STYLED_UNICODE_RE = /\uD835[\uDC00-\uDFFF]|[Ａ-ｚ]/;

/**
 * Lowercase and strip everything that isn't a letter or digit, folding the
 * styled-unicode letters back to ASCII first — "𝐓𝐞𝐜𝐡 𝐖𝐨𝐫𝐥𝐝✅" and "Tech World"
 * must normalize to the same string for the impersonation check to work.
 */
export function normalizeName(name: string): string {
  const folded = Array.from(name)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      // Mathematical alphanumerics: 26-letter runs of A–Z then a–z variants.
      if (cp >= 0x1d400 && cp <= 0x1d7ff) {
        const offset = (cp - 0x1d400) % 52;
        return String.fromCharCode(offset < 26 ? 65 + offset : 97 + (offset - 26));
      }
      // Fullwidth forms map straight down onto ASCII.
      if (cp >= 0xff21 && cp <= 0xff5a) return String.fromCharCode(cp - 0xfee0);
      return ch;
    })
    .join("");
  return folded.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * An impersonator is a commenter whose display name collapses to the channel's
 * name (or contains it) but whose channel id is not the creator's. The real
 * creator replying in their own thread must never be flagged, which is why the
 * id check is the gate rather than the name.
 */
export function looksLikeImpersonator(
  comment: Comment,
  channelTitle: string,
  ownerChannelId: string
): boolean {
  if (comment.authorChannelId && comment.authorChannelId === ownerChannelId) return false;
  const author = normalizeName(comment.author);
  const owner = normalizeName(channelTitle);
  if (!author || !owner || owner.length < 4) return false;
  return author === owner || author.includes(owner);
}

export interface DetectContext {
  channelTitle: string;
  ownerChannelId: string;
  /** Comment text → how many distinct videos it appeared on, for the paste-bot check. */
  textFrequency?: Map<string, number>;
}

export function detectReasons(comment: Comment, ctx: DetectContext): FlagReason[] {
  const reasons: FlagReason[] = [];
  const text = comment.text;

  if (looksLikeImpersonator(comment, ctx.channelTitle, ctx.ownerChannelId)) reasons.push("impersonation");
  if (CONTACT_RE.test(text)) reasons.push("contact_lure");
  if (MONEY_RE.test(text)) reasons.push("money_bait");
  if (LINK_RE.test(text)) reasons.push("link_spam");
  if ((ctx.textFrequency?.get(dedupeKey(text)) ?? 0) >= 2 && text.length >= 30) {
    reasons.push("repeated_across_videos");
  }
  if (STYLED_UNICODE_RE.test(comment.author)) reasons.push("styled_unicode");

  return reasons;
}

export function dedupeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
}

const WEIGHT: Record<FlagReason, number> = {
  impersonation: 0.55,
  contact_lure: 0.45,
  money_bait: 0.45,
  link_spam: 0.25,
  repeated_across_videos: 0.4,
  styled_unicode: 0.2,
};

export function scoreReasons(reasons: FlagReason[]): number {
  return Math.min(1, reasons.reduce((s, r) => s + WEIGHT[r], 0));
}

/** A single weak signal isn't worth a creator's click; two, or one strong one, is. */
export const FLAG_THRESHOLD = 0.4;

export interface VideoCommentSet {
  videoId: string;
  videoTitle: string;
  comments: Comment[];
}

function heuristicVerdict(reasons: FlagReason[]): { verdict: "scam" | "spam"; explanation: string } {
  const scammy = reasons.some((r) => r === "impersonation" || r === "contact_lure" || r === "money_bait");
  return {
    verdict: scammy ? "scam" : "spam",
    explanation: reasons.map((r) => REASON_LABEL[r]).join(". "),
  };
}

/** The pure sweep: every comment through the detectors, flagged ones out. */
export function sweep(sets: VideoCommentSet[], channelTitle: string, ownerChannelId: string): {
  candidates: FlaggedComment[];
  commentsScanned: number;
} {
  // Count identical texts across videos first, so the paste-bot detector can
  // see the whole sweep rather than one comment section at a time.
  const textFrequency = new Map<string, number>();
  for (const set of sets) {
    const seenHere = new Set<string>();
    for (const c of set.comments) {
      const key = dedupeKey(c.text);
      if (seenHere.has(key)) continue;
      seenHere.add(key);
      textFrequency.set(key, (textFrequency.get(key) ?? 0) + 1);
    }
  }

  const ctx: DetectContext = { channelTitle, ownerChannelId, textFrequency };
  const candidates: FlaggedComment[] = [];
  let commentsScanned = 0;
  for (const set of sets) {
    for (const c of set.comments) {
      commentsScanned++;
      const reasons = detectReasons(c, ctx);
      const score = scoreReasons(reasons);
      if (score < FLAG_THRESHOLD) continue;
      const { verdict, explanation } = heuristicVerdict(reasons);
      candidates.push({
        comment: c,
        videoId: set.videoId,
        videoTitle: set.videoTitle,
        reasons,
        score,
        verdict,
        explanation,
        verdictSource: "heuristic",
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return { candidates, commentsScanned };
}

/** Coerce the LLM's verdicts back onto the candidates we handed it, by index only. */
export function applyVerdicts(candidates: FlaggedComment[], raw: any): FlaggedComment[] {
  const verdicts = Array.isArray(raw?.verdicts) ? raw.verdicts : [];
  const out = candidates.map((c) => ({ ...c }));
  for (const v of verdicts) {
    const idx = Number(v?.index);
    if (!Number.isInteger(idx) || idx < 1 || idx > out.length) continue;
    const verdict = typeof v?.verdict === "string" ? v.verdict.toLowerCase() : "";
    if (verdict !== "scam" && verdict !== "spam" && verdict !== "clean") continue;
    const target = out[idx - 1];
    target.verdict = verdict;
    target.verdictSource = "llm";
    if (typeof v?.reason === "string" && v.reason.trim()) {
      target.explanation = v.reason.trim().slice(0, 300);
    }
  }
  return out;
}

/**
 * Full patrol: heuristics find the candidates, the model (when configured)
 * reads each in context and can overturn to "clean". Candidates the model
 * clears are dropped from the report — the point is a list worth acting on.
 */
export async function runPatrol(
  sets: VideoCommentSet[],
  channelTitle: string,
  ownerChannelId: string
): Promise<PatrolReport> {
  const { candidates, commentsScanned } = sweep(sets, channelTitle, ownerChannelId);
  let judged = candidates;
  let verdictSource: "llm" | "heuristic" = "heuristic";

  const config = getLLMConfig();
  if (config && candidates.length > 0) {
    try {
      const raw = await chatJSON(config, SYSTEM_PROMPT, moderationPrompt(channelTitle, candidates));
      judged = applyVerdicts(candidates, raw);
      verdictSource = "llm";
    } catch (err) {
      console.error("Patrol LLM verdict failed, keeping heuristic verdicts:", err);
    }
  }

  return {
    flagged: judged.filter((c) => c.verdict !== "clean"),
    cleared: judged.filter((c) => c.verdict === "clean"),
    videosScanned: sets.length,
    commentsScanned,
    verdictSource,
  };
}

/* -------------------------------- writes -------------------------------- */

export type ModerationStatus = "rejected" | "heldForReview" | "published";

export interface ModerationResult {
  commentId: string;
  status: "applied" | "failed" | "dry_run" | "simulated";
  message: string;
}

/**
 * comments.setModerationStatus, one comment at a time so a single failure
 * (already deleted, say) doesn't abort the rest of the batch. The endpoint
 * only works on videos the authorized channel owns — YouTube enforces that
 * server-side, and the patrol only ever scans the connected channel's own
 * uploads anyway.
 */
export async function setModerationStatus(
  accessToken: string,
  commentIds: string[],
  status: ModerationStatus,
  dryRun: boolean
): Promise<ModerationResult[]> {
  const verb =
    status === "rejected" ? "hidden from the video" : status === "heldForReview" ? "held for review" : "restored";

  if (dryRun) {
    return commentIds.map((commentId) => ({
      commentId,
      status: "dry_run",
      message: `Would be ${verb}. Nothing was sent to YouTube.`,
    }));
  }

  const results: ModerationResult[] = [];
  for (const commentId of commentIds) {
    try {
      await ytAuthedWrite(accessToken, "comments/setModerationStatus", { id: commentId, moderationStatus: status }, undefined);
      results.push({ commentId, status: "applied", message: `Comment ${verb}.` });
    } catch (err) {
      results.push({
        commentId,
        status: "failed",
        message: err instanceof Error ? err.message : "YouTube refused the change.",
      });
    }
  }
  return results;
}

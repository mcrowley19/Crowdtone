import { detectReasons, scoreReasons, FLAG_THRESHOLD, REASON_LABEL, type DetectContext, type FlagReason } from "./moderation";
import { formatTimestamp } from "./chapters";
import type { Comment } from "./types";

/**
 * The live premiere co-pilot's brain. Everything here is deterministic:
 * scam triage reuses the exact detector the patrol uses, question detection
 * is the same heuristic the reply drafter trusts, and "chat lit up" is
 * arithmetic over message timestamps. A model is only ever optional garnish
 * on top (drafting spoken answers); the co-pilot itself is code.
 */

export interface ChatMessage {
  id: string;
  author: string;
  authorChannelId?: string;
  text: string;
  /** Seconds since the premiere started. */
  atSeconds: number;
}

export type TriageKind = "scam" | "question" | "chat";

export interface TriagedMessage extends ChatMessage {
  kind: TriageKind;
  /** Human-readable reasons, only for kind === "scam". */
  reasons: string[];
}

const QUESTION_RE = /\?|^(how|what|why|where|when|which|can|does|did|is|are|will)\b/i;

function asComment(msg: ChatMessage): Comment {
  return {
    id: msg.id,
    author: msg.author,
    authorChannelId: msg.authorChannelId,
    text: msg.text,
    likeCount: 0,
    publishedAt: new Date(0).toISOString(),
  };
}

export function triageMessage(msg: ChatMessage, ctx: DetectContext): TriagedMessage {
  const reasons: FlagReason[] = detectReasons(asComment(msg), ctx);
  if (scoreReasons(reasons) >= FLAG_THRESHOLD) {
    return { ...msg, kind: "scam", reasons: reasons.map((r) => REASON_LABEL[r]) };
  }
  if (QUESTION_RE.test(msg.text.trim()) && msg.text.trim().length >= 10) {
    return { ...msg, kind: "question", reasons: [] };
  }
  return { ...msg, kind: "chat", reasons: [] };
}

export interface QuestionCluster {
  /** The representative (longest) phrasing of the question. */
  text: string;
  authors: string[];
  count: number;
  firstAtSeconds: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "do", "does", "did", "can",
  "will", "you", "your", "this", "that", "it", "of", "to", "in", "on", "for",
  "and", "or", "what", "how", "why", "when", "where", "which", "about",
]);

/** "compiles", "compiling", "compile" must count as the same word. */
function stem(word: string): string {
  return word.replace(/(?:ing|ed|es|s)$/, "") || word;
}

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => !STOPWORDS.has(w))
      .map(stem)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
  );
}

/**
 * The same question asked five ways should reach the creator once, with a
 * count — that's what makes it answerable on air. Two questions cluster when
 * they share half their keywords.
 */
export function clusterQuestions(questions: TriagedMessage[]): QuestionCluster[] {
  const clusters: (QuestionCluster & { words: Set<string> })[] = [];
  for (const q of questions) {
    const words = keywords(q.text);
    let home = null as (typeof clusters)[number] | null;
    for (const cluster of clusters) {
      const shared = [...words].filter((w) => cluster.words.has(w)).length;
      const denom = Math.min(words.size, cluster.words.size) || 1;
      if (shared / denom >= 0.28 && shared >= 2) {
        home = cluster;
        break;
      }
    }
    if (home) {
      home.count++;
      if (!home.authors.includes(q.author)) home.authors.push(q.author);
      if (q.text.length > home.text.length) home.text = q.text;
      for (const w of words) home.words.add(w);
    } else {
      clusters.push({
        text: q.text,
        authors: [q.author],
        count: 1,
        firstAtSeconds: q.atSeconds,
        words,
      });
    }
  }
  return clusters
    .sort((a, b) => b.count - a.count || a.firstAtSeconds - b.firstAtSeconds)
    .map(({ words: _words, ...cluster }) => cluster);
}

export interface ChatSpike {
  atSeconds: number;
  /** Messages inside the spike window. */
  count: number;
  /** How many times the room's normal rate this is. */
  ratio: number;
  /** A message from the middle of the burst — what everyone was reacting to. */
  sample: string;
}

/**
 * "Chat lit up at 10:20" is a moment worth clipping. A spike is a window
 * whose message rate beats the stream's own median by 2.5× — the stream is
 * its own baseline, exactly like the retention dip detector.
 */
export function detectSpikes(messages: ChatMessage[], windowSeconds = 30): ChatSpike[] {
  if (messages.length < 8) return [];
  const end = Math.max(...messages.map((m) => m.atSeconds));
  const windowCount = Math.floor(end / windowSeconds) + 1;
  const windows: ChatMessage[][] = Array.from({ length: windowCount }, () => []);
  for (const m of messages) {
    windows[Math.min(windowCount - 1, Math.floor(m.atSeconds / windowSeconds))].push(m);
  }
  const counts = windows.map((w) => w.length).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] || 1;

  const spikes: ChatSpike[] = [];
  windows.forEach((window, i) => {
    const ratio = window.length / Math.max(1, median);
    if (window.length >= 4 && ratio >= 2.5) {
      const sample = window[Math.floor(window.length / 2)];
      const last = spikes[spikes.length - 1];
      // Adjacent hot windows are one moment, not two.
      if (last && i * windowSeconds - last.atSeconds <= windowSeconds) {
        last.count += window.length;
        last.ratio = Math.max(last.ratio, Math.round(ratio * 10) / 10);
        return;
      }
      spikes.push({
        atSeconds: i * windowSeconds,
        count: window.length,
        ratio: Math.round(ratio * 10) / 10,
        sample: sample.text.slice(0, 120),
      });
    }
  });
  return spikes;
}

export interface PremiereRecap {
  messagesSeen: number;
  questions: QuestionCluster[];
  hidden: TriagedMessage[];
  spikes: ChatSpike[];
  /** The spikes rewritten as a cut list, same shape of promise as the Shorts finder. */
  clipNotes: string[];
}

export function buildPremiereRecap(triaged: TriagedMessage[]): PremiereRecap {
  const spikes = detectSpikes(triaged);
  return {
    messagesSeen: triaged.length,
    questions: clusterQuestions(triaged.filter((m) => m.kind === "question")),
    hidden: triaged.filter((m) => m.kind === "scam"),
    spikes,
    clipNotes: spikes.map(
      (s) =>
        `${formatTimestamp(s.atSeconds)} — chat ran ${s.ratio}× its normal speed (${s.count} messages). ` +
        `Mid-burst message: “${s.sample}”. Cut from ~${formatTimestamp(Math.max(0, s.atSeconds - 20))}.`
    ),
  };
}

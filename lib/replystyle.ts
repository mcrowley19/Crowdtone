/**
 * "Reply as me": learn how a creator actually writes from their own past
 * replies, then (a) describe that voice to the model and (b) enforce it in
 * code after the model answers. The profile itself is pure measurement — no
 * LLM anywhere in this file — so the same replies always produce the same
 * profile, and the guards run even when the model ignores the instructions.
 */

export interface StyleProfile {
  /** How many replies the profile was learned from. */
  sampleSize: number;
  medianLength: number;
  /** Emoji per reply, e.g. 0 for a creator who never uses them. */
  emojiRate: number;
  topEmoji: string[];
  /** Share of replies ending in "!". */
  exclaimRate: number;
  /** Share of replies opening with a greeting/thanks ("hey", "thanks", …). */
  greetingRate: number;
  /** Share of replies starting lowercase — the casual-typing signal. */
  lowercaseRate: number;
  usesEmDash: boolean;
  /** A closing line used in ≥30% of replies ("Cheers", "– Mike"), if any. */
  signoff?: string;
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const GREETING_RE = /^(hey|hi|hello|thanks|thank you|appreciate|glad|good question|ha+h?a)/i;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Needs at least 3 replies to say anything; below that, returns null and the
 * caller drafts in a neutral voice — honestly, rather than from a fake profile. */
export function buildStyleProfile(replies: string[]): StyleProfile | null {
  const texts = replies.map((r) => r.trim()).filter((r) => r.length >= 2);
  if (texts.length < 3) return null;

  const emojiCounts = new Map<string, number>();
  let emojiTotal = 0;
  let exclaims = 0;
  let greetings = 0;
  let lowercase = 0;
  let emDashes = 0;
  const lastLines = new Map<string, number>();

  for (const text of texts) {
    for (const match of text.match(EMOJI_RE) ?? []) {
      emojiTotal++;
      emojiCounts.set(match, (emojiCounts.get(match) ?? 0) + 1);
    }
    if (/!\s*$/.test(text)) exclaims++;
    if (GREETING_RE.test(text)) greetings++;
    if (/^[a-z]/.test(text)) lowercase++;
    if (text.includes("—")) emDashes++;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1];
    if (last && last.length <= 24 && lines.length > 1) {
      lastLines.set(last, (lastLines.get(last) ?? 0) + 1);
    }
  }

  const signoffEntry = Array.from(lastLines.entries())
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count / texts.length >= 0.3);

  return {
    sampleSize: texts.length,
    medianLength: median(texts.map((t) => t.length)),
    emojiRate: Math.round((emojiTotal / texts.length) * 100) / 100,
    topEmoji: Array.from(emojiCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => e),
    exclaimRate: Math.round((exclaims / texts.length) * 100) / 100,
    greetingRate: Math.round((greetings / texts.length) * 100) / 100,
    lowercaseRate: Math.round((lowercase / texts.length) * 100) / 100,
    usesEmDash: emDashes / texts.length >= 0.2,
    signoff: signoffEntry?.[0],
  };
}

/** The profile, written as prompt instructions the model can actually follow. */
export function describeStyleProfile(profile: StyleProfile): string {
  const traits: string[] = [`aim for roughly ${profile.medianLength} characters`];
  traits.push(
    profile.emojiRate >= 0.5
      ? `use at most one emoji, drawn from: ${profile.topEmoji.join(" ")}`
      : "no emoji — this creator doesn't use them in replies"
  );
  if (profile.lowercaseRate >= 0.5) traits.push("casual lowercase openings are their style");
  if (profile.greetingRate >= 0.4) traits.push('often opens with thanks ("thanks!", "good question")');
  if (profile.exclaimRate >= 0.4) traits.push("frequently ends on an exclamation");
  if (profile.usesEmDash) traits.push("uses em dashes mid-sentence");
  if (profile.signoff) traits.push(`signs off with "${profile.signoff}"`);
  return (
    `Match the creator's reply voice, learned from ${profile.sampleSize} of their real replies: ` +
    traits.join("; ") +
    ". Never fabricate facts to sound like them."
  );
}

/**
 * The deterministic half of "reply as me": whatever the model returned,
 * these guards make the text obey the measured profile — emoji stripped for
 * creators who never use them, length brought back into their range, their
 * sign-off appended when they always sign off. Code, not prompt hope.
 */
export function applyStyleGuards(text: string, profile: StyleProfile): string {
  let out = text.trim();

  if (profile.emojiRate < 0.15) {
    out = out.replace(EMOJI_RE, "").replace(/[ \t]{2,}/g, " ").trim();
  }

  const maxLength = Math.max(120, Math.round(profile.medianLength * 2.5));
  if (out.length > maxLength) {
    const slice = out.slice(0, maxLength);
    const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    out = lastSentence > maxLength * 0.4 ? slice.slice(0, lastSentence + 1) : `${slice.trimEnd()}…`;
  }

  if (profile.signoff && !out.endsWith(profile.signoff)) {
    out = `${out}\n${profile.signoff}`;
  }

  return out;
}

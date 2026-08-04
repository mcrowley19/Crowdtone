import type { Analysis, ClusterResult, Comment, Theme, ThemeName, VideoFix, VideoIdea } from "./types";

/**
 * Keyword-based fallback analyzer. Used when no LLM key is configured or the
 * LLM call fails, so the dashboard always produces a usable result.
 */

const PATTERNS: Array<{ name: ThemeName; re: RegExp }> = [
  {
    name: "request",
    re: /\b(please|pls|can you|could you|would love|you should|make a|do a|do more|part 2|part two|next video|tutorial on|cover|react to|review the|more videos|wish you)\b/i,
  },
  {
    name: "complaint",
    re: /\b(clickbait|misleading|click bait|too long|too slow|boring|waste of|disappointed|dislike|annoying|too many ads|can'?t hear|audio is|volume|blurry|wrong|inaccurate|overrated|skip(ped)? half|rambling|dragged)\b/i,
  },
  {
    name: "confusion",
    re: /\b(confus(ed|ing)|don'?t (get|understand)|didn'?t (get|understand)|what does .+ mean|how (did|does|do) (you|that|this)|why (did|does)|unclear|lost me|makes no sense|doesn'?t make sense|am i the only one who doesn'?t)\b/i,
  },
  {
    name: "praise",
    re: /\b(love(d)? (it|this)|great|awesome|amazing|excellent|best|fantastic|incredible|helpful|well done|thank(s| you)|perfect|underrated|quality content|subscribed|banger|goat)\b/i,
  },
];

export function classifyComment(text: string): ThemeName | null {
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

export function clusterHeuristically(comments: Comment[]): ClusterResult {
  const buckets: Record<ThemeName, Comment[]> = {
    praise: [],
    complaint: [],
    request: [],
    confusion: [],
  };
  for (const c of comments) {
    const name = classifyComment(c.text);
    if (name) buckets[name].push(c);
  }
  const themes: Theme[] = (Object.keys(buckets) as ThemeName[]).map((name) => ({
    name,
    count: buckets[name].length,
    top_quotes: buckets[name]
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 5)
      .map((c) => c.text.replace(/\s+/g, " ").slice(0, 200)),
  }));
  const total = comments.length;
  const matched = themes.reduce((n, t) => n + t.count, 0);
  const top = [...themes].sort((a, b) => b.count - a.count)[0];
  return {
    themes,
    summary:
      `Keyword scan of ${total} comments matched ${matched} to a theme; ` +
      `the loudest signal is ${top.name} (${top.count} comments). ` +
      `Add an LLM key in .env.local for deeper clustering.`,
  };
}

function quotesFor(clusters: ClusterResult, name: ThemeName): string[] {
  return clusters.themes.find((t) => t.name === name)?.top_quotes ?? [];
}

export function heuristicAnalysis(comments: Comment[], videoTitle: string): Analysis {
  const clusters = clusterHeuristically(comments);
  const requests = quotesFor(clusters, "request");
  const confusion = quotesFor(clusters, "confusion");
  const complaints = quotesFor(clusters, "complaint");

  const ideas: VideoIdea[] = [
    {
      title: `Answering your top requests after "${videoTitle}"`,
      hook: "You asked, I listened — here's the video the comment section demanded.",
      evidence_quotes: requests.slice(0, 3),
      estimated_interest: requests.length > 3 ? "high" : "medium",
    },
    {
      title: `The follow-up: what I didn't explain in "${videoTitle}"`,
      hook: "A lot of you were confused by one thing in my last video — let's clear it up.",
      evidence_quotes: confusion.slice(0, 3),
      estimated_interest: confusion.length > 2 ? "high" : "medium",
    },
    {
      title: `I read every comment on "${videoTitle}" — here's my response`,
      hook: "The comments on my last video got spicy. Time to respond.",
      evidence_quotes: [...complaints.slice(0, 2), ...requests.slice(3, 4)].filter(Boolean),
      estimated_interest: "medium",
    },
  ];

  const fixes: VideoFix[] = [];
  if (complaints.length > 0) {
    fixes.push({
      issue: "Viewers feel the title/thumbnail oversells the content",
      fix: "Retitle to match what the video actually delivers, and pin a comment acknowledging the feedback.",
      evidence_quote: complaints[0],
    });
  }
  if (confusion.length > 0) {
    fixes.push({
      issue: "A recurring point loses viewers",
      fix: "Add chapters at the confusing section and a pinned comment with a one-paragraph clarification.",
      evidence_quote: confusion[0],
    });
  }
  if (requests.length > 0) {
    fixes.push({
      issue: "Unanswered viewer requests are sitting in the comments",
      fix: "Update the description with an FAQ and link out to the follow-up video once it's live.",
      evidence_quote: requests[0],
    });
  }
  if (fixes.length === 0) {
    fixes.push({
      issue: "No strong complaint signal detected",
      fix: "Double down on what worked — pin the top praise comment and ask viewers what to cover next.",
      evidence_quote: quotesFor(clusters, "praise")[0] ?? "",
    });
  }

  const topComplaint = complaints[0] ?? "Viewers want the title to match the content";
  const thumbnailTexts = [
    "NO CLICKBAIT. REAL RESULTS.",
    "THE HONEST VERSION",
    "EVERYTHING EXPLAINED IN FULL",
  ];

  return { clusters, ideas, fixes, thumbnailTexts, topComplaint, source: "heuristic" };
}

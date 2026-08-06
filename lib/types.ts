export interface Comment {
  id: string;
  author: string;
  /** The commenter's channel id, when the API returned one — how impersonators
   * are told apart from the actual creator replying in their own thread. */
  authorChannelId?: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  description?: string;
  /** Runtime in seconds; 0 when unknown (demo data). */
  durationSeconds?: number;
  categoryId?: string;
  tags?: string[];
  thumbnailUrl: string;
  viewCount: number;
  likeCount?: number;
  commentCount: number;
  publishedAt: string;
  source: "api" | "demo";
}

export type ThemeName = "praise" | "complaint" | "request" | "confusion";

export interface Theme {
  name: ThemeName;
  count: number;
  top_quotes: string[];
}

export interface ClusterResult {
  themes: Theme[];
  summary: string;
}

export interface VideoIdea {
  title: string;
  hook: string;
  evidence_quotes: string[];
  estimated_interest: "high" | "medium";
}

export interface VideoFix {
  issue: string;
  fix: string;
  evidence_quote: string;
}

export interface Analysis {
  clusters: ClusterResult;
  ideas: VideoIdea[];
  fixes: VideoFix[];
  thumbnailTexts: string[];
  topComplaint: string;
  source: "llm" | "heuristic";
  model?: string;
}

export interface ThumbnailVariant {
  dataUrl: string;
  style: string;
  text: string;
  frameSource: "video-frame" | "generated";
}

/* ---- actions: the things AudienceSignal can do to a video, not just say ---- */

export type ActionKind =
  | "retitle"
  | "update_description"
  | "add_chapters"
  | "set_thumbnail"
  | "post_comment"
  | "reply_to_comment"
  | "set_localizations";

export interface ActionPayload {
  /** retitle */
  title?: string;
  /** update_description */
  description?: string;
  /** add_chapters */
  chapters?: { seconds: number; label: string }[];
  /** set_thumbnail — regenerated server-side at apply time from these two. */
  overlayText?: string;
  overlayStyle?: string;
  /** post_comment / reply_to_comment */
  text?: string;
  parentId?: string;
  parentAuthor?: string;
  parentText?: string;
  /** set_localizations — language code → translated packaging. */
  localizations?: Record<string, { title: string; description: string }>;
  /** BCP-47 code to set as snippet.defaultLanguage when the video has none. */
  detectedLanguage?: string;
}

export interface ProposedAction {
  id: string;
  kind: ActionKind;
  /** Imperative one-liner: "Retitle the video". */
  label: string;
  rationale: string;
  evidence?: string;
  /** Human-readable before/after for the diff shown before anything is applied. */
  before?: string;
  after: string;
  payload: ActionPayload;
  source: "llm" | "heuristic";
}

export type UndoTicket =
  | { kind: "restore_snippet"; videoId: string; title: string; description: string }
  | { kind: "delete_comment"; commentId: string }
  | { kind: "restore_thumbnail"; videoId: string; blobId: string }
  | {
      kind: "restore_localizations";
      videoId: string;
      localizations: Record<string, { title: string; description: string }> | null;
    };

export interface ActionResult {
  id: string;
  kind: ActionKind;
  /** "simulated" is the demo dataset's publish: the full pipeline runs and the
   * UI shows the outcome, but nothing is sent to YouTube — and the UI says so. */
  status: "applied" | "failed" | "dry_run" | "simulated";
  message: string;
  /** Deep link to the thing that changed, when there is one. */
  url?: string;
  undo?: UndoTicket;
  /** Set after a real publish: the snippet re-read from YouTube, proving the
   * change landed rather than assuming it. */
  verified?: { title: string; description: string };
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  likeCount: number;
  publishedAt: string;
}

export interface VideoMeta {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount: number;
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

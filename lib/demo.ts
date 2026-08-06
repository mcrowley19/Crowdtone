import demoData from "@/examples/demo_comments.json";
import patrolData from "@/examples/demo_patrol.json";
import type { Comment, VideoMeta } from "./types";

export const DEMO_VIDEO_ID = "DEMO";

export function getDemoVideo(): VideoMeta {
  return demoData.video as VideoMeta;
}

export function getDemoComments(): Comment[] {
  return demoData.comments as Comment[];
}

export function isDemoId(videoId: string): boolean {
  return videoId.toUpperCase() === DEMO_VIDEO_ID;
}

/** The bundled Comment Patrol dataset: a fictional channel with seeded scams. */
export function getDemoPatrolData(): {
  channel: { channelId: string; title: string; handle: string };
  videos: { videoId: string; videoTitle: string; comments: Comment[] }[];
} {
  return patrolData as any;
}

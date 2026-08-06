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

/** The demo video pretends to be 24 minutes long, so the timestamps viewers
 * cite in the bundled comments (8:14, 15:30, 22:10) land inside it. */
export const DEMO_DURATION_SECONDS = 1440;

/**
 * A plausible retention curve for the demo video: the usual steep opening
 * loss, a slow decay, and two engineered cliffs at the moments the bundled
 * comments actually complain about — 8:14 (the battery-figure confusion) and
 * 15:30 (the wrong price chart). The dip detector is not in on the joke: it
 * finds these the same way it finds real ones.
 */
export function getDemoRetentionCurve(): { ratio: number; watchRatio: number }[] {
  const points: { ratio: number; watchRatio: number }[] = [];
  for (let i = 0; i <= 100; i++) {
    const ratio = i / 100;
    let watch = 0.95 - 0.45 * Math.pow(ratio, 0.6); // opening drop + slow decay
    const cliff = (at: number, depth: number) =>
      ratio >= at ? depth / (1 + Math.exp(-(ratio - at) * 120)) : 0;
    watch -= cliff(0.34, 0.09); // 8:14 of 24:00
    watch -= cliff(0.645, 0.07); // 15:30
    points.push({ ratio, watchRatio: Math.max(0.05, Math.round(watch * 1000) / 1000) });
  }
  return points;
}

/** The bundled Comment Patrol dataset: a fictional channel with seeded scams. */
export function getDemoPatrolData(): {
  channel: { channelId: string; title: string; handle: string };
  videos: { videoId: string; videoTitle: string; comments: Comment[] }[];
} {
  return patrolData as any;
}

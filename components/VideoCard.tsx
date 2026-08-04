import type { VideoMeta } from "@/lib/types";

const fmt = new Intl.NumberFormat("en-US");

export function VideoCard({
  video,
  commentCount,
  commentSource,
}: {
  video: VideoMeta;
  commentCount: number | null;
  commentSource: string | null;
}) {
  const sourceNote =
    commentSource === "cache"
      ? "served from local cache"
      : commentSource === "api"
        ? "fetched live from the YouTube API"
        : commentSource === "demo"
          ? "bundled demo dataset"
          : null;

  return (
    <div className="videohead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnailUrl} alt="Current thumbnail" />
      <div>
        <div className="vtitle">
          {video.title}
          {video.source === "demo" && <span className="stamp">Demo data</span>}
        </div>
        <div className="byline">
          {video.channelTitle} &middot; {fmt.format(video.viewCount)} views &middot;{" "}
          {fmt.format(video.commentCount)} comments on YouTube
        </div>
        {commentCount !== null && (
          <div className="byline">
            Analyzed {fmt.format(commentCount)} top-level comments
            {sourceNote ? `, ${sourceNote}.` : "."}
          </div>
        )}
      </div>
    </div>
  );
}

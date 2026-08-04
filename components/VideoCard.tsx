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
  return (
    <div className="card videocard">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnailUrl} alt="Current thumbnail" />
      <div>
        <div className="vtitle">
          {video.title}
          {video.source === "demo" && <span className="badge">demo data</span>}
        </div>
        <div className="vmeta">
          {video.channelTitle} · {fmt.format(video.viewCount)} views ·{" "}
          {fmt.format(video.commentCount)} comments on YouTube
        </div>
        {commentCount !== null && (
          <div className="vmeta" style={{ marginTop: 6 }}>
            <span className="badge neutral">
              {fmt.format(commentCount)} comments analyzed
              {commentSource === "cache" && " (from cache)"}
              {commentSource === "api" && " (live fetch)"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

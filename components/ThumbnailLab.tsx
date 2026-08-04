import type { ThumbnailVariant, VideoMeta } from "@/lib/types";

export function ThumbnailLab({
  video,
  topComplaint,
  variants,
  loading,
  onGenerate,
}: {
  video: VideoMeta;
  topComplaint: string;
  variants: ThumbnailVariant[];
  loading: boolean;
  onGenerate: () => void;
}) {
  return (
    <section className="report">
      <h2>Thumbnail variants</h2>
      <p className="deck">Three redrawn thumbnails that answer the most-liked complaint.</p>
      <p>
        Complaint being addressed: &ldquo;{topComplaint}&rdquo;
      </p>
      <div className="thumbactions">
        <button onClick={onGenerate} disabled={loading}>
          {loading
            ? "Drawing variants, one moment"
            : variants.length
              ? "Redraw the three variants"
              : "Draw three variants from video frames"}
        </button>
      </div>
      <div className="thumbrow">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Current thumbnail" />
          <figcaption>
            <b>Current thumbnail</b> as published on YouTube
          </figcaption>
        </figure>
        {variants.map((v, i) => (
          <figure key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.dataUrl} alt={`Variant ${i + 1}: ${v.text}`} />
            <figcaption>
              <b>Variant {i + 1}.</b> &ldquo;{v.text}&rdquo; &middot;{" "}
              {v.frameSource === "video-frame"
                ? `set on frame ${i + 1} of the video`
                : "set on a drawn background"}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

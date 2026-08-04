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
      <h2>Thumbnail rematch</h2>
      <p className="deck">Current thumbnail vs three redraws that answer the top complaint</p>
      <p className="lede">
        Complaint being addressed: &ldquo;{topComplaint}&rdquo;
      </p>
      <div className="thumbactions">
        <button className="go" onClick={onGenerate} disabled={loading}>
          {loading
            ? "Drawing…"
            : variants.length
              ? "Redraw variants"
              : "Draw 3 variants from video frames"}
        </button>
      </div>
      <div className="thumbrow">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Current thumbnail" />
          <figcaption>
            <b>Current.</b> As published on YouTube
          </figcaption>
        </figure>
        {variants.map((v, i) => (
          <figure key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.dataUrl} alt={`Variant ${i + 1}: ${v.text}`} />
            <figcaption>
              <b>Variant {i + 1}.</b> &ldquo;{v.text}&rdquo; &middot;{" "}
              {v.frameSource === "video-frame" ? `real frame ${i + 1}` : "drawn background"}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

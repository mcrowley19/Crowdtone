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
    <div className="card">
      <div className="cardhead">
        <h2>
          Thumbnail lab
          <span className="sub">variants that answer the top complaint</span>
        </h2>
        <button className="btn small primary" onClick={onGenerate} disabled={loading}>
          {loading ? "Generating…" : variants.length ? "Regenerate thumbnails" : "Generate thumbnails"}
        </button>
      </div>
      <div className="summarybox">
        Top complaint being addressed: “{topComplaint}”
      </div>
      <div className="thumbgrid">
        <div className="thumbcell">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Current thumbnail" />
          <div className="tlabel">
            <strong>Current</strong>
          </div>
        </div>
        {loading &&
          !variants.length &&
          [0, 1, 2].map((i) => (
            <div className="thumbcell" key={i}>
              <div className="skeleton" style={{ aspectRatio: "16/9" }} />
              <div className="tlabel">Rendering…</div>
            </div>
          ))}
        {variants.map((v, i) => (
          <div className="thumbcell" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.dataUrl} alt={`Variant ${i + 1}: ${v.text}`} />
            <div className="tlabel">
              <strong>“{v.text}”</strong>
              <span>{v.frameSource === "video-frame" ? `frame ${i + 1}` : "generated bg"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

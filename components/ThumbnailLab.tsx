import type { ThumbnailVariant, VideoMeta } from "@/lib/types";
import { Panel } from "@/components/Panel";

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
    <Panel
      title="Thumbnail rematch"
      chip="Backgrounds: YouTube preview stills"
      actions={
        <button className="go" onClick={onGenerate} disabled={loading}>
          {loading ? "Drawing…" : variants.length ? "Redraw" : "Draw 3 variants"}
        </button>
      }
    >
      <p className="lede">
        Answering: &ldquo;{topComplaint}&rdquo;
      </p>
      <div className="thumbrow">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnailUrl} alt="Current thumbnail" />
          <figcaption>
            <b>Current.</b> As published
          </figcaption>
        </figure>
        {variants.map((v, i) => (
          <figure key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.dataUrl} alt={`Variant ${i + 1}: ${v.text}`} />
            <figcaption>
              <b>Variant {i + 1}.</b> &ldquo;{v.text}&rdquo; &middot;{" "}
              {v.frameSource === "yt-still" ? `still ${i + 1}` : "drawn background"}
            </figcaption>
          </figure>
        ))}
      </div>
    </Panel>
  );
}

import { describe, expect, it } from "vitest";
import { buildMarkdownSummary } from "@/lib/markdown";
import { heuristicAnalysis } from "@/lib/heuristic";
import demo from "@/examples/demo_comments.json";
import type { Comment, VideoMeta } from "@/lib/types";

describe("buildMarkdownSummary", () => {
  it("renders every section of the analysis", () => {
    const video = demo.video as VideoMeta;
    const comments = demo.comments as Comment[];
    const analysis = heuristicAnalysis(comments, video.title);
    const md = buildMarkdownSummary(video, analysis, comments.length);

    expect(md).toContain(`# AudienceSignal — ${video.title}`);
    expect(md).toContain("## Comment themes");
    expect(md).toContain("## Next video brief");
    expect(md).toContain("## Fix this video");
    expect(md).toContain("## Thumbnail overlay ideas");
    expect(md).toContain(`**${comments.length}**`);
    expect(md).toContain("keyword heuristic");
  });
});

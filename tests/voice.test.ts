import { describe, expect, it } from "vitest";
import { applyVoiceToDraft, type ActionPlanDraft } from "@/lib/actions";
import { buildStyleProfile } from "@/lib/replystyle";

describe("applyVoiceToDraft", () => {
  const formalVoice = buildStyleProfile([
    "Thank you for pointing that out. The correction is in the description.",
    "The test used the base configuration throughout.",
    "That comparison is planned for a future video.",
  ])!;

  const draft: ActionPlanDraft = {
    chapterLabels: [{ seconds: 60, label: "Setup" }],
    replies: [
      { commentId: "c1", text: "Great question! 😄 It's the base model." },
      { commentId: "c2", text: "Yes! 🔥🔥 Coming next month." },
    ],
    pinnedComment: { text: "Quick clarification 🙏 the chart shows 11 hours.", why: "top confusion" },
    newTitle: { text: "A new title 😄 with emoji", why: "" },
  };

  it("enforces the measured voice on replies and the pinned comment only", () => {
    const voiced = applyVoiceToDraft(draft, formalVoice);
    for (const reply of voiced.replies) expect(reply.text).not.toMatch(/😄|🔥/u);
    expect(voiced.pinnedComment!.text).not.toMatch(/🙏/u);
    // Titles are packaging, not conversation — the voice guard leaves them alone.
    expect(voiced.newTitle!.text).toContain("😄");
    expect(voiced.chapterLabels).toEqual(draft.chapterLabels);
  });

  it("keeps reply targets intact", () => {
    const voiced = applyVoiceToDraft(draft, formalVoice);
    expect(voiced.replies.map((r) => r.commentId)).toEqual(["c1", "c2"]);
  });
});

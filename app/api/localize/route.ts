import { NextRequest, NextResponse } from "next/server";
import { draftLocalizations, pickTargetLanguages, LANGUAGE_NAME } from "@/lib/localize";
import { getLLMConfig } from "@/lib/llm";
import type { ProposedAction, VideoMeta } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Drafts translated packaging for a video. Pure preview: the write happens
 * later through /api/actions/apply, which enforces ownership and the
 * explicit-confirm contract like every other change.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const video: VideoMeta | null = body?.video && typeof body.video === "object" ? body.video : null;
  const countries: { country: string; views: number }[] = Array.isArray(body?.countries)
    ? body.countries
    : [];

  if (!video?.videoId || !video?.title) {
    return NextResponse.json({ error: "No video to localize." }, { status: 400 });
  }
  if (!getLLMConfig()) {
    return NextResponse.json(
      {
        error:
          "Translating metadata needs an LLM key (OPENROUTER_API_KEY or OPENAI_API_KEY) — the keyword heuristic can't write Spanish.",
        code: "no_llm",
      },
      { status: 400 }
    );
  }

  const languages = pickTargetLanguages(countries, "", 4);
  try {
    const draft = await draftLocalizations(video, languages);
    if (!draft) {
      return NextResponse.json({ error: "The model returned no usable translations." }, { status: 502 });
    }
    // A Spanish video doesn't need a Spanish "translation" — drop the target
    // that matches the language the model detected the video is already in.
    if (draft.detectedLanguage) {
      const base = draft.detectedLanguage.split("-")[0];
      draft.localizations = draft.localizations.filter((l) => l.language.split("-")[0] !== base);
      if (draft.localizations.length === 0) {
        return NextResponse.json(
          { error: "Every target language matched the video's own language — nothing to localize." },
          { status: 400 }
        );
      }
    }

    const codes = draft.localizations.map((l) => l.language);
    const names = draft.localizations.map((l) => l.languageName).join(", ");
    const action: ProposedAction = {
      id: "set_localizations",
      kind: "set_localizations",
      label: `Publish the packaging in ${names}`,
      rationale:
        countries.length > 0
          ? "These are the languages this video's own audience watches in, from its Analytics geography."
          : "The biggest YouTube audiences beyond this video's language — Analytics wasn't available to narrow it.",
      before: "Title and description exist only in the original language.",
      after: draft.localizations.map((l) => `${l.languageName}: “${l.title}”`).join("\n"),
      payload: {
        localizations: Object.fromEntries(
          draft.localizations.map((l) => [l.language, { title: l.title, description: l.description }])
        ),
        ...(draft.detectedLanguage ? { detectedLanguage: draft.detectedLanguage } : {}),
      },
      source: "llm",
    };

    return NextResponse.json({
      languages: codes.map((c) => ({ code: c, name: LANGUAGE_NAME[c] ?? c })),
      localizations: draft.localizations,
      detectedLanguage: draft.detectedLanguage,
      action,
    });
  } catch (err) {
    console.error("Localization draft failed:", err);
    return NextResponse.json({ error: "Translation failed — try again." }, { status: 502 });
  }
}

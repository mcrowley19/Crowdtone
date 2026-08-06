import { chatJSON, getLLMConfig } from "./llm";
import { SYSTEM_PROMPT, localizePrompt } from "./prompts";
import type { VideoMeta } from "./types";

/**
 * Localization autopilot: YouTube shows a video's title and description in
 * the viewer's language when the video carries `localizations` — but almost
 * nobody fills them in, because Studio buries the form one language at a
 * time. This module picks the languages the video's own audience watches in
 * (from Analytics geography), has the model translate the packaging, and
 * hands the result to videos.update as one reviewable action.
 */

/** Where a video's viewers are → the language to package it in. */
const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  US: "en", GB: "en", AU: "en", CA: "en", IE: "en", NZ: "en",
  IN: "hi", PK: "ur", BD: "bn",
  BR: "pt", PT: "pt",
  MX: "es", ES: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr",
  JP: "ja", KR: "ko", CN: "zh-Hans", TW: "zh-Hant", HK: "zh-Hant",
  ID: "id", VN: "vi", TH: "th", PH: "en", MY: "ms",
  RU: "ru", UA: "uk", PL: "pl", NL: "nl", IT: "it", TR: "tr",
  SA: "ar", EG: "ar", AE: "ar", MA: "ar",
  SE: "sv", NO: "no", DK: "da", FI: "fi", GR: "el", CZ: "cs", RO: "ro", HU: "hu",
  NG: "en", KE: "en", ZA: "en", IL: "he",
};

export const LANGUAGE_NAME: Record<string, string> = {
  en: "English", hi: "Hindi", ur: "Urdu", bn: "Bengali", pt: "Portuguese", es: "Spanish",
  de: "German", fr: "French", ja: "Japanese", ko: "Korean", "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)", id: "Indonesian", vi: "Vietnamese", th: "Thai",
  ms: "Malay", ru: "Russian", uk: "Ukrainian", pl: "Polish", nl: "Dutch", it: "Italian",
  tr: "Turkish", ar: "Arabic", sv: "Swedish", no: "Norwegian", da: "Danish", fi: "Finnish",
  el: "Greek", cs: "Czech", ro: "Romanian", hu: "Hungarian", he: "Hebrew",
};

/** When Analytics can't say where the audience is, the web's biggest YouTube
 * audiences outside English are a sane default. */
export const FALLBACK_LANGUAGES = ["es", "hi", "pt"];

/**
 * Top watch-time geographies → target languages, most-watched first, minus
 * the language the video is already in.
 */
export function pickTargetLanguages(
  countries: { country: string; views: number }[],
  defaultLanguage: string,
  max = 4
): string[] {
  const base = (defaultLanguage || "en").split("-")[0];
  const out: string[] = [];
  for (const { country } of countries) {
    const lang = LANGUAGE_BY_COUNTRY[country.toUpperCase()];
    if (!lang || lang.split("-")[0] === base) continue;
    if (!out.includes(lang)) out.push(lang);
    if (out.length >= max) break;
  }
  if (out.length === 0) {
    return FALLBACK_LANGUAGES.filter((l) => l.split("-")[0] !== base).slice(0, max);
  }
  return out;
}

export interface Localization {
  language: string;
  languageName: string;
  title: string;
  description: string;
}

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 5000;

function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Only the languages we asked for come back, and each must carry a real
 * title. YouTube's limits apply per localization exactly as they do to the
 * original snippet.
 */
export function validateLocalizations(raw: any, requested: string[]): Localization[] {
  const map = raw?.localizations;
  if (!map || typeof map !== "object") return [];
  const out: Localization[] = [];
  for (const language of requested) {
    const entry = (map as any)[language];
    const title = typeof entry?.title === "string" ? entry.title.trim() : "";
    const description = typeof entry?.description === "string" ? entry.description.trim() : "";
    if (!title) continue;
    out.push({
      language,
      languageName: LANGUAGE_NAME[language] ?? language,
      title: clamp(title, MAX_TITLE),
      description: clamp(description, MAX_DESCRIPTION),
    });
  }
  return out;
}

/** Detected source language for snippet.defaultLanguage, when the model is sure. */
export function validateDetectedLanguage(raw: any): string | null {
  const lang = typeof raw?.detected_language === "string" ? raw.detected_language.trim() : "";
  return /^[a-z]{2}(-[A-Za-z]{2,8})?$/.test(lang) ? lang : null;
}

export interface LocalizeDraft {
  localizations: Localization[];
  detectedLanguage: string | null;
}

export async function draftLocalizations(
  video: VideoMeta,
  languages: string[]
): Promise<LocalizeDraft | null> {
  const config = getLLMConfig();
  if (!config || languages.length === 0) return null;
  const raw = await chatJSON(config, SYSTEM_PROMPT, localizePrompt(video, languages));
  const localizations = validateLocalizations(raw, languages);
  if (localizations.length === 0) return null;
  return { localizations, detectedLanguage: validateDetectedLanguage(raw) };
}

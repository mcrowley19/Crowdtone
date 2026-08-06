import { describe, expect, it } from "vitest";
import {
  FALLBACK_LANGUAGES,
  pickTargetLanguages,
  validateDetectedLanguage,
  validateLocalizations,
} from "@/lib/localize";

describe("pickTargetLanguages", () => {
  it("maps top geographies to languages, most-watched first, without duplicates", () => {
    const countries = [
      { country: "US", views: 1000 },
      { country: "IN", views: 800 },
      { country: "MX", views: 600 },
      { country: "ES", views: 500 },
      { country: "BR", views: 400 },
    ];
    expect(pickTargetLanguages(countries, "en")).toEqual(["hi", "es", "pt"]);
  });

  it("excludes the video's own language family", () => {
    const countries = [
      { country: "BR", views: 900 },
      { country: "PT", views: 500 },
      { country: "US", views: 300 },
    ];
    expect(pickTargetLanguages(countries, "pt-BR")).toEqual(["en"]);
  });

  it("caps at max and preserves view order", () => {
    const countries = ["IN", "BR", "MX", "DE", "JP", "KR"].map((c, i) => ({
      country: c,
      views: 100 - i,
    }));
    expect(pickTargetLanguages(countries, "en", 4)).toEqual(["hi", "pt", "es", "de"]);
  });

  it("falls back to the biggest non-English audiences with no geography", () => {
    expect(pickTargetLanguages([], "en")).toEqual(FALLBACK_LANGUAGES);
    expect(pickTargetLanguages([], "es")).toEqual(["hi", "pt"]);
  });

  it("handles unknown countries without crashing", () => {
    expect(pickTargetLanguages([{ country: "ZZ", views: 10 }], "en")).toEqual(FALLBACK_LANGUAGES);
  });
});

describe("validateLocalizations", () => {
  it("keeps only requested languages with a real title, clamped to limits", () => {
    const raw = {
      localizations: {
        es: { title: "T".repeat(200), description: "Hola" },
        hi: { title: "", description: "x" },
        fr: { title: "Sneaky extra", description: "" },
      },
    };
    const out = validateLocalizations(raw, ["es", "hi"]);
    expect(out).toHaveLength(1);
    expect(out[0].language).toBe("es");
    expect(out[0].languageName).toBe("Spanish");
    expect(out[0].title.length).toBeLessThanOrEqual(100);
  });

  it("returns empty on malformed responses", () => {
    expect(validateLocalizations(null, ["es"])).toEqual([]);
    expect(validateLocalizations({ localizations: "nope" }, ["es"])).toEqual([]);
  });
});

describe("validateDetectedLanguage", () => {
  it("accepts BCP-47 shaped codes and rejects junk", () => {
    expect(validateDetectedLanguage({ detected_language: "en" })).toBe("en");
    expect(validateDetectedLanguage({ detected_language: "pt-BR" })).toBe("pt-BR");
    expect(validateDetectedLanguage({ detected_language: "English please" })).toBeNull();
    expect(validateDetectedLanguage({})).toBeNull();
  });
});

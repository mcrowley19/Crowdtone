# AudienceSignal

**Turn a YouTube comment section into your next video — and a better thumbnail.**

**Live:** https://youtube-automation-sandy.vercel.app — landing page.
**The tool:** https://youtube-automation-sandy.vercel.app/app — the bundled demo runs with no
keys and no account.

Creators get hundreds of comments and no actionable plan. AudienceSignal pulls real comments
from any public YouTube video, clusters what viewers are actually saying, and closes the
feedback loop:

1. **Comment themes** — praise, complaints, requests, confusion, each with counts and the
   top verbatim quotes.
2. **Next Video Brief** — 3 video ideas ranked by demand, each with a ready-to-use title,
   an opening hook, and the comment quotes proving viewers want it.
3. **Fix This Video** — concrete, doable-today fixes for the current video (retitle, pin a
   correction, add chapters), each backed by a quote.
4. **Thumbnail Lab** — generates 3 thumbnail variants from **real frames of the video**
   with overlay text that answers the top viewer complaint, shown side-by-side with the
   current thumbnail.

Not a sentiment dashboard — a plan.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your keys (see below)
npm run dev                  # http://localhost:3000
```

That's it — one runtime, one command. No Python, no yt-dlp, no ffmpeg.

**No keys handy?** Click *"Run the built-in demo dataset"* on the dashboard — the full
pipeline (clustering, brief, fixes, thumbnails) runs on a bundled 50-comment dataset.

## Environment setup

Copy `.env.example` to `.env.local`:

| Variable | Required for | Where to get it |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Live comment fetch | [Google Cloud console](https://console.cloud.google.com/) → create a project → enable **YouTube Data API v3** → Credentials → API key. Reads public data only; no OAuth. |
| `OPENROUTER_API_KEY` *or* `OPENAI_API_KEY` | LLM clustering + briefs | [openrouter.ai/keys](https://openrouter.ai/keys) or [platform.openai.com](https://platform.openai.com/api-keys) |
| `LLM_MODEL` | optional | Defaults to `openai/gpt-4o-mini` (OpenRouter) / `gpt-4o-mini` (OpenAI) |

Without an LLM key the app falls back to a keyword-heuristic analyzer, so it always
produces output. Secrets stay in `.env.local` (gitignored) — never commit keys.

## Using it

1. Paste a YouTube URL (`watch`, `youtu.be`, `shorts`, … all work) or a bare video ID.
   `examples/demo_video_urls.txt` lists good test videos with rich comment sections.
2. Click **Analyze** — video metadata loads, up to 200 top comments are fetched via
   `commentThreads.list`, and the LLM clusters them and drafts the brief (~15s).
3. Click **Generate thumbnails** — the app pulls real frames from the video
   (`i.ytimg.com/vi/<id>/maxres{1,2,3}.jpg`, with sd/hq fallbacks) and composites three
   overlay styles with `sharp`.
4. Export the analysis as JSON or copy a markdown summary for your notes.

`examples/sample_output.json` shows a full end-to-end output.

## Architecture

Next.js 14 (App Router) + TypeScript, one process for UI and API:

```
app/page.tsx            landing page (static)
app/app/page.tsx        dashboard (client)
app/api/video           videos.list → metadata + current thumbnail
app/api/comments        commentThreads.list (≤200, paginated) + disk cache
app/api/analyze         LLM pipeline: cluster → (ideas ∥ fixes ∥ thumbnail texts)
app/api/thumbnails      real frame fetch + sharp SVG compositing → data URLs
lib/                    pure, tested logic (parsing, clustering, prompts, validation)
```

Design choices worth noting:

- **Quota-friendly**: fetched comments are cached in `data/cache/{videoId}.json`; re-runs
  hit the cache, and if YouTube quota dies mid-demo the cache serves as fallback.
- **Every LLM response is validated** and coerced into a strict schema; any failure
  degrades to the heuristic analyzer instead of a broken UI.
- **Thumbnails without heavy deps**: YouTube hosts three real frames of every public video
  at predictable URLs, so frame extraction needs no yt-dlp/ffmpeg — just HTTPS + sharp.

## Tests

```bash
npm test
```

30 vitest smoke tests cover URL/ID parsing, YouTube API response mapping, LLM JSON
parsing + schema validation, heuristic clustering, comment caching (incl. path-traversal
guard), SVG overlay generation, and the markdown exporter.

## API quota notes

A comment analysis costs ~3 units of YouTube's 10,000/day free quota (1 per
`videos.list`, 1 per 100 comments). Caching keeps repeat demos free.

## Deployment

Hosted on Vercel (Next.js, Node runtime, Fluid Compute).

```bash
npm i -g vercel
vercel --prod
```

Two notes specific to running this serverlessly:

- **Comment cache** — `lib/cache.ts` writes to `/tmp` when `VERCEL` is set, since the rest
  of the filesystem is read-only. The cache survives warm invocations, which is the
  repeat-run case it exists for; a cold start simply refetches.
- **Thumbnail fonts** — serverless containers ship no fonts, so librsvg rendered every
  overlay glyph as tofu. `assets/fonts/DejaVuSans-Bold.ttf` is bundled and registered with
  fontconfig at runtime (`lib/fonts.ts`), and `next.config.mjs` force-includes it in the
  `/api/thumbnails` trace because it's loaded by path, not by import.

To enable live video analysis on a deployment, set the keys as environment variables:

```bash
vercel env add YOUTUBE_API_KEY production
vercel env add OPENROUTER_API_KEY production   # or OPENAI_API_KEY
vercel --prod                                  # redeploy to pick them up
```

Without them the deployment still serves the full demo dataset, and without an LLM key it
falls back to the keyword-heuristic analyzer.

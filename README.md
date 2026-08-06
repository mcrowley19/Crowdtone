# AudienceSignal

**Turn a YouTube comment section into your next video — and a better thumbnail.**

**Live:** https://youtube-automation-sandy.vercel.app — landing page.
**The tool:** https://youtube-automation-sandy.vercel.app/app — the bundled demo runs with no
keys and no account.

Creators get hundreds of comments and no actionable plan. AudienceSignal reads the
comments, decides what to change, and — once you connect your channel — makes the changes.

**Fix a video.** Paste any public video:

1. **Comment themes** — praise, complaints, requests, confusion, each with counts and the
   top verbatim quotes.
2. **Next Video Brief** — 3 video ideas ranked by demand, each with a ready-to-use title,
   an opening hook, and the comment quotes proving viewers want it.
3. **Fix This Video** — concrete, doable-today fixes for the current video, each backed by
   a quote.
4. **Thumbnail Lab** — 3 thumbnail variants built from **real frames of the video**, with
   overlay text answering the top complaint, beside the current thumbnail.
5. **Do it** — the same findings as finished copy the app will publish for you: a new
   title, chapters mined from the timestamps viewers left in the comments, a comment
   answering the top confusion, replies to the questions people actually asked, and the new
   thumbnail. Tick the ones you want, preview the exact diff, publish, undo.

**Plan the next one.** Point it at a channel and it reads the last 20 uploads, scores each
against that channel's own median views/day, pulls the comment sections of the recent and
the outperforming ones, and returns a single video specified well enough to film: title and
alternates, the spoken hook, a beat-by-beat outline, a paste-ready description, tags,
thumbnail text, target runtime, a publish date on the channel's own cadence, what not to
repeat — and the numbers and quotes each of those came from.

Not a sentiment dashboard, and not advice. A plan, and the hands to carry it out.

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
| `YOUTUBE_API_KEY` | Reading any public video or channel | [Google Cloud console](https://console.cloud.google.com/) → create a project → enable **YouTube Data API v3** → Credentials → API key. |
| `OPENROUTER_API_KEY` *or* `OPENAI_API_KEY` | LLM clustering, briefs, drafted copy | [openrouter.ai/keys](https://openrouter.ai/keys) or [platform.openai.com](https://platform.openai.com/api-keys) |
| `LLM_MODEL` | optional | Defaults to `openai/gpt-4o-mini` (OpenRouter) / `gpt-4o-mini` (OpenAI) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | **Publishing changes** | Same console → Credentials → **Create OAuth client ID** → Web application → add `<origin>/api/auth/callback` as a redirect URI |
| `OAUTH_REDIRECT_URI` | optional | Only when a proxy rewrites the host; otherwise derived from the request origin |
| `SESSION_SECRET` | optional | Signs the session cookie; defaults to `GOOGLE_CLIENT_SECRET` |

Without an LLM key the app falls back to a keyword-heuristic analyzer, so it always
produces output. Without OAuth it is read-only: it still drafts and previews every change,
it just can't publish. Secrets stay in `.env.local` (gitignored) — never commit keys.

### Connecting a channel

Sign-in requests two scopes: `youtube.readonly` (your uploads and their stats) and
`youtube.force-ssl` (the write endpoints). The tokens live in one HMAC-signed, httpOnly
cookie — there is no database and no server-side session store — and signing out revokes
the grant with Google.

While the OAuth client is unverified, Google shows an "unverified app" screen and only
accounts listed as test users on the consent screen can get through. That's a Google
review step, not something the app can skip.

## Using it

### Fix a video

1. Paste a YouTube URL (`watch`, `youtu.be`, `shorts`, … all work) or a bare video ID.
   `examples/demo_video_urls.txt` lists good test videos with rich comment sections.
2. Click **Analyze** — video metadata loads, up to 200 top comments are fetched via
   `commentThreads.list`, and the LLM clusters them and drafts the brief (~15s).
3. Click **Generate thumbnails** — the app pulls real frames from the video
   (`i.ytimg.com/vi/<id>/maxres{1,2,3}.jpg`, with sd/hq fallbacks) and composites three
   overlay styles with `sharp`.
4. Under **Do it**, click **Draft the changes**. Each proposal shows its before and after,
   the reason, and the comment it came from. Untick anything you don't want.
5. **Preview** shows exactly what would be sent and touches nothing. **Publish** needs a
   connected channel and a second, deliberate confirmation click.
6. Export the analysis as JSON or copy a markdown summary for your notes.

### Plan the next one

Switch to the second tab. Connected, it defaults to your own channel; otherwise paste a
channel URL, `@handle`, or `UC…` ID. It reads the last 20 uploads and the comment sections
of up to five of them (the three most recent plus the outliers), then returns the plan,
the performance notes behind it, and the per-video table it scored.

`examples/sample_output.json` shows a full end-to-end output.

## What it can and can't change

| Action | Endpoint | Undo |
| --- | --- | --- |
| Retitle | `videos.update` | Restores the previous title |
| Rewrite description / add chapters | `videos.update` | Restores the previous description |
| Replace thumbnail | `thumbnails.set` | Re-uploads the previous image, if still cached |
| Post a comment | `commentThreads.insert` | `comments.delete` |
| Reply to a viewer | `comments.insert` | `comments.delete` |

Guardrails, because these are public and permanent:

- Every write re-reads the video first and refuses unless the connected channel owns it —
  replies included, so the tool can't be pointed at a stranger's comment section.
- Publishing is opt-in per request. `/api/actions/apply` previews unless the body carries
  `confirm: true`, and the UI only sends that after a second click on an armed button.
- `videos.update` replaces the whole snippet, so each write starts from the video's current
  snippet and changes only the named field. Nothing gets wiped by omission.
- Replies are addressed by position in the list of questions we handed the model, never by
  a comment id it could invent.
- Chapter timestamps are mined from comments and clamped to the video's real runtime, then
  spaced to YouTube's rules (first at 0:00, 3+ chapters, 10s minimum).
- **Pinning is not in the Data API.** The app posts the comment and says plainly that
  pinning it still takes one click in Studio.

## Architecture

Next.js 14 (App Router) + TypeScript, one process for UI and API:

```
app/page.tsx            landing page (static)
app/app/page.tsx        dashboard (client), two modes
app/api/video           videos.list → metadata, description, runtime, thumbnail
app/api/comments        commentThreads.list (≤200, paginated) + disk cache
app/api/analyze         LLM pipeline: cluster → (ideas ∥ fixes ∥ thumbnail texts)
app/api/thumbnails      real frame fetch + sharp SVG compositing → data URLs
app/api/auth/*          Google OAuth start / callback / session, signed cookie
app/api/actions/plan    analysis → concrete, applyable changes with diffs
app/api/actions/apply   dry run by default; writes only on explicit confirm
app/api/actions/undo    restores a snippet, deletes a comment, puts a thumbnail back
app/api/channel         channel + last 20 uploads + performance metrics
app/api/plan            channel-wide demand + performance → next-video plan
lib/                    pure, tested logic (parsing, clustering, prompts, validation,
                        chapter mining, channel metrics, action building)
```

Design choices worth noting:

- **Quota-friendly**: fetched comments are cached in `data/cache/{videoId}.json`; re-runs
  hit the cache, and if YouTube quota dies mid-demo the cache serves as fallback.
- **Every LLM response is validated** and coerced into a strict schema; any failure
  degrades to the heuristic analyzer instead of a broken UI.
- **Thumbnails without heavy deps**: YouTube hosts three real frames of every public video
  at predictable URLs, so frame extraction needs no yt-dlp/ffmpeg — just HTTPS + sharp.
- **Chapters come from viewers, not guesses**: no transcript is available, but viewers
  timestamp the moments that mattered. `lib/chapters.ts` mines those timestamps, clusters
  ones within 20s of each other, and the model only labels moments it was given.
- **Performance numbers are computed, never generated**: views/day, outlier score against
  the channel's own median, cadence and runtime are calculated in `lib/channel.ts` and
  passed into the prompt as facts, so the plan can't invent a statistic.
- **No auth dependencies**: OAuth, token refresh and the session cookie are ~200 lines of
  `fetch` and `node:crypto`. The dependency list is still next, react, and sharp.

## Tests

```bash
npm test
```

85 vitest tests cover URL/ID and channel parsing, YouTube API response mapping, LLM JSON
parsing + schema validation, heuristic clustering, comment caching (incl. path-traversal
guard), SVG overlay generation, the markdown exporter, timestamp mining and chapter rules,
action validation (including that a reply can only ever target a comment we supplied),
channel metrics, plan validation, and session cookie signing and tampering.

## API quota notes

A single-video analysis costs ~3 units of YouTube's 10,000/day free quota (1 per
`videos.list`, 1 per 100 comments). A channel plan costs ~10 (channel, uploads page, two
video hydrations, and up to five comment fetches). Writes cost 50 each and thumbnail
uploads more, so the quota, not the tool, is the practical limit on how much you publish
in a day. Caching keeps repeat runs free.

## Deployment

Hosted on Vercel (Next.js, Node runtime, Fluid Compute).

```bash
npm i -g vercel
vercel --prod
```

Two notes specific to running this serverlessly:

- **Comment cache** — `lib/cache.ts` writes to `/tmp` when `VERCEL` is set, since the rest
  of the filesystem is read-only. The cache survives warm invocations, which is the
  repeat-run case it exists for; a cold start simply refetches. The thumbnail an undo would
  restore lives in the same place, so undoing a thumbnail is a right-now action — the UI
  says as much if the bytes are gone.
- **Thumbnail fonts** — serverless containers ship no fonts, so librsvg rendered every
  overlay glyph as tofu. `assets/fonts/DejaVuSans-Bold.ttf` is bundled and registered with
  fontconfig at runtime (`lib/fonts.ts`), and `next.config.mjs` force-includes it in the
  `/api/thumbnails` trace because it's loaded by path, not by import.

To enable live video analysis on a deployment, set the keys as environment variables:

```bash
vercel env add YOUTUBE_API_KEY production
vercel env add OPENROUTER_API_KEY production   # or OPENAI_API_KEY
vercel env add GOOGLE_CLIENT_ID production     # optional: enables publishing
vercel env add GOOGLE_CLIENT_SECRET production
vercel --prod                                  # redeploy to pick them up
```

Without them the deployment still serves the full demo dataset, and without an LLM key it
falls back to the keyword-heuristic analyzer. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are
what turn publishing on; leave them unset and the deployment is read-only by construction.
Whichever origin you deploy to needs its `/api/auth/callback` added to the OAuth client's
redirect URIs — including preview URLs, if you want to sign in on one.

# AudienceSignal

**Turn a YouTube comment section into your next video — then let it make the changes.**

[![CI](https://github.com/mcrowley19/youtube-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/mcrowley19/youtube-automation/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-196_passing-black.svg)

**Live:** https://youtube-automation-sandy.vercel.app — landing page.
**The tool:** https://youtube-automation-sandy.vercel.app/app — the bundled demo runs with no
keys and no account.

Creators get hundreds of comments and no actionable plan. AudienceSignal reads the
comments, decides what to change, and — once you connect your channel — makes the changes.

**Fix a video.** Paste any public video:

1. **Comment themes** — praise, complaints, requests, confusion, each with counts and the
   top verbatim quotes.
2. **How the room feels** — every comment scored by a deterministic sentiment lexicon (no
   model) and charted over the life of the thread, bars diverging from neutral, each
   bucket carrying its most polarized comment as the receipt.
3. **Next Video Brief** — 3 video ideas ranked by demand, each with a ready-to-use title,
   an opening hook, and the comment quotes proving viewers want it.
4. **Fix This Video** — concrete, doable-today fixes for the current video, each backed by
   a quote.
5. **Your superfans** — the most invested viewers, ranked by pure arithmetic: showing up,
   likes earned from other viewers, questions asked, timestamps cited. Names, badges,
   and their best comment as the receipt.
6. **The numbers behind it** — for your own videos, the YouTube Analytics API adds the
   audience-retention curve with its sharpest drop-offs marked, and when viewers
   timestamped that exact moment in the comments, the quote that explains the dip. Plus
   traffic sources, watch geography, and subscribers gained.
7. **Cut these into Shorts** — the moments viewers timestamped, ranked and turned into a
   one-click **editor handoff pack**: a marker CSV Premiere/Resolve import directly, a
   CMX3600 EDL with the cuts laid back to back, and a caption pack opening each Short on
   the viewer quote that earned it. This app doesn't render video — it says so — but the
   handoff is one step from a timeline.
8. **Thumbnail Lab** — 3 thumbnail variants built from **the preview stills YouTube
   publishes for the video** (real imagery, YouTube's three picks — not arbitrary frame
   extraction), with
   overlay text answering the top complaint, beside the current thumbnail.
9. **Speak their language** — translates the title and description into the languages the
   video's own audience watches in (from its Analytics geography) and publishes them as
   YouTube localizations — with a slowly turning globe marking where the audience
   actually is and what they speak.
10. **Do it** — the same findings as finished copy the app will publish for you: a new
    title, chapters mined from the timestamps viewers left in the comments, a comment
    answering the top confusion, **replies drafted in the creator's own measured voice**
    ("reply as me": emoji habits, typical length, and sign-offs learned from their real
    replies, then enforced in code after the model drafts), and the new thumbnail. Tick
    the ones you want, preview the exact diff, publish, undo.
11. **State of the Audience** — the whole report folded into one Monday-morning email,
    composed in code from the numbers the report already proved: the mood, the worst
    dip with the comment explaining it, the superfans, and this week's two actions.
    Copy it into any newsletter tool or download it as markdown.

**Plan the next one.** Point it at a channel and it reads the last 20 uploads, scores each
against that channel's own median views/day, pulls the comment sections of the recent and
the outperforming ones, and returns a single video specified well enough to film: title and
alternates, the spoken hook, a beat-by-beat outline, a paste-ready description, tags,
thumbnail text, target runtime, a publish date on the channel's own cadence, what not to
repeat — and the numbers and quotes each of those came from.

**Patrol the comments.** A sweep of your recent uploads for the comments every channel
gets: impersonators wearing your channel's name in styled-unicode fonts, "message me on
WhatsApp" and crypto-broker lures, giveaway bots, links dumped by paste-bots across
several videos at once. Heuristics find the candidates, the model reads each in context
to clear false positives, and the ones you tick are hidden in bulk through
`comments.setModerationStatus` — reversibly, with a "put it back" button per comment.

**Premiere co-pilot.** During a premiere, chat moves faster than any human can triage.
The co-pilot reads it as it comes: questions clustered and counted ("asked 3 times")
for answering on air, scams auto-hidden by the same deterministic detector Comment
Patrol uses (reversibly), and the seconds chat lights up — measured against the
stream's own median pace — timestamped into a clip list before the stream ends,
then a full debrief the second it's over. The demo replays a bundled premiere chat
at 12×, and says so: the triage code is exactly what a live stream would run, only the
transport is canned (a real premiere needs the live-chat API and a stream that is
actually on air, which is why this surface is honest about being a replay).

Not just a sentiment dashboard, and not advice. A plan, and the hands to carry it out.

## Quick start

```bash
npm install
cp .env.example .env.local   # add your keys (see below)
npm run dev                  # http://localhost:3000
```

That's it — one runtime, one command. No Python, no yt-dlp, no ffmpeg.

**No keys handy? Every surface has a bundled demo.** The demo dataset covers the full
loop: analysis, retention dips joined to comment quotes, thumbnails, the Shorts handoff,
localization, a **simulated publish + undo** (clearly labeled, dashed border, nothing sent
to YouTube), the channel plan, and the Comment Patrol sweep.

## What needs what

| Surface | No keys (demo) | `YOUTUBE_API_KEY` | + LLM key | + OAuth |
| --- | --- | --- | --- | --- |
| Comment themes / brief / fixes | bundled dataset, heuristic | any public video | LLM-drafted | — |
| Retention × comments | bundled curve, real dip detector | — | — | own videos, live Analytics |
| Thumbnail Lab | drawn backgrounds | YouTube preview stills | LLM overlay text | publish via `thumbnails.set` |
| Shorts editor handoff | full (CSV/EDL/captions) | any public video | — | — |
| Speak their language | bundled es/pt/hi pack | — | LLM translations | publish localizations |
| Do it (publish + undo) | **simulated**, labeled | — | drafted copy | real writes, verified re-read |
| Plan the next one | bundled 20-upload channel | any public channel | LLM plan | your own channel |
| Comment Patrol | bundled channel, simulated hide | — | LLM clears false positives | real bulk moderation |
| Sentiment chart | full — deterministic lexicon, no model, no keys | — | — | — |
| Superfans | full — pure arithmetic over comments | any public video/channel | — | — |
| Reply as me | bundled reply sample | — | drafts in the measured voice; guards run either way | learns from your real replies in the thread |
| State of the Audience email | full — composed in code | — | — | richer with live analytics |
| Premiere co-pilot | bundled chat replay, real triage code | — | — | — (live chat reading not built — labeled) |

`npm run judge` runs the full gate: typecheck, all unit + integration tests, and a
production build.

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

### Run the model locally — zero tokens, zero cloud

Every LLM call goes through one OpenAI-compatible client, so pointing it at a local
server replaces the cloud entirely — no API key, no per-token cost, and comments never
leave your machine:

```bash
# with Ollama (https://ollama.com — brew install ollama)
ollama pull qwen2.5:7b-instruct        # or llama3.1:8b; 7–8B models fit in ~8 GB RAM
# .env.local:
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
```

`LLM_BASE_URL` outranks any cloud key, so a machine with both configured stays local. It
works with anything speaking the OpenAI chat-completions dialect — Ollama, llama.cpp's
server (`llama-server -m model.gguf`), LM Studio. The client's JSON mode
(`response_format: json_object`) is supported by all three, and every model response is
schema-validated with the heuristic fallback behind it, so a small local model degrades
the same safe way a free cloud model does. Two honest caveats: quality — a 7B model
clusters and drafts noticeably below `gpt-4o-mini`, which is why the validated-or-
fallback pipeline matters; and hosting — the deployed Vercel app can't reach your
localhost, so local models are for running the app locally (`npm run dev`) or
self-hosting, not for the hosted demo. The integration is verified in `tests/llm.test.ts`
against a stub server speaking the exact wire format.

### Connecting a channel

Sign-in requests three scopes: `youtube.readonly` (your uploads and their stats),
`youtube.force-ssl` (the write endpoints), and `yt-analytics.readonly` (retention curves,
traffic sources, geography — enable the **YouTube Analytics API** in the same Cloud
project). The tokens live in one HMAC-signed, httpOnly cookie — there is no database and
no server-side session store — and signing out revokes the grant with Google. Sessions
created before analytics support show a one-line "connect again" note instead of the
numbers.

While the OAuth client is unverified, Google shows an "unverified app" screen and only
accounts listed as test users on the consent screen can get through. That's a Google
review step, not something the app can skip.

## Using it

### Fix a video

1. Paste a YouTube URL (`watch`, `youtu.be`, `shorts`, … all work) or a bare video ID.
   `examples/demo_video_urls.txt` lists good test videos with rich comment sections.
2. Click **Analyze** — video metadata loads, up to 200 top comments are fetched via
   `commentThreads.list`, and the LLM clusters them and drafts the brief (~15s).
3. Click **Generate thumbnails** — the app pulls YouTube's preview stills for the video
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
| Replace thumbnail | `thumbnails.set` | Re-uploads the previous image, which travels **inside the undo ticket** as a data URL — stateless, so it survives serverless cold starts |
| Publish localized title/description | `videos.update` (localizations) | Restores the previous localization map |
| Post a comment | `commentThreads.insert` | `comments.delete` |
| Reply to a viewer | `comments.insert` | `comments.delete` |
| Hide a scam/spam comment | `comments.setModerationStatus` | Sets it back to `published` |

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
app/app/page.tsx        dashboard (client), three modes
app/api/video           videos.list → metadata, description, runtime, thumbnail
app/api/comments        commentThreads.list (≤200, paginated) + disk cache
app/api/analyze         LLM pipeline: cluster → (ideas ∥ fixes ∥ thumbnail texts)
app/api/analytics       YouTube Analytics API: retention (joined with comment
                        timestamps), traffic sources, geography, totals
app/api/thumbnails      real frame fetch + sharp SVG compositing → data URLs
app/api/localize        LLM-translated title/description per audience language
app/api/auth/*          Google OAuth start / callback / session, signed cookie
app/api/actions/plan    analysis → concrete, applyable changes with diffs
app/api/actions/apply   dry run by default; writes only on explicit confirm
app/api/actions/undo    restores snippets, comments, thumbnails, localizations
app/api/patrol/scan     recent uploads → flagged scam/spam comments with reasons
app/api/patrol/moderate bulk setModerationStatus, dry-run-by-default, reversible
app/api/channel         channel + last 20 uploads + performance metrics
app/api/plan            channel-wide demand + performance → next-video plan
lib/                    pure, tested logic (parsing, clustering, prompts, validation,
                        chapter mining, channel metrics, action building, scam
                        detection, retention dip analysis, clip suggestion,
                        localization targeting)
```

Design choices worth noting:

- **Quota-friendly**: fetched comments are cached in `data/cache/{videoId}.json`; re-runs
  hit the cache, and if YouTube quota dies mid-demo the cache serves as fallback.
- **Every LLM response is validated** and coerced into a strict schema; any failure
  degrades to the heuristic analyzer instead of a broken UI.
- **Thumbnails without heavy deps**: YouTube publishes three preview stills of every public
  video at predictable URLs — real imagery from the video, though YouTube picks the three
  moments. No yt-dlp/ffmpeg, just HTTPS + sharp, and the overlay scrim is weighted by the
  measured luminance under the text so type holds contrast on any frame.
- **Chapters come from viewers, not guesses**: no transcript is available, but viewers
  timestamp the moments that mattered. The chapters engine mines those timestamps,
  clusters ones within 20s of each other, and the model only labels moments it was given.
  The same mined moments power the Shorts cut list and explain retention dips. The engine
  is now maintained as its own open-source package,
  [`youtube-chapter-kit`](https://github.com/mcrowley19/youtube-chapter-kit) (zero
  dependencies, MIT, its own test suite and CI) — extracted from this project, and this
  project is its first consumer via `lib/chapters.ts`.
- **Retention dips get explained, not just found**: `lib/analytics.ts` finds where the
  audience actually leaves (drops 3× steeper than the curve's own typical decay, skipping
  the universal opening drop-off), then joins each dip against the comment-mined
  timestamps within ±25s — so "10% leave at 8:24" arrives with the comment that says why.
- **Scam detection is layered**: `lib/moderation.ts` catches the shapes scams can't write
  around — off-platform contact lures, impersonator display names folded back from
  styled-unicode, identical texts pasted across videos — deterministically and with
  tests; the LLM then reads each candidate in context to clear false positives (a real
  viewer citing a source is clean; "message me about crypto" never is). The real creator
  can never be flagged on their own channel: the check is by channel id, not name.
- **Performance numbers are computed, never generated**: views/day, outlier score against
  the channel's own median, cadence and runtime are calculated in `lib/channel.ts` and
  passed into the prompt as facts, so the plan can't invent a statistic.
- **A model only where the job is open-ended; code everywhere else.** Roles deliberately
  kept out of the LLM, because they don't need one: sentiment scoring (`lib/sentiment.ts`,
  lexicon with negation handling), superfan ranking (`lib/superfans.ts`, arithmetic),
  the creator's reply-voice profile (`lib/replystyle.ts`, measured from their real
  replies — and *enforced* in code after the model drafts, so emoji habits, lengths, and
  sign-offs hold even when the model ignores instructions), premiere chat triage and
  spike detection (`lib/premiere.ts`, reusing the patrol's detector; a spike is a window
  beating the stream's own median pace), question de-duplication (stemmed keyword
  clustering), and the State-of-the-Audience email (`lib/digest.ts`, pure string
  building over already-computed numbers). Deterministic means testable: all of it is
  under unit tests, and the same input always produces the same output.
- **No auth dependencies**: OAuth, token refresh and the session cookie are ~200 lines of
  `fetch` and `node:crypto`. The dependency list is still next, react, and sharp — plus
  `youtube-chapter-kit`, which is this project's own chapters engine published as a
  zero-dependency package.

## Tests

```bash
npm test        # 196 tests: unit + route-level integration
npm run judge   # typecheck + full suite + production build
```

134 unit tests cover URL/ID and channel parsing, YouTube API response mapping, LLM JSON
parsing + schema validation, heuristic clustering, comment caching (incl. path-traversal
guard), SVG overlay generation and luminance-weighted scrims, the markdown exporter,
timestamp mining and chapter rules, action validation (including that a reply can only
ever target a comment we supplied), channel metrics, plan validation, session cookie
signing and tampering, scam detection (unicode folding, impersonation-by-id, every lure
pattern, the false-positive cases), retention-curve dip finding and comment joins, clip
suggestion, the editor handoff formats, and localization targeting/validation. The
deterministic feature set added in P7 is covered the same way: sentiment scoring
(negation flips, emoji, empty input, determinism), superfan ranking (cross-video
credit, the owner never ranks, badge arithmetic), reply-voice profiling and its guards
(emoji stripping, sentence-boundary truncation, sign-off idempotency), the audience
digest (structure, dip-first ordering, determinism), premiere triage against the
bundled chat (exactly the three seeded scams, no false positives, both engineered
spikes found by the stream's-own-median rule), and the local-LLM config path, including
a live round-trip against a stub OpenAI-compatible server.

11 integration tests call the real route handlers with the network mocked at the fetch
layer (any unexpected request fails the test): the heuristic analyze path, the bundled
channel plan, the patrol sweep, the retention↔comment join, and the write path end to
end — dry-run sends nothing, demo confirm simulates, an unowned video is refused before
any write, an owned retitle PUTs the right snippet and is re-read for the "verified live"
state, a duplicated requestId gets a 409, and undo restores the exact prior snippet. No
YouTube response is ever invented outside test fixtures. CI runs the typecheck, the
suite, and a production build on every push.

## API quota notes

A single-video analysis costs ~3 units of YouTube's 10,000/day free quota (1 per
`videos.list`, 1 per 100 comments). A channel plan costs ~10 (channel, uploads page, two
video hydrations, and up to five comment fetches); a Comment Patrol sweep ~10 (channel,
uploads, one comment page per video with comments). Analytics API reads use a separate
quota and don't touch these numbers. Writes cost 50 each and thumbnail uploads more, so
the quota, not the tool, is the practical limit on how much you publish in a day. Caching
keeps repeat runs free.

## Deployment

Hosted on Vercel (Next.js, Node runtime, Fluid Compute).

```bash
npm i -g vercel
vercel --prod
```

Two notes specific to running this serverlessly:

- **Comment cache** — `lib/cache.ts` writes to `/tmp` when `VERCEL` is set, since the rest
  of the filesystem is read-only. The cache survives warm invocations, which is the
  repeat-run case it exists for; a cold start simply refetches. **Undo needs no server
  state at all**: every undo ticket carries what it restores — the previous snippet as
  text, the previous thumbnail as a data URL — so undo survives cold starts by
  construction, for as long as the creator keeps the page open.
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

## Security

Dependency posture as of 2026-08-06 (`npm audit`):

- **Fixed by upgrade**: `sharp` → 0.35.x (libvips CVEs — it processes fetched images, so
  this one mattered), `vitest` → 4.x (cleared a dev-only critical in the vitest UI server
  chain plus the esbuild/vite advisories).
- **Fixed by override**: `postcss` (transitive, via `next@14`) is pinned to a patched
  8.5.x via npm `overrides` — the sourceMappingURL/stringify advisories are cleared
  without waiting on the Next major.
- **Known, documented**: `next@14` carries advisories whose fixed versions are the 15/16
  majors. Reviewed individually against this app: it uses no `next/image` optimizer (plain
  `<img>`), no middleware, no rewrites, no i18n Pages Router, no WebSocket upgrades, no
  CSP nonces, and no `beforeInteractive` scripts — the attack surfaces those advisories
  target. The pinned version is a deliberate stability call for the hackathon window, not
  an oversight; the upgrade path is `next@15` after judging.
- Idempotency dedupe for publishes is in-memory per warm serverless instance (documented
  limit); the primary double-publish guard is the armed-button UI plus per-arm request
  ids. Undo tickets are validated server-side (image type + size caps) and every write
  path re-checks channel ownership.

## Contributing & license

MIT — see [LICENSE](LICENSE). Contributions welcome; [CONTRIBUTING.md](CONTRIBUTING.md)
explains the ground rules (pure `lib/`, validated LLM output, sacred write path, degrade
don't die).

The chapters engine is published separately as
[`youtube-chapter-kit`](https://github.com/mcrowley19/youtube-chapter-kit) (MIT, zero
dependencies) so any creator tool can mine viewer-comment timestamps into chapters
YouTube will actually render.

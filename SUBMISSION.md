# AudienceSignal — hackathon submission

**Live deployment:** https://youtube-automation-sandy.vercel.app
**Straight to the tool:** https://youtube-automation-sandy.vercel.app/app *(the demo runs
with no keys and no account — every feature is visible in under a minute)*

## Inspiration

A video lands, hundreds of comments arrive, and the creator scrolls. The feedback is
genuinely valuable — viewers say plainly what confused them, what they want next, where
the title oversold it, even the exact second they lost interest — but it arrives as an
unsorted stream, so almost none of it is acted on. Existing tools stop at a sentiment
score: they tell a creator how people *feel* and nothing about what to *do*. And the
tools that do plan content (vidIQ, 1of10, Spotter Studio) charge $16–69/month and still
hand back a to-do list.

AudienceSignal's premise: the comment section already wrote your next video. Read it
properly, show the evidence, and then — this is the part that matters — **do the work**.

## What it does

**Fix a video.** Paste any public YouTube URL and it returns, with a verbatim viewer
quote under every claim: comment themes with counts; three next-video ideas ranked by
demand; a fix list for the published video; a Shorts cut list built from the timestamps
viewers left ("4:12 killed me" is a free highlight marker); and three thumbnail variants
composited from the preview stills YouTube publishes for the video, overlay text answering the loudest complaint.

**Connect your channel and it stops advising.** The findings become finished copy it
publishes for you through the Data API: a new title, chapters mined from viewer
timestamps, a comment answering the top confusion, replies to real questions, the new
thumbnail — plus your title and description **translated into the languages your
audience actually watches in** (from your Analytics geography) and published as YouTube
localizations. Every change shows its before/after diff and the comment it came from;
everything previews first, publishes only after a second deliberate click, and undoes
from the same screen.

**The numbers meet the words.** For your own videos, the YouTube Analytics API adds the
audience-retention curve with the sharpest drop-offs marked — and when viewers
timestamped that exact moment, the dip arrives *explained*: "10.4% of the audience
leaves at 8:24 — a comment says: 'at 8:14 you said battery lasted 14 hours but the chart
shows 11'." Retention tells you where; the comments tell you why; no other tool joins
the two.

**Comment Patrol.** A sweep of your recent uploads for the plague every channel knows:
impersonators wearing your channel name in styled-unicode fonts, "message me on
WhatsApp" crypto lures, giveaway bots, paste-bots spamming the same link across videos.
Layered detection — deterministic heuristics find candidates (unicode-folding
impersonator names back to ASCII, catching off-platform contact patterns, counting
identical texts across videos), then the LLM reads each in context to clear false
positives. Tick the ones to hide and they're moderated in bulk through
`comments.setModerationStatus`, each with a "put it back" button.

**Plan the next one.** Point it at a channel: last 20 uploads scored against the
channel's own median views/day, comment sections of the recent and outperforming videos
read, and out comes one video specified well enough to film — title, spoken hook,
beat-by-beat outline, paste-ready description, tags, runtime, a publish date on the
channel's own cadence — with computed (never generated) statistics underneath.

## How we built it

Next.js 14 (App Router) + TypeScript, one process for UI and API; the runtime dependency
list is `next`, `react`, `sharp`, and our own `youtube-chapter-kit` — OAuth, token
refresh, session cookies, the YouTube clients, and the LLM client are hand-rolled on
`fetch` and `node:crypto`.

- **YouTube Data API v3**, both directions: `videos.list`, `commentThreads.list`,
  `channels.list`, `playlistItems.list` to read; `videos.update` (snippet *and*
  localizations), `thumbnails.set`, `commentThreads.insert`, `comments.insert`,
  `comments.delete`, `comments.setModerationStatus` to write.
- **YouTube Analytics API v2** for retention curves, traffic sources, geography, and
  subscriber conversion — fetched per-section so one failure never blanks the rest.
- **LLM via OpenRouter or OpenAI** for clustering, drafting, translation, and scam
  verdicts. Every response is schema-validated and coerced; any failure degrades to a
  keyword heuristic, so the tool always produces output. Replies and moderation verdicts
  address comments **by index into the list we supplied** — the model physically cannot
  target a comment it invented.
- **`sharp`** composites overlay text onto the preview stills YouTube publishes at
  predictable URLs — real imagery, YouTube's three picks — with the scrim weighted by
  the measured luminance under the text. No yt-dlp, no ffmpeg, no video download.
- **Open-source contribution**: the chapters engine — extract viewer-comment timestamps,
  cluster them into moments, validate against YouTube's actual rendering rules (0:00
  start, 3+ chapters, 10-second minimum), merge into descriptions idempotently — proved
  useful beyond this app, so we extracted it as
  [`youtube-chapter-kit`](https://github.com/mcrowley19/youtube-chapter-kit): a
  zero-dependency MIT package with its own 27-test suite and CI, and AudienceSignal is
  its first consumer. Any creator tool can now use it instead of shipping chapter lists
  YouTube silently refuses to render.
- **145 vitest tests** — 134 unit plus 11 route-level integration tests that call the
  real handlers with the network mocked at the fetch layer (ownership refusal, dry-run
  no-op, simulated demo publish, verified-live re-read, duplicate-publish 409, exact undo)
  — plus CI (typecheck, suite, production build on every push) and `npm run judge`. MIT
  licensed, with a CONTRIBUTING.md that codifies the safety rules.

## Challenges

- **Writes on a live channel have to be boring.** `videos.update` replaces the whole
  snippet — omit a field and YouTube wipes it. Every write re-reads the video, changes
  only the named field, refuses unless the connected channel owns it, previews by
  default, requires `confirm: true` plus a second UI click, and returns an undo ticket.
- **Retention dips that mean something.** Every video loses viewers constantly; naive
  "steepest drop" finds the opening skid. Dips only count when they fall 3× faster than
  the curve's own typical decay, outside the first 10%, reported at the cliff's midpoint
  — that's what makes the join to comment timestamps land within seconds.
- **Scam detection without defaming viewers.** A fan named after the channel, or a
  viewer linking a source, must never be auto-flagged. Impersonation checks compare
  channel *ids* (never names), YouTube links don't count as link spam, single weak
  signals stay under the flag threshold, and the LLM pass exists specifically to say
  "clean."
- **Serverless rendering details.** Vercel containers ship no fonts, so thumbnail text
  rendered as tofu — fixed by bundling DejaVu Sans Bold and registering it with
  fontconfig at runtime.

## Accomplishments we're proud of

The demo is the argument: paste a comment section, and a minute later the retention dip
has a quote explaining it, the thumbnail is redrawn on the video's own preview stills, the
scams are gone, the packaging exists in four languages — and every single claim on
screen carries the comment that justifies it. Zero-key demo mode means a judge sees all
of it in the first minute without creating anything.

And one piece outlived the hackathon before the hackathon even ended: the comment-mined
chapters engine is now [`youtube-chapter-kit`](https://github.com/mcrowley19/youtube-chapter-kit),
an open-source, zero-dependency package any creator tool can use — with AudienceSignal
as its first production consumer.

## What we learned

The gap between "insight" and "done" is where creator tools die. Closing it safely —
ownership checks, diffs, confirms, undo — turned out to be more design work than the AI,
and it's what makes automation on someone's real channel trustworthy rather than scary.

## What's next

Thumbnail A/B rotation with CTR readback once YouTube exposes impressions to the
Analytics API; a weekly patrol digest; transcript-aware chapter labels.

## The 90-second judge path

Open **/app** (no keys, no account — every step below is the bundled demo):

1. **Fix a video** tab → *"Run the report on the bundled demo dataset."* Themes land with
   verbatim quotes.
2. Scroll to **The numbers behind it** — the retention curve drops 10% at 8:24 and the
   comment explaining it sits under the dip, with a concrete edit action.
3. **Cut these into Shorts** → *Download the editor handoff pack* — a real marker CSV,
   EDL, and caption pack hit your downloads.
4. **Do it** → *Draft the changes* → tick → **Simulated publish (demo)** → confirm →
   every action lands with a dashed "Simulated" badge → **Undo this (simulated)**. The
   exact loop a real channel gets, clearly labeled, nothing sent to YouTube.
5. **Speak their language** → *Draft the translations* — the bundled es/pt/hi pack.
6. **Plan the next one** tab → *"Plan the bundled demo channel"* — 20 uploads scored
   against their own median, one filmable video out.
7. **Patrol the comments** tab → *"Run the patrol on the bundled demo channel"* — the
   impersonator in the styled-unicode name is flagged with reasons; simulate the hide,
   put it back.

Then `npm run judge` in the repo: typecheck, 145 tests (unit + route-level integration
with mocked Google), production build.

## How it meets the requirements

| Requirement | How |
| --- | --- |
| Automates the YouTube content pipeline | Covers six of the use cases named on the hackathon page: **thumbnail generation** (real-frame composites, published via `thumbnails.set`), **metadata & SEO** (titles, descriptions, tags, chapters, localized metadata), **analytics reporting** (retention × comments, traffic, geography), **comment moderation** (Patrol's bulk scam sweep), **clip generation** (the Shorts cut list), and comment triage/planning on top |
| Solves a genuine pain point | The feedback loop creators skip because it's manual — closed end to end, plus the impersonation-scam plague no mainstream tool addresses |
| Real, functional results — no mockups | Live comment fetch, real generated JPEGs, real writes to a real channel (titles, thumbnails, localizations, replies, moderation), downloadable JSON/markdown |
| YouTube API terms & rate limits | Official endpoints only, no scraping. ~3 units per video analysis, ~10 per channel plan or patrol against the 10,000/day allowance; comment caching keeps repeat runs free; writes ride the user's own OAuth consent, gated on channel ownership and explicit confirmation |
| Built during the hackathon window | Full history in this repo |

Two things it deliberately does not do: touch a video the connected channel doesn't own
(enforced server-side on every write, replies and moderation included), and pretend to
pin a comment — the Data API has no pin endpoint, so it posts the comment and says
plainly that pinning is one click in Studio.

## Team

- **Michael Crowley** — [@mcrowley19](https://github.com/mcrowley19) — built the whole
  project.

## Repo

- Code: https://github.com/mcrowley19/youtube-automation (branch:
  `claude/audiencesignal-youtube-hackathon-cpyayr`)
- Open-source package extracted from this project:
  https://github.com/mcrowley19/youtube-chapter-kit
- Setup, environment variables, and architecture notes: [README.md](README.md)

## Demo video script (~2:45)

**0:00 — Cold open, the pitch.** Screen: a real comment section scrolling fast.
"This video has 1,800 comments. My next video idea, the reason this one underperformed,
and the exact second people stopped watching are all in here. AudienceSignal reads them —
and then it does the work."

**0:15 — Paste and analyze.** Paste the URL, click Analyze. While the steps run: "Video,
then up to 200 comments through the YouTube Data API, then a language model sorts every
one — with the receipts."

**0:35 — Themes and the brief.** Point at counts and a quote. "Fifteen requests, twelve
complaints — real quotes, not a summary. And three next-video ideas ranked by how loudly
the comments ask."

**0:55 — The wow: retention × comments.** Scroll to the curve. "This is my audience
retention from the Analytics API. It drops ten percent at 8:24 — and here's a comment
pointing at 8:14 telling me exactly why. Studio shows you the dip; the comments explain
it. Nothing else joins these."

**1:20 — Shorts cut list + thumbnails.** "The moments viewers timestamped become a
Shorts editor handoff. And the top complaint becomes a new thumbnail — drawn on YouTube's own preview stills of
the video, next to the one I published."

**1:40 — Do it, for real.** Draft the changes, show a diff, tick, confirm, and refresh
the actual YouTube watch page. "New title. Live. Chapters from the timestamps viewers
left. And every one of these has an undo button."

**2:05 — Speak their language.** "My analytics say a third of my audience isn't
English-speaking. One click and the title and description exist in Spanish, Hindi, and
Portuguese — published as real YouTube localizations."

**2:20 — Comment Patrol.** Run the sweep. "Every channel has these — the fake me with
the WhatsApp number, the crypto bots. Found across all my recent uploads, explained,
hidden in bulk. Reversibly."

**2:40 — Close.** "From 1,800 comments to a published fix, a filmable plan, and a clean
comment section — in minutes, on the official APIs, with an undo button. That's
AudienceSignal."

**Recording notes:** use a video with a mixed comment section or the report reads thin.
For the publish and patrol segments you need a video on your own channel (writes are
ownership-checked); an unlisted upload with seeded comments works. Do a practice run
first so comments are cached and quota can't break the take. Keep `.env.local` and the
OAuth account picker off camera. Under 3 minutes; upload to YouTube unlisted the day
before the deadline.

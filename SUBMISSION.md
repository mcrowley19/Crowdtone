# AudienceSignal — hackathon submission

**Live deployment:** https://youtube-automation-sandy.vercel.app
**Straight to the tool:** https://youtube-automation-sandy.vercel.app/app

## Write-up

**The problem.** A video lands, hundreds of comments arrive, and the creator is left
scrolling. The feedback is genuinely valuable — viewers say plainly what confused them,
what they want next, and where the title oversold the video — but it arrives as an
unsorted stream, so most of it is never acted on. Existing tools stop at a sentiment
score, which tells a creator how people feel and nothing about what to do.

**How the tool works.** Paste any public YouTube video address. AudienceSignal pulls the
video's metadata and up to 200 top-level comments through the YouTube Data API, then runs
them through a language model in four passes: cluster every comment into praise,
complaints, requests, and confusion; rank three next-video ideas by how loudly the
comments ask for them; draft a fix list for the video that's already published; and write
thumbnail overlay text answering the most-liked complaint. It then fetches real frames
from the video and composites those lines onto them, so the report ends with the current
thumbnail sitting beside three redrawn alternatives. The output is a plan — titles,
hooks, fixes, and images — with a verbatim viewer quote as evidence under every claim.

**The tech.** Next.js 14 (App Router) and TypeScript, with the API routes in the same
process, so the whole thing installs and runs with `npm install && npm run dev`. YouTube
Data API v3 (`videos.list`, `commentThreads.list`) for ingest, OpenRouter or OpenAI for
analysis, and `sharp` for thumbnail compositing — SVG text layers over fetched frames, no
`yt-dlp` or `ffmpeg` needed. Fetched comments are cached to `data/cache/` so repeat runs
cost no quota. Every model response is schema-validated and coerced; if the model fails or
no key is set, a keyword analyzer takes over, so the tool always produces a report. 30
vitest tests cover parsing, API response mapping, clustering, caching, and image
generation.

## Team info

<!-- Fill this in before submitting. -->

- **[Your name]** — [GitHub handle] — built the whole project.

## Repo

- Code: https://github.com/mcrowley19/youtube-automation (branch:
  `claude/audiencesignal-youtube-hackathon-cpyayr`)
- Setup, environment variables, and architecture notes: [README.md](README.md)

## How it meets the requirements

| Requirement | How |
| --- | --- |
| Automates part of the YouTube creator workflow | Comment triage, content planning, and thumbnail iteration |
| Solves a genuine pain point | Analytics, moderation-adjacent triage, and thumbnails — the feedback loop creators skip because it's manual |
| Actually runs and produces a real result | Live comment fetch, real generated JPEGs, downloadable JSON and markdown report — no mockups |
| Stays within YouTube Data API terms and rate limits | Public read-only endpoints, no OAuth, no scraping; disk cache and graceful quota handling keep usage far under the 10,000 unit/day free allowance (~3 units per analysis) |
| Built during the hackathon window | All code in this repo written during the event |

Generated thumbnails are local drafts only — the tool never uploads them, so it stays out
of `thumbnails.set` and OAuth entirely.

## Demo video script (~2 min 30 s)

**0:00 — The problem.** On screen: a real YouTube comment section, scrolling fast.
"This video has 1,800 comments. Somewhere in here is my next video idea, and the reason
this one underperformed. I'm not going to find either by scrolling."

**0:20 — Paste and analyze.** Open AudienceSignal, paste the video URL, click Analyze.
Let the step counter run — say what's happening: "It's pulling the video, then up to 200
comments through the YouTube Data API, then reading them."

**0:45 — What the comments say.** The four theme bands land. Point at the counts.
"Fifteen requests, twelve complaints. And these are real quotes, not a summary — every
number here is backed by comments I can go read."

**1:10 — What to make next.** Scroll to the brief. Read idea one aloud with its evidence
quote. "That's not a guess. Three people asked for that comparison in the comments, and
it's showing me who."

**1:35 — What to fix.** "And for the video that's already up — retitle it, pin a
correction about the battery numbers, add chapters. Each one tied to the comment that
asked for it."

**1:55 — Thumbnail rematch.** Click *Draw 3 variants*. "The top complaint was that the
title oversold it. So it pulls real frames out of the video and puts honest text on them."
Variants appear beside the current thumbnail.

**2:15 — Close.** Click *Save report as JSON*. "Eighteen hundred comments to a content
plan and three thumbnails, in about a minute. That's the loop."

**Recording notes:** use a video with a genuinely mixed comment section — praise *and*
complaints — or the report reads thin. Do a practice run first so the comments are cached
and the demo can't be broken by a quota error mid-recording. Keep `.env.local` off screen.

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
them through a language model: cluster every comment into praise, complaints, requests, and
confusion; rank three next-video ideas by how loudly the comments ask for them; draft a fix
list for the video that's already published; and write thumbnail overlay text answering the
most-liked complaint. It then fetches real frames from the video and composites those lines
onto them, so the report ends with the current thumbnail beside three redrawn alternatives.
Every claim carries a verbatim viewer quote as evidence.

Then it stops advising and starts doing. Connect your channel with Google and the same
findings arrive as finished copy the tool will publish for you: a new title, chapters mined
from the timestamps viewers themselves left in the comments, a comment answering the most
repeated confusion, replies to the questions people actually asked, and the new thumbnail.
Each proposal shows its before and after and the comment it came from; you tick the ones
you want, preview exactly what would be sent, confirm a second time, and undo from the same
screen. Every write re-reads the video and refuses unless the connected channel owns it.

The second mode plans forward instead of back. Point it at a channel and it reads the last
twenty uploads, scores each against that channel's own median views a day, pulls the
comment sections of the recent and the outperforming ones, and returns one video specified
well enough to film — title and alternates, the spoken hook, a beat-by-beat outline, a
paste-ready description, tags, target runtime, a publish date on the channel's own cadence,
and what not to repeat. The performance numbers underneath it are computed, not generated,
so the plan cannot invent a statistic.

**The tech.** Next.js 14 (App Router) and TypeScript, with the API routes in the same
process, so the whole thing installs and runs with `npm install && npm run dev`. YouTube
Data API v3 for both directions — `videos.list`, `commentThreads.list`, `channels.list` and
`playlistItems.list` to read; `videos.update`, `thumbnails.set`, `commentThreads.insert`,
`comments.insert` and `comments.delete` to write — OpenRouter or OpenAI for analysis, and
`sharp` for thumbnail compositing: SVG text layers over fetched frames, no `yt-dlp` or
`ffmpeg`. Google OAuth, token refresh, and the signed session cookie are hand-rolled on
`fetch` and `node:crypto`, so the dependency list is still next, react, and sharp. Fetched
comments are cached to `data/cache/` (`/tmp` on Vercel) so repeat runs cost no quota. Every
model response is schema-validated and coerced; if the model fails or no key is set, a
keyword analyzer takes over, so the tool always produces a report — and without an OAuth
client it degrades cleanly to read-only, drafting and previewing every change it can't
publish. 85 vitest tests cover parsing, API response mapping, clustering, caching, image
generation, chapter mining, action validation, channel metrics, and cookie signing.

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
| Automates part of the YouTube creator workflow | Comment triage, content planning, thumbnail iteration — and then the edits themselves: titles, descriptions, chapters, thumbnails, comments and replies |
| Solves a genuine pain point | The feedback loop creators skip because it's manual, closed end to end rather than handed back as a to-do list |
| Actually runs and produces a real result | Live comment fetch, real generated JPEGs, real writes to a real channel, downloadable JSON and markdown report — no mockups |
| Stays within YouTube Data API terms and rate limits | Official endpoints only, no scraping. Reads are ~3 units per analysis and ~10 per channel plan against the 10,000/day free allowance; writes go through the documented OAuth scopes with the user's own consent, are gated on channel ownership, and never fire without an explicit confirmation |
| Built during the hackathon window | All code in this repo written during the event |

Two things the tool deliberately does not do: it never touches a video the connected
channel doesn't own, and it doesn't pretend to pin a comment — the Data API has no pin
endpoint, so it posts the comment and says plainly that pinning is still one click in
Studio.

## Demo video script (~3 min)

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

**2:15 — Do it.** Scroll to *Do it*, click *Draft the changes*. "And here's the part that
isn't advice." Point at a diff. "New title, chapters built from the timestamps viewers left
themselves, a reply to the top question. I tick what I want, preview it, and it goes to
YouTube." Click through the confirmation, then show the Undo button. "And it comes back."

**2:40 — Close.** Switch to *Plan the next one*. "Same idea, whole channel: what to make
next, and why, from the numbers and the comments. Eighteen hundred comments to a published
fix and a filmable plan, in about a minute. That's the loop."

**Recording notes:** use a video with a genuinely mixed comment section — praise *and*
complaints — or the report reads thin. For the *Do it* segment you need a video on your own
channel, since every write is ownership-checked; a private or unlisted test upload with a
few seeded comments works. Do a practice run first so the comments are cached and the demo
can't be broken by a quota error mid-recording. Keep `.env.local` and the OAuth consent
screen's account picker off camera.

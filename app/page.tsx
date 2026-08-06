import Link from "next/link";
import type { Metadata } from "next";
import { RevealObserver } from "@/components/Reveal";

/*
 * Concept: "The Front Page" — the tool reads comment sections, so its landing
 * page is set like the front page of a paper that just went to press. Same
 * poster identity as the app itself: cream stock, one red, Impact display,
 * structure from rules rather than cards.
 *
 * Motion: "gone to press." The page assembles the way a paper is set — rules
 * draw themselves across the column, headline slugs drop in from behind the
 * baseline, section labels slide out along their rules, and the black band's
 * words ink in under the scroll like a press rolling over the line. Entrance
 * only, no scroll-jacking, everything guarded for reduced motion.
 */

export const metadata: Metadata = {
  title: "AudienceSignal — the comment section already wrote your next video",
  description:
    "Paste a public YouTube video. AudienceSignal reads its comments and writes back a plan — themes, next-video ideas, fixes, redrawn thumbnails, retention dips explained by comments, a Shorts cut list — then, if you connect your channel, publishes the changes, translates your packaging, and sweeps the scams out of your comments.",
};

const OUTPUTS = [
  {
    name: "Comment themes",
    what: "Every comment sorted into praise, complaints, requests and confusion, with counts and the most-liked verbatim quotes under each.",
    note: "Counts, not vibes",
  },
  {
    name: "Next Video Brief",
    what: "Three video ideas ranked by how loudly the comments ask for them. Each one arrives with a title, an opening hook, and the quotes proving viewers want it.",
    note: "Titles and hooks",
  },
  {
    name: "Fix This Video",
    what: "Things worth doing to the video that is already published: retitle it, pin a correction, add chapters. Each backed by the comment that prompted it.",
    note: "Doable today",
  },
  {
    name: "Thumbnail Lab",
    what: "Three thumbnail variants composited from real frames of your video, overlaid with text that answers the loudest complaint, shown beside the thumbnail you published.",
    note: "Built from real frames",
  },
  {
    name: "Do it",
    what: "The same findings written as finished copy and published for you: a new title, chapters mined from the timestamps viewers left, a comment answering the top confusion, replies to the questions people asked, the new thumbnail. You tick what you want, see the exact diff, confirm, and can undo.",
    note: "Changes, not advice",
  },
  {
    name: "The numbers behind it",
    what: "For your own videos, the YouTube Analytics API joins the picture: the audience-retention curve with its sharpest drop-offs marked. When viewers timestamped that exact moment in the comments, the quote that explains the dip sits right under it. Plus traffic sources, watch geography, and subscribers gained.",
    note: "Retention × comments",
  },
  {
    name: "Cut these into Shorts",
    what: "The moments viewers timestamped are the moments they rewatched and quoted. Each becomes a ready-to-cut clip spec: a start and end time, why it works, and the comment to open the Short with.",
    note: "The free highlight reel",
  },
  {
    name: "Speak their language",
    what: "Your Analytics say where the audience actually is. AudienceSignal translates the title and description into those languages and publishes them as YouTube localizations, so a viewer in São Paulo sees your video packaged in Portuguese.",
    note: "Published, not pasted",
  },
  {
    name: "Comment Patrol",
    what: "A sweep of your recent uploads for the comments every channel gets: impersonators wearing your name in a fancy-unicode font, WhatsApp and crypto lures, giveaway bots, cross-video paste spam. Tick the ones to hide and they are moderated in bulk, reversibly.",
    note: "Scams out, in bulk",
  },
  {
    name: "Plan the next one",
    what: "Channel-wide: the last twenty uploads scored against your own median views a day, the comment sections of the recent and the outperforming ones, and out of it one video — title, spoken hook, beat-by-beat outline, description, tags, runtime, publish date — with the numbers and quotes behind each.",
    note: "One video, filmable",
  },
];

const STEPS = [
  ["Read", "Pulls the video's metadata and up to 200 top-level comments through the YouTube Data API. Public data, no account needed."],
  ["Cluster", "A language model sorts every comment into the four themes and writes a summary of what the audience is collectively saying."],
  ["Draft", "Further passes turn those clusters into next-video ideas, a fix list, thumbnail overlay lines, and the finished copy of each change."],
  ["Redraw", "Real frames are fetched from the video and composited with the overlay text, so the report ends in pictures rather than advice."],
  ["Publish", "Connect your channel and the changes you tick are written to YouTube: title, description, chapters, thumbnail, localized metadata, comments and replies, and the scams swept out of your comment sections. Each one previewable first and undoable after."],
];

const BAND =
  "The comments say what to fix, what to film next, and which scams to sweep. This reads them, shows the receipts, and does the work.";

function BandWords() {
  const words = BAND.split(" ");
  return (
    <p className="lp-band-inner" aria-label={BAND}>
      {words.map((word, i) => (
        <span
          key={i}
          className="w"
          aria-hidden
          style={{ ["--i" as string]: ((i / words.length) * 0.69).toFixed(3) }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

function Slug({ children }: { children: string }) {
  return (
    <div className="lp-slug" data-reveal>
      <i aria-hidden />
      <span>{children}</span>
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link href="/" className="lp-word">
            Audience<span>Signal</span>
          </Link>
          <nav className="lp-nav-links">
            <a href="#outputs">What it makes</a>
            <a href="#how">How it works</a>
            <a href="#honest">The fine print</a>
          </nav>
          <Link href="/app" className="lp-btn lp-btn-sm">
            Open the tool
          </Link>
        </div>
      </header>

      <main className="lp">
        <section className="lp-hero-poster">
          <div className="lp-hero-text">
            <h1>
              <span className="mline">
                <span>The comment section</span>
              </span>
              <span className="mline">
                <span>already wrote your</span>
              </span>
              <span className="mline">
                <span className="lp-red">next video.</span>
              </span>
            </h1>
            <p className="lp-lede">
              A video lands, hundreds of comments arrive, and you scroll. Viewers say
              plainly what confused them, what they want next, and where the title
              oversold it. AudienceSignal reads all of it, shows the receipts, and makes
              the changes.
            </p>
            <div className="lp-cta">
              <Link href="/app" className="lp-btn">
                Run the live demo
              </Link>
              <a href="#how" className="lp-btn lp-btn-ghost">
                How it works
              </a>
            </div>
            <p className="lp-note">
              The demo needs no keys and no account. It runs the whole pipeline on a
              bundled 50-comment dataset.
            </p>
          </div>
        </section>

        <section className="lp-rematch">
          <div className="lp-rematch-copy">
            <Slug>Thumbnail rematch</Slug>
            <p className="lp-lede">
              Paste a video address and every claim comes back with a viewer quote as
              evidence. Connect your channel and it publishes the fixes: retitles,
              chapters, thumbnails, replies, translated packaging, and a bulk sweep of
              the scam comments impersonating you.
            </p>
            <p className="lp-note lp-art-note">
              From the bundled demo dataset. On a real video these are composited from
              frames of the video itself.
            </p>
          </div>
          <figure>
            <span className="lp-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-thumb.svg"
                alt="The published thumbnail from the demo dataset: a laptop on a dark background with the words 30 DAYS LATER."
                width={1280}
                height={720}
              />
            </span>
            <figcaption>
              <b>Published.</b> What the viewer saw
            </figcaption>
          </figure>
          <figure>
            <span className="lp-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sample-callout-box.jpg"
                alt="A redrawn thumbnail: a red callout box reading THE HONEST VERSION."
                width={1280}
                height={720}
                loading="lazy"
              />
            </span>
            <figcaption>
              <b>Redrawn.</b> Answering the top complaint, that the title oversold the
              video
            </figcaption>
          </figure>
        </section>

        <section className="lp-band" data-scrollwords>
          <BandWords />
          <span className="lp-credit">
            NYT composing room, 1942 · Library of Congress
          </span>
        </section>

        <section id="outputs" className="lp-sec">
          <Slug>What comes back</Slug>
          <h2 className="rv-slide" data-reveal>
            Ten things, and the evidence for each
          </h2>
          <dl className="lp-index rv-rule" data-reveal>
            {OUTPUTS.map((o) => (
              <div key={o.name} className="lp-index-row">
                <dt className="rv-slide" data-reveal>
                  <em>{o.name}</em>
                </dt>
                <dd className="rv-ink" data-reveal>
                  <p>{o.what}</p>
                  <span className="lp-tag">{o.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="lp-sec lp-sec-alt">
          <Slug>How it works</Slug>
          <h2 className="rv-slide" data-reveal>
            Five passes, about a minute
          </h2>
          <ol className="lp-steps rv-rule" data-reveal>
            {STEPS.map(([name, body]) => (
              <li key={name}>
                <b>{name}</b>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <p className="lp-aside rv-ink" data-reveal>
            Every model response is validated against a strict schema before it reaches
            the page. When a response fails, or a free model times out, that section
            falls back to a keyword analyser on its own, so the report degrades one
            section at a time instead of collapsing.
          </p>
        </section>

        <section id="honest" className="lp-sec">
          <Slug>The fine print</Slug>
          <h2 className="rv-slide" data-reveal>
            What this actually is
          </h2>
          <ul className="lp-facts rv-rule" data-reveal>
            <li>
              <b>Reading needs no account.</b> Video metadata and top-level comments come
              through the YouTube Data API as public data. Nothing private, no viewer
              accounts, ever.
            </li>
            <li>
              <b>Runs on a free model.</b> This deployment is wired to a free hosted model,
              so an analysis takes roughly a minute rather than a few seconds. Quality
              tracks the model, and the fallback analyser covers the gaps.
            </li>
            <li>
              <b>Thumbnails use real frames.</b> YouTube publishes three frames of every
              public video at predictable addresses, so the variants are composited from
              the actual video. No yt-dlp, no ffmpeg.
            </li>
            <li>
              <b>Nothing is kept.</b> Fetched comments are cached briefly to spare API
              quota and are not stored permanently. Your sign-in lives in one signed
              cookie, not a database, and signing out revokes it with Google.
            </li>
            <li>
              <b>Writing is opt-in, and yours.</b> Publishing a change requires signing
              in with Google and a second, deliberate confirmation. Every write is checked
              against the channel you connected, so the tool can only ever change your own
              videos, and most changes can be undone from the same screen.
            </li>
          </ul>
        </section>

        <section className="lp-close" data-reveal>
          <h2 className="rv-slide" data-reveal>
            The audience is<br />already talking.
          </h2>
          <div className="lp-cta rv-ink" data-reveal>
            <Link href="/app" className="lp-btn">
              Open the tool
            </Link>
            <a href="#outputs" className="lp-btn lp-btn-ghost">
              What comes back
            </a>
          </div>
          <p className="lp-note rv-ink" data-reveal>
            Works without any keys on the bundled dataset. Add a YouTube API key to analyse
            a live video.
          </p>
          <span className="lp-credit">
            Crowd watching the playograph, World Series, 1911 · Library of Congress
          </span>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-foot-inner">
          <span>AudienceSignal</span>
          <span>Turn a comment section into your next video</span>
        </div>
      </footer>
      <RevealObserver />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { RevealObserver } from "@/components/Reveal";

/*
 * Concept: "The Front Page" — the tool reads comment sections, so its landing
 * page is set like the front page of a paper that just went to press. Same
 * poster identity as the app itself: cream stock, one red, Impact display
 * (the thumbnail face, on purpose), structure from rules rather than cards.
 */

export const metadata: Metadata = {
  title: "AudienceSignal — the comment section already wrote your next video",
  description:
    "Paste a public YouTube video. AudienceSignal reads its comments and writes back a plan: what viewers praised, complained about and asked for, three next-video ideas, a fix list, and redrawn thumbnails built from real frames.",
};

const OUTPUTS = [
  {
    n: "01",
    name: "Comment themes",
    what: "Every comment sorted into praise, complaints, requests and confusion, with counts and the most-liked verbatim quotes under each.",
    note: "Counts, not vibes",
  },
  {
    n: "02",
    name: "Next Video Brief",
    what: "Three video ideas ranked by how loudly the comments ask for them. Each one arrives with a title, an opening hook, and the quotes proving viewers want it.",
    note: "Titles and hooks",
  },
  {
    n: "03",
    name: "Fix This Video",
    what: "Things worth doing to the video that is already published — retitle it, pin a correction, add chapters — each backed by the comment that prompted it.",
    note: "Doable today",
  },
  {
    n: "04",
    name: "Thumbnail Lab",
    what: "Three thumbnail variants composited from real frames of your video, overlaid with text that answers the loudest complaint, shown beside the thumbnail you published.",
    note: "Built from real frames",
  },
];

const STEPS = [
  ["Read", "Pulls the video's metadata and up to 200 top-level comments through the YouTube Data API. Public data only — no OAuth, no account access."],
  ["Cluster", "A language model sorts every comment into the four themes and writes a summary of what the audience is collectively saying."],
  ["Draft", "Three further passes turn those clusters into next-video ideas, a fix list for the current video, and thumbnail overlay lines."],
  ["Redraw", "Real frames are fetched from the video and composited with the overlay text, so the report ends in pictures rather than advice."],
];

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
        <section className="lp-hero">
          <div className="lp-hero-text">
            <p className="lp-kick">YouTube comment analysis</p>
            <h1>
              The comment section
              <br />
              already wrote your
              <br />
              <span className="lp-red">next video.</span>
            </h1>
            <p className="lp-lede">
              A video lands, hundreds of comments arrive, and you scroll. The feedback is
              genuinely good — viewers say plainly what confused them, what they want next,
              and where the title oversold it — but it arrives as an unsorted stream, so
              most of it is never acted on.
            </p>
            <p className="lp-lede">
              Paste a video address. AudienceSignal reads the comments and writes back a
              plan, with a viewer quote as evidence under every claim.
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
              The demo needs no keys and no account. It runs the whole pipeline on a bundled
              50-comment dataset.
            </p>
          </div>

          <div className="lp-hero-art">
            <p className="lp-kick">Thumbnail rematch</p>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-thumb.svg"
                alt="The published thumbnail from the demo dataset: a laptop on a dark background with the words 30 DAYS LATER."
                width={1280}
                height={720}
                fetchPriority="high"
              />
              <figcaption>
                <b>Published.</b> What the viewer saw
              </figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sample-callout-box.jpg"
                alt="A redrawn thumbnail: a red callout box reading THE HONEST VERSION."
                width={1280}
                height={720}
                loading="lazy"
              />
              <figcaption>
                <b>Redrawn.</b> Answering the top complaint — that the title oversold the
                video
              </figcaption>
            </figure>
            <p className="lp-note lp-art-note">
              From the bundled demo dataset. On a real video these are composited from
              frames of the video itself.
            </p>
          </div>
        </section>

        <section className="lp-band">
          <div className="lp-band-inner">
            Not a sentiment dashboard. A plan.
          </div>
        </section>

        <section id="outputs" className="lp-sec">
          <div className="reveal" data-reveal>
            <p className="lp-kick">What comes back</p>
            <h2>Four things, and the evidence for each</h2>
          </div>
          <dl className="lp-index">
            {OUTPUTS.map((o, i) => (
              <div
                key={o.n}
                className={`lp-index-row reveal reveal-d${Math.min(i, 3)}`}
                data-reveal
              >
                <dt>
                  <span className="lp-num">{o.n}</span>
                  {o.name}
                </dt>
                <dd>
                  <p>{o.what}</p>
                  <span className="lp-tag">{o.note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="lp-sec lp-sec-alt">
          <div className="reveal" data-reveal>
            <p className="lp-kick">How it works</p>
            <h2>Four passes, about a minute</h2>
          </div>
          <ol className="lp-steps">
            {STEPS.map(([name, body], i) => (
              <li key={name} className={`reveal reveal-d${Math.min(i, 3)}`} data-reveal>
                <b>{name}</b>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <div className="reveal" data-reveal>
            <p className="lp-aside">
              Every model response is validated against a strict schema before it reaches
              the page. When a response fails — or a free model times out — that section
              falls back to a keyword analyser on its own, so the report degrades one
              section at a time instead of collapsing.
            </p>
          </div>
        </section>

        <section id="honest" className="lp-sec">
          <div className="reveal" data-reveal>
            <p className="lp-kick">The fine print</p>
            <h2>What this actually is</h2>
          </div>
          <div className="reveal" data-reveal>
            <ul className="lp-facts">
              <li>
                <b>Public data only.</b> It reads a video's metadata and its top-level
                comments through the YouTube Data API. No OAuth, no channel access, nothing
                private, no viewer accounts.
              </li>
              <li>
                <b>Runs on a free model.</b> This deployment is wired to a free hosted model,
                so an analysis takes roughly a minute rather than a few seconds. Quality
                tracks the model, and the fallback analyser covers the gaps.
              </li>
              <li>
                <b>Thumbnails use real frames.</b> YouTube publishes three frames of every
                public video at predictable addresses, so the variants are composited from
                the actual video — no yt-dlp, no ffmpeg.
              </li>
              <li>
                <b>Nothing is kept.</b> Fetched comments are cached briefly to spare API
                quota and are not stored permanently.
              </li>
            </ul>
          </div>
        </section>

        <section className="lp-close">
          <div className="reveal" data-reveal>
            <h2>
              Point it at a video<br />and see what it says.
            </h2>
            <div className="lp-cta">
              <Link href="/app" className="lp-btn">
                Open the tool
              </Link>
            </div>
            <p className="lp-note">
              Works without any keys on the bundled dataset. Add a YouTube API key to analyse
              a live video.
            </p>
          </div>
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

import Link from "next/link";
import type { Metadata } from "next";
import { RevealObserver } from "@/components/Reveal";

const TITLE = "Crowdtone: turn a YouTube comment section into your next video";
const DESCRIPTION =
  "Crowdtone reads up to 1,000 comments on any public YouTube video and writes back a plan: comment themes with quotes, retention drop-offs explained by viewers, three next-video ideas, a fix list, redrawn thumbnails, a Shorts cut list, and translated packaging. Connect your channel and it publishes the changes.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Crowdtone",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Crowdtone" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
};

const FIGURES: [string, string][] = [
  ["1,000", "comments read per video"],
  ["11", "reports, each with the quote behind it"],
  ["0", "API keys needed to run the demo"],
  ["216", "tests covering the pipeline"],
];

const OUTPUTS: { name: string; what: string; mode?: boolean }[] = [
  {
    name: "Comment themes",
    what: "Every comment sorted into praise, complaints, requests and confusion, with counts and the most-liked quotes under each.",
  },
  {
    name: "Room sentiment",
    what: "Every comment scored by a fixed lexicon, all 1,000 of them, so the same thread always draws the same chart.",
  },
  {
    name: "Retention dips",
    what: "Your sharpest drop-offs marked on the curve, each matched to the comment that explains why viewers left there.",
  },
  {
    name: "Next-video brief",
    what: "Three ideas ranked by how loudly the comments ask, each with a title, an opening hook, and the quotes proving demand.",
  },
  {
    name: "Fix list",
    what: "Changes worth making to the video you already published, every one tied to the comment that prompted it.",
  },
  {
    name: "Thumbnail rematch",
    what: "Three variants composited from YouTube's own preview stills, overlaid with a line answering the loudest complaint.",
  },
  {
    name: "Shorts cut list",
    what: "The moments viewers timestamped, with in and out points and an editor pack of markers, an EDL, and captions.",
  },
  {
    name: "Translated packaging",
    what: "Title and description rendered into the languages your analytics show, published as YouTube localizations.",
  },
  {
    name: "Superfans",
    what: "The viewers worth replying to today, ranked by arithmetic on likes, questions and timestamps rather than a model's guess.",
  },
  {
    name: "Publish queue",
    what: "Every finding written as finished copy: title, chapters, pinned comment, replies, thumbnail. Tick it, read the diff, confirm, undo.",
  },
  {
    name: "Audience digest",
    what: "The whole report folded into one email you could send weekly, composed in code from figures the report already proved.",
  },
  {
    name: "Plan the next one",
    what: "Channel-wide: twenty uploads scored against your own median views a day, ending in one video specified well enough to film.",
    mode: true,
  },
  {
    name: "Comment patrol",
    what: "A sweep of recent uploads for impersonators, WhatsApp lures, crypto bait and paste-bots, hidden in bulk and reversibly.",
    mode: true,
  },
  {
    name: "Premiere co-pilot",
    what: "Live chat triaged as it arrives: questions worth answering on air, scam bots hidden, and the seconds chat spikes timestamped.",
    mode: true,
  },
];

const STEPS: [string, string][] = [
  ["Read", "Video metadata and up to 1,000 top-level comments through the YouTube Data API, which costs ten of the 10,000 free quota units a day. Public data, no account required."],
  ["Cluster", "The comments are batched and a language model sorts each batch into the four themes. With no key configured, a keyword scan does the same job."],
  ["Draft", "Those clusters become next-video ideas, a fix list, thumbnail lines, and the finished copy of every proposed change."],
  ["Redraw", "YouTube's published preview stills are fetched and composited with the overlay text, so the report ends in pictures."],
  ["Publish", "Connect your channel and the changes you tick are written to YouTube, each previewable as a diff first and undoable after."],
];

const FACTS: [string, string][] = [
  ["Reading needs no account", "Video metadata and top-level comments arrive through the YouTube Data API as public data. No viewer accounts, ever."],
  ["The demo runs on zero keys", "A bundled 50-comment dataset drives the whole pipeline, so the tool is reviewable without credentials."],
  ["Thumbnails use YouTube's own stills", "YouTube publishes three preview stills of every public video, so variants composite real frames. No yt-dlp, no ffmpeg. The demo video is fictional, so the samples above sit on a stand-in frame."],
  ["Nothing is stored", "Fetched comments are cached briefly to spare API quota. Your sign-in lives in one signed cookie, and signing out revokes it with Google."],
  ["Writing is opt-in and scoped", "Publishing needs a Google sign-in and a second confirmation. Every write is checked against the channel you connected."],
  ["The chapter engine is open source", "The timestamp parser that mines chapters from comments ships separately as youtube-chapter-kit, MIT licensed with its own tests."],
];

export default function Landing() {
  return (
    <div className="ct">
      <header className="ct-nav">
        <div className="ct-nav-in">
          <Link href="/" className="ct-mark">
            Crowd<span>tone</span>
          </Link>
          <nav className="ct-nav-links">
            <a href="#report">The report</a>
            <a href="#outputs">What it makes</a>
            <a href="#how">How it works</a>
            <a href="#honest">Fine print</a>
          </nav>
          <Link href="/app" className="ct-btn">
            Open the tool
          </Link>
        </div>
      </header>

      <main>
        <section className="ct-hero">
          <div className="ct-hero-art">
            <div className="ct-hero-card">
              <h1>
                <span className="mline">
                  <span>The comment section</span>
                </span>
                <span className="mline">
                  <span>already wrote your</span>
                </span>
                <span className="mline">
                  <span className="ct-red">next video.</span>
                </span>
              </h1>
              <p className="ct-lede">
                Crowdtone reads up to 1,000 comments on any public YouTube video and writes back
                a plan: what to fix, what to film next, and a thumbnail that answers the loudest
                complaint. Connect your channel and it publishes the changes for you.
              </p>
              <div className="ct-cta">
                <Link href="/app" className="ct-btn ct-btn-lg">
                  Run the demo
                </Link>
                <a href="#report" className="ct-btn ct-btn-lg ct-btn-ghost">
                  See the report
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="ct-figures">
          <div className="ct-figures-in">
            {FIGURES.map(([n, label]) => (
              <div key={label}>
                <b>{n}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="ct-wrap">
          <section id="report" className="ct-sec">
            <h2 className="rv-slide" data-reveal>
              What the report shows for one video
            </h2>
            <p className="ct-sub rv-ink" data-reveal>
              One video, six views. The strip across the top holds the loudest signal, the mood of
              the room, and the count of changes waiting, so the state of the audience reads at a
              glance before you open anything.
            </p>
            <span className="ct-shot rv-ink" data-reveal>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shot-report.jpg"
                alt="The Crowdtone report on a demo video, showing the figure strip, the section rail, and comments grouped into praise and complaints with verbatim quotes."
                width={1512}
                height={786}
              />
            </span>
            <p className="ct-cap">
              <b>Signals.</b> 50 comments sorted into four themes, counted, and quoted verbatim
            </p>
          </section>

          <section className="ct-sec ct-sec-tight">
            <h2 className="rv-slide" data-reveal>
              Retention: where viewers left, and why
            </h2>
            <div className="ct-shots">
              <figure>
                <span className="ct-shot rv-ink" data-reveal>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/shot-retention.jpg"
                    alt="The retention view: an audience retention curve with two drop-off points marked in red, and the viewer comment explaining the first one printed underneath."
                    width={1512}
                    height={786}
                    loading="lazy"
                  />
                </span>
                <p className="ct-cap">
                  <b>Drop-offs.</b> Each dip labelled with the comment that names that timestamp
                </p>
              </figure>
              <div>
                <p className="ct-sub" style={{ marginTop: 0 }}>
                  The YouTube Analytics API gives the curve. The comment section gives the reason.
                  Crowdtone joins them at the second, then drafts the correction to pin and the
                  chapter to add so viewers navigate instead of leaving.
                </p>
                <div className="ct-cta">
                  <Link href="/app" className="ct-btn">
                    Open the tool
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="ct-sec ct-sec-tight">
            <h2 className="rv-slide" data-reveal>
              Thumbnails redrawn from YouTube&rsquo;s own stills
            </h2>
            <div className="ct-rematch">
              <figure>
                <span className="ct-frame rv-ink" data-reveal>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/demo-thumb.jpg"
                    alt="The published thumbnail from the demo dataset: a laptop lit in purple and blue, captioned AFTER 30 DAYS in white and INSANE. in yellow."
                    width={1280}
                    height={720}
                    loading="lazy"
                  />
                </span>
                <p className="ct-cap">
                  <b>Published.</b> What the viewer saw
                </p>
              </figure>
              <figure>
                <span className="ct-frame rv-ink" data-reveal>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/sample-callout-box.jpg"
                    alt="The same frame redrawn by Crowdtone: a red callout box in the top-left reading THE HONEST VERSION."
                    width={1280}
                    height={720}
                    loading="lazy"
                  />
                </span>
                <p className="ct-cap">
                  <b>Redrawn.</b> Answering the top complaint, that the title oversold the video
                </p>
              </figure>
            </div>
          </section>

          <section id="outputs" className="ct-sec">
            <h2 className="rv-slide" data-reveal>
              Fourteen outputs, each with its evidence
            </h2>
            <div className="ct-grid rv-ink" data-reveal>
              {OUTPUTS.map((o) => (
                <div className="ct-card" key={o.name}>
                  {o.mode && <span className="ct-tag">Separate mode</span>}
                  <h3>{o.name}</h3>
                  <p>{o.what}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="how" className="ct-sec">
            <h2 className="rv-slide" data-reveal>
              How it works: five passes, about a minute
            </h2>
            <ol className="ct-steps rv-ink" data-reveal>
              {STEPS.map(([name, body]) => (
                <li key={name}>
                  <b>{name}</b>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="honest" className="ct-sec">
            <h2 className="rv-slide" data-reveal>
              The fine print: data, keys and permissions
            </h2>
            <ul className="ct-facts rv-ink" data-reveal>
              {FACTS.map(([name, body]) => (
                <li key={name}>
                  <b>{name}</b>
                  {body}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="ct-close" data-reveal>
          <div className="ct-close-in">
            <h2 className="rv-slide" data-reveal>
              Run it on one comment section
            </h2>
            <p className="ct-sub rv-ink" data-reveal style={{ color: "rgba(243,240,233,0.82)" }}>
              Paste any public YouTube address, or run the bundled dataset with no keys at all.
            </p>
            <div className="ct-cta rv-ink" data-reveal>
              <Link href="/app" className="ct-btn ct-btn-lg">
                Run the demo
              </Link>
              <a href="#outputs" className="ct-btn ct-btn-lg ct-btn-ghost">
                What it makes
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="ct-foot">
        <div className="ct-foot-in">
          <b>Crowdtone</b>
          <span>Turn a comment section into your next video</span>
        </div>
      </footer>
      <RevealObserver />
    </div>
  );
}

"use client";

import type { Superfan } from "@/lib/superfans";

/**
 * The people behind the numbers. Scores are pure arithmetic (lib/superfans);
 * this just puts names, receipts, and reasons on screen.
 */
export function SuperfanList({ fans, deck }: { fans: Superfan[]; deck: string }) {
  if (fans.length === 0) return null;

  return (
    <section className="report">
      <h2>Your superfans</h2>
      <p className="deck">{deck}</p>
      <ol className="fanlist">
        {fans.map((fan) => (
          <li key={fan.authorChannelId ?? fan.author}>
            <div className="fanhead">
              <b>{fan.author}</b>
              {fan.badges.map((badge) => (
                <span className="tag" key={badge}>
                  {badge}
                </span>
              ))}
            </div>
            {fan.topQuote && <div className="devidence">{fan.topQuote}&rdquo;</div>}
          </li>
        ))}
      </ol>
      <p className="drationale">
        Ranked by showing up (comments, videos touched), being valued by other viewers (likes),
        and adding substance (questions, timestamps). Computed, not model-guessed — reply to one
        of them today.
      </p>
    </section>
  );
}

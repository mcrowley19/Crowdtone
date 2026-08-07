"use client";

import type { Superfan } from "@/lib/superfans";
import { Panel } from "@/components/Panel";

/**
 * The people behind the numbers. Scores are pure arithmetic (lib/superfans);
 * this just puts names, receipts, and reasons on screen.
 */
export function SuperfanList({ fans, chip }: { fans: Superfan[]; chip: string }) {
  if (fans.length === 0) return null;

  return (
    <Panel title="Your superfans" chip={chip}>
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
    </Panel>
  );
}

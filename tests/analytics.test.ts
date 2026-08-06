import { describe, expect, it } from "vitest";
import {
  findRetentionDips,
  joinDipsWithMentions,
  labelTrafficSource,
  mapReportRows,
  mapRetentionCurve,
} from "@/lib/analytics";
import { DEMO_DURATION_SECONDS, getDemoRetentionCurve } from "@/lib/demo";

describe("mapReportRows", () => {
  it("zips column headers onto rows by name", () => {
    const body = {
      columnHeaders: [{ name: "country" }, { name: "views" }],
      rows: [
        ["US", 1900],
        ["DE", 300],
      ],
    };
    expect(mapReportRows(body)).toEqual([
      { country: "US", views: 1900 },
      { country: "DE", views: 300 },
    ]);
  });

  it("returns empty for a report with no rows", () => {
    expect(mapReportRows({ columnHeaders: [{ name: "views" }] })).toEqual([]);
    expect(mapReportRows(null)).toEqual([]);
  });
});

describe("mapRetentionCurve", () => {
  it("sorts by position and drops malformed points", () => {
    const rows = [
      { elapsedVideoTimeRatio: 0.5, audienceWatchRatio: 0.4 },
      { elapsedVideoTimeRatio: 0.0, audienceWatchRatio: 0.9 },
      { elapsedVideoTimeRatio: "bad", audienceWatchRatio: 0.4 },
    ];
    const curve = mapRetentionCurve(rows as any);
    expect(curve).toHaveLength(2);
    expect(curve[0].ratio).toBe(0);
  });
});

describe("findRetentionDips", () => {
  it("finds the engineered cliffs in the demo curve, not the opening drop", () => {
    const dips = findRetentionDips(getDemoRetentionCurve(), DEMO_DURATION_SECONDS);
    expect(dips.length).toBeGreaterThanOrEqual(2);
    // The two cliffs sit at 34% (8:14) and 64.5% (15:30) of a 24-minute video.
    const seconds = dips.map((d) => d.seconds);
    expect(seconds.some((s) => Math.abs(s - 494) < 60)).toBe(true);
    expect(seconds.some((s) => Math.abs(s - 930) < 60)).toBe(true);
    // Nothing from the first 10% — the universal opening drop is not a finding.
    expect(seconds.every((s) => s > DEMO_DURATION_SECONDS * 0.1)).toBe(true);
  });

  it("returns nothing for a flat curve or missing data", () => {
    const flat = Array.from({ length: 100 }, (_, i) => ({ ratio: i / 100, watchRatio: 0.5 }));
    expect(findRetentionDips(flat, 600)).toEqual([]);
    expect(findRetentionDips([], 600)).toEqual([]);
    expect(findRetentionDips(flat, 0)).toEqual([]);
  });
});

describe("joinDipsWithMentions", () => {
  const dips = [{ seconds: 494, timestamp: "8:14", dropPercent: 9 }];

  it("attaches comment evidence within 25 seconds of the dip", () => {
    const joined = joinDipsWithMentions(dips, [
      { seconds: 500, count: 3, quotes: ["at 8:20 the chart contradicts what you said"] },
    ]);
    expect(joined[0].mentions).toEqual({
      count: 3,
      quote: "at 8:20 the chart contradicts what you said",
    });
  });

  it("leaves the dip unexplained when no comment is near it", () => {
    const joined = joinDipsWithMentions(dips, [{ seconds: 900, count: 5, quotes: ["later"] }]);
    expect(joined[0].mentions).toBeNull();
  });
});

describe("labelTrafficSource", () => {
  it("maps known codes and humanizes unknown ones", () => {
    expect(labelTrafficSource("YT_SEARCH")).toBe("YouTube search");
    expect(labelTrafficSource("RELATED_VIDEO")).toBe("Suggested videos");
    expect(labelTrafficSource("SOME_NEW_THING")).toBe("some new thing");
  });
});

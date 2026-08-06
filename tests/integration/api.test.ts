import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signSession, type Session } from "@/lib/session";

/**
 * Route-level tests: the real handlers, called the way Next calls them, with
 * the network mocked at the fetch layer. No YouTube response is ever invented
 * outside these fixtures, and any request the mock doesn't recognize fails
 * the test — so a route can't quietly talk to the real internet.
 */

type Call = { url: string; method: string; body?: any };
let calls: Call[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The canned Google. Each test sets `ownVideoChannelId` to steer ownership. */
let ownVideoChannelId = "UCowner00000000000000000";

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";
  let body: any;
  if (typeof init?.body === "string") {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  calls.push({ url, method, body });

  if (url.includes("googleapis.com/youtube/v3/videos") && method === "GET") {
    return Promise.resolve(
      jsonResponse({
        items: [
          {
            id: "vid00000001",
            snippet: {
              channelId: ownVideoChannelId,
              title: body?.title ?? "The old title",
              description: "The old description",
              categoryId: "22",
              thumbnails: { high: { url: "https://i.ytimg.com/vi/vid00000001/hqdefault.jpg" } },
            },
            localizations: null,
          },
        ],
      })
    );
  }
  if (url.includes("googleapis.com/youtube/v3/videos") && method === "PUT") {
    return Promise.resolve(jsonResponse({ id: body?.id }));
  }
  if (url.includes("i.ytimg.com")) {
    // A plausible tiny JPEG for the thumbnail snapshot.
    return Promise.resolve(new Response(new Uint8Array(5000).fill(0xab), { status: 200 }));
  }
  return Promise.reject(new Error(`Unexpected network request in test: ${method} ${url}`));
}

function post(url: string, body: unknown, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const SECRET = "integration-test-secret";

function sessionCookie(channelId = "UCowner00000000000000000"): string {
  const session: Session = {
    accessToken: "test-access-token",
    refreshToken: "test-refresh-token",
    expiresAt: Date.now() + 3600_000,
    channelId,
    channelTitle: "Owner Channel",
  };
  return `as_session=${signSession(session, SECRET)}`;
}

beforeEach(() => {
  calls = [];
  ownVideoChannelId = "UCowner00000000000000000";
  vi.stubGlobal("fetch", mockFetch);
  process.env.SESSION_SECRET = SECRET;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/analyze", () => {
  it("returns a full heuristic analysis with no LLM key and no network", async () => {
    const { POST } = await import("@/app/api/analyze/route");
    const { getDemoComments, getDemoVideo } = await import("@/lib/demo");
    const res = await POST(
      post("/api/analyze", { videoTitle: getDemoVideo().title, comments: getDemoComments() })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.source).toBe("heuristic");
    expect(body.analysis.clusters.themes).toHaveLength(4);
    expect(body.analysis.ideas.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/plan (demo)", () => {
  it("builds a plan from the bundled channel without keys or network", async () => {
    const { POST } = await import("@/app/api/plan/route");
    const res = await POST(post("/api/plan", { input: "DEMO" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.plan.title.length).toBeGreaterThan(5);
    expect(body.stats.medianViewsPerDay).toBeGreaterThan(0);
    expect(body.videosRead.length).toBeGreaterThanOrEqual(4);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/patrol/scan (demo)", () => {
  it("flags the seeded scams from the bundled channel without network", async () => {
    const { POST } = await import("@/app/api/patrol/scan/route");
    const res = await POST(post("/api/patrol/scan", { demo: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.demo).toBe(true);
    expect(body.report.flagged.length).toBeGreaterThanOrEqual(6);
    expect(body.report.verdictSource).toBe("heuristic");
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/analytics (demo)", () => {
  it("joins retention dips to comment timestamps from the fixture curve", async () => {
    const { POST } = await import("@/app/api/analytics/route");
    const { getDemoComments } = await import("@/lib/demo");
    const res = await POST(
      post("/api/analytics", {
        videoId: "DEMO",
        publishedAt: "2026-07-01T00:00:00Z",
        durationSeconds: 1440,
        comments: getDemoComments(),
      })
    );
    const body = await res.json();
    expect(body.demo).toBe(true);
    const dips = body.analytics.retention.dips;
    expect(dips.length).toBeGreaterThanOrEqual(2);
    expect(dips.some((d: any) => d.mentions !== null)).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe("POST /api/actions/apply", () => {
  const RETITLE = {
    id: "retitle",
    kind: "retitle",
    label: "Retitle",
    rationale: "",
    after: "The new title",
    payload: { title: "The new title" },
    source: "heuristic",
  };

  it("previews without a session and without touching the network", async () => {
    const { POST } = await import("@/app/api/actions/apply/route");
    const res = await POST(post("/api/actions/apply", { videoId: "vid00000001", actions: [RETITLE] }));
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.results[0].status).toBe("dry_run");
    expect(calls).toHaveLength(0);
  });

  it("simulates a confirmed publish on the demo dataset", async () => {
    const { POST } = await import("@/app/api/actions/apply/route");
    const res = await POST(
      post("/api/actions/apply", { videoId: "DEMO", actions: [RETITLE], confirm: true })
    );
    const body = await res.json();
    expect(body.simulated).toBe(true);
    expect(body.results[0].status).toBe("simulated");
    expect(body.results[0].message).toContain("nothing was sent to YouTube");
    expect(calls).toHaveLength(0);
  });

  it("refuses to write a video the connected channel does not own", async () => {
    ownVideoChannelId = "UCsomebodyElse0000000000";
    const { POST } = await import("@/app/api/actions/apply/route");
    const res = await POST(
      post(
        "/api/actions/apply",
        { videoId: "vid00000001", actions: [RETITLE], confirm: true },
        sessionCookie()
      )
    );
    const body = await res.json();
    expect(body.results[0].status).toBe("failed");
    expect(body.results[0].message).toMatch(/only change videos/i);
    // It read the video to check ownership and then wrote nothing.
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("writes, re-reads, and reports verified on an owned video", async () => {
    const { POST } = await import("@/app/api/actions/apply/route");
    const res = await POST(
      post(
        "/api/actions/apply",
        { videoId: "vid00000001", actions: [RETITLE], confirm: true, requestId: "req-verify-1" },
        sessionCookie()
      )
    );
    const body = await res.json();
    expect(body.results[0].status).toBe("applied");
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.body?.snippet?.title).toBe("The new title");
    // Description survives untouched — the snippet is rebuilt, not clobbered.
    expect(put?.body?.snippet?.description).toBe("The old description");
    expect(body.results[0].verified?.title).toBeDefined();
  });

  it("rejects a duplicate requestId instead of double-publishing", async () => {
    const { POST } = await import("@/app/api/actions/apply/route");
    const send = () =>
      POST(
        post(
          "/api/actions/apply",
          { videoId: "vid00000001", actions: [RETITLE], confirm: true, requestId: "req-dupe-1" },
          sessionCookie()
        )
      );
    const first = await send();
    expect(first.status).toBe(200);
    const second = await send();
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.code).toBe("duplicate");
  });
});

describe("POST /api/actions/undo", () => {
  it("restores the exact prior snippet", async () => {
    const { POST } = await import("@/app/api/actions/undo/route");
    const res = await POST(
      post(
        "/api/actions/undo",
        {
          undo: {
            kind: "restore_snippet",
            videoId: "vid00000001",
            title: "The original title",
            description: "The original description",
          },
        },
        sessionCookie()
      )
    );
    expect(res.status).toBe(200);
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.body?.snippet?.title).toBe("The original title");
    expect(put?.body?.snippet?.description).toBe("The original description");
  });

  it("refuses without a session", async () => {
    const { POST } = await import("@/app/api/actions/undo/route");
    const res = await POST(
      post("/api/actions/undo", {
        undo: { kind: "delete_comment", commentId: "c1" },
      })
    );
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });
});

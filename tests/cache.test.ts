import { describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { cachePathFor, readCachedComments, writeCachedComments } from "@/lib/cache";
import type { Comment } from "@/lib/types";

describe("comment cache", () => {
  it("round-trips comments through the cache dir", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "as-cache-"));
    const comments: Comment[] = [
      { id: "c1", author: "@a", text: "hi", likeCount: 1, publishedAt: "2026-01-01T00:00:00Z" },
    ];
    await writeCachedComments("abcDEF12345", comments, dir);
    const cached = await readCachedComments("abcDEF12345", dir);
    expect(cached?.comments).toEqual(comments);
    expect(cached?.videoId).toBe("abcDEF12345");
    expect(Date.parse(cached!.fetchedAt)).not.toBeNaN();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns null for a cache miss", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "as-cache-"));
    expect(await readCachedComments("missing12345", dir)).toBeNull();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("rejects path-traversal video ids", () => {
    expect(() => cachePathFor("../../etc/passwd")).toThrow();
    expect(() => cachePathFor("ok_id-123")).not.toThrow();
  });
});

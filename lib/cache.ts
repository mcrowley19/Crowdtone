import { promises as fs } from "fs";
import path from "path";
import type { Comment } from "./types";

export interface CachedComments {
  videoId: string;
  fetchedAt: string;
  comments: Comment[];
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,32}$/;

// Serverless filesystems are read-only apart from /tmp, so the cache lives there when
// deployed. /tmp survives between invocations that reuse a warm instance, which is
// exactly the repeat-run case the cache exists to serve.
const DEFAULT_CACHE_DIR = process.env.VERCEL
  ? path.join("/tmp", "crowdtone-cache")
  : path.join(process.cwd(), "data", "cache");

export function cachePathFor(videoId: string, baseDir = DEFAULT_CACHE_DIR): string {
  if (!SAFE_ID.test(videoId)) throw new Error(`Unsafe video id: ${videoId}`);
  return path.join(baseDir, `${videoId}.json`);
}

export async function readCachedComments(
  videoId: string,
  baseDir?: string
): Promise<CachedComments | null> {
  try {
    const raw = await fs.readFile(cachePathFor(videoId, baseDir), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.comments)) return null;
    return parsed as CachedComments;
  } catch {
    return null;
  }
}

export async function writeCachedComments(
  videoId: string,
  comments: Comment[],
  baseDir?: string
): Promise<CachedComments> {
  const file = cachePathFor(videoId, baseDir);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const payload: CachedComments = {
    videoId,
    fetchedAt: new Date().toISOString(),
    comments,
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

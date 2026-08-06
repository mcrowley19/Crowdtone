/**
 * The chapters engine started life in this file and is now maintained as the
 * open-source package `youtube-chapter-kit` (extracted from this project):
 * https://github.com/mcrowley19/youtube-chapter-kit
 *
 * This module re-exports it so the rest of the app keeps one import path.
 */
export {
  MIN_CHAPTERS,
  MIN_CHAPTER_GAP_S,
  buildChapters,
  extractTimestampMentions,
  formatTimestamp,
  mergeChaptersIntoDescription,
  parseISODuration,
  parseTimestamp,
  renderChapterBlock,
} from "youtube-chapter-kit";
export type { Chapter, TimestampMention } from "youtube-chapter-kit";

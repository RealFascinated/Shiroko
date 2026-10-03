import { boolean, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { youtubeChannelsSchema } from "./youtube-channels";

/**
 * One row per upload the poller has seen, keyed by the pair the feed gives us.
 *
 * The row is claimed with `INSERT ... ON CONFLICT DO NOTHING`, so the returned
 * row's presence is the "is this video new" verdict; there is no last-N scan
 * to get wrong. `posted` records whether the fan-out reached at least one
 * destination, so a video whose destinations all failed can be retried.
 */
export const seenYoutubeUploadsSchema = pgTable(
  "seen_youtube_uploads",
  {
    youtubeChannelId: text("youtube_channel_id")
      .notNull()
      .references(() => youtubeChannelsSchema.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    /** Kept so a retry can render the message without refetching the feed. */
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
    posted: boolean("posted").notNull().default(false),
  },
  table => [
    primaryKey({ columns: [table.youtubeChannelId, table.videoId] }),
    index("seen_youtube_uploads_seen_idx").on(table.seenAt),
  ]
);

export type SeenYoutubeUploadSchema = typeof seenYoutubeUploadsSchema.$inferSelect;

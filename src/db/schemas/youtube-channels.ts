import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A YouTube channel tracked by at least one guild.
 *
 * Global rather than per-guild: the feed is fetched once per channel, and many
 * guilds can subscribe to the same one. `youtube_subscriptions` carries the
 * per-guild destination, so removing the last subscription is what deletes
 * this row.
 *
 * `displayName` comes from the feed's `<author><name>`, so no API key is
 * needed to learn a channel's name. `last_video_id` is the newest video id
 * seen in a successful poll; it bounds "new" uploads for the next one. A
 * channel whose first fetch has not succeeded yet has it null, and that first
 * poll seeds instead of announcing.
 */
export const youtubeChannelsSchema = pgTable("youtube_channels", {
  /** The `UC...` channel id the feed is keyed by. */
  id: text("id").primaryKey(),
  /** The channel's name, read from the feed; never the raw id. */
  displayName: text("display_name").notNull(),
  /** The raw input the user added (`@handle` or URL); display only. */
  handle: text("handle"),
  lastVideoId: text("last_video_id"),
  /** Conditional-request validators from the last feed response. */
  etag: text("etag"),
  lastModified: text("last_modified"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
});

export type YoutubeChannelSchema = typeof youtubeChannelsSchema.$inferSelect;

import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { youtubeChannelsSchema } from "./youtube-channels";

/**
 * Where a guild wants a tracked channel's uploads announced. One destination
 * per (guild, YouTube channel): `/youtube add` sets it, and re-adding the same
 * channel repoints it.
 */
export const youtubeSubscriptionsSchema = pgTable(
  "youtube_subscriptions",
  {
    guildId: text("guild_id").notNull(),
    youtubeChannelId: text("youtube_channel_id")
      .notNull()
      .references(() => youtubeChannelsSchema.id, { onDelete: "cascade" }),
    discordChannelId: text("discord_channel_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.youtubeChannelId] }),
    // The poller loads every destination for one channel, so index the
    // non-leading channel column rather than the primary key's guild.
    index("youtube_subscriptions_youtube_idx").on(table.youtubeChannelId),
  ]
);

export type YoutubeSubscriptionSchema = typeof youtubeSubscriptionsSchema.$inferSelect;

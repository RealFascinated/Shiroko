import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsers } from "./global-users";

export const messageEvents = pgTable(
  "message_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("message_events_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("message_events_guild_created_idx").on(table.guildId, table.createdAt.desc()),
    index("message_events_guild_user_idx").on(table.guildId, table.userId),
  ]
);

export type MessageEventSchema = typeof messageEvents.$inferSelect;

import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { globalUsers } from "./global-users";

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
  },
  table => [
    index("voice_sessions_user_joined_idx").on(table.userId, table.joinedAt.desc()),
    index("voice_sessions_guild_joined_idx").on(table.guildId, table.joinedAt.desc()),
    index("voice_sessions_guild_user_idx").on(table.guildId, table.userId),
  ]
);

export type VoiceSessionSchema = typeof voiceSessions.$inferSelect;

import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsers } from "./global-users";

export const guildUsers = pgTable(
  "guild_users",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

export type GuildUserSchema = typeof guildUsers.$inferSelect;

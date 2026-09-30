import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

export const guildUsersSchema = pgTable(
  "guild_users",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

export type GuildUserSchema = typeof guildUsersSchema.$inferSelect;

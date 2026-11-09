import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

/**
 * A member currently marked AFK in one guild. The row exists only while
 * they are away: speaking again or running `/afk` clear/replace it.
 */
export const guildAfkSchema = pgTable(
  "guild_afk",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    reason: text("reason"),
    since: timestamp("since", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

export type GuildAfkSchema = typeof guildAfkSchema.$inferSelect;

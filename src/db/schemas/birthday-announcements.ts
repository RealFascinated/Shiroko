import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

/**
 * One row per birthday announced, so the sweep can run more than once a day
 * and still post each celebrant exactly once. The sweep claims a row with an
 * insert before it sends; a failed send releases the claim so the next run
 * retries.
 */
export const birthdayAnnouncementsSchema = pgTable(
  "birthday_announcements",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId, table.year] }),
    index("birthday_announcements_user_id_idx").on(table.userId),
  ]
);

export type BirthdayAnnouncementSchema = typeof birthdayAnnouncementsSchema.$inferSelect;

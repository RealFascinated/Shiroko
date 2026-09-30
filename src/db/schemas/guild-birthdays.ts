import { sql } from "drizzle-orm";
import { date, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

export const guildBirthdaysSchema = pgTable(
  "guild_birthdays",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    birthDate: date("birth_date", { mode: "date" }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    // The sweep and `upcoming` match on month and day, not the full date, so
    // the index is on the extracts rather than the column itself.
    index("guild_birthdays_month_day_idx").on(
      sql`extract(month from ${table.birthDate})`,
      sql`extract(day from ${table.birthDate})`
    ),
  ]
);

export type GuildBirthdaySchema = typeof guildBirthdaysSchema.$inferSelect;

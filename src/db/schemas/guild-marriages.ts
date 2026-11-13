import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

/**
 * One marriage per guild, stored as two mirrored rows (one per spouse) so
 * "who is X married to" is a primary-key lookup. Both rows are written and
 * deleted together.
 */
export const guildMarriagesSchema = pgTable(
  "guild_marriages",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    partnerId: text("partner_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    marriedAt: timestamp("married_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("guild_marriages_user_id_idx").on(table.userId),
    index("guild_marriages_partner_id_idx").on(table.partnerId),
  ]
);

export type GuildMarriageSchema = typeof guildMarriagesSchema.$inferSelect;

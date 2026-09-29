import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Roles automatically granted to a member on joining. One row per
 * (guild, role) pair; the role id is plain text, matching how the codebase
 * stores Discord role ids (no FK, since roles live in the Discord API).
 */
export const autoroles = pgTable(
  "autoroles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);

export type AutoroleSchema = typeof autoroles.$inferSelect;

import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const autorolesSchema = pgTable(
  "autoroles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);

export type AutoroleSchema = typeof autorolesSchema.$inferSelect;

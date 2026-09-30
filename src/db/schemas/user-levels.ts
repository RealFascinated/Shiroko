import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

export const userLevelsSchema = pgTable(
  "user_levels",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("user_levels_guild_xp_idx").on(table.guildId, table.xp.desc()),
  ]
);

export type UserLevelSchema = typeof userLevelsSchema.$inferSelect;

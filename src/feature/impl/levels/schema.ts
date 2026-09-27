import { index, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsers } from "../../../db/schema";

export const userLevels = pgTable(
  "user_levels",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("user_levels_guild_xp_idx").on(table.guildId, table.xp.desc()),
  ]
);

export const levelRewards = pgTable(
  "level_rewards",
  {
    guildId: text("guild_id").notNull(),
    level: integer("level").notNull(),
    type: text("type").notNull(),
    roleId: text("role_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.level] })]
);

export type UserLevelSchema = typeof userLevels.$inferSelect;
export type LevelRewardSchema = typeof levelRewards.$inferSelect;

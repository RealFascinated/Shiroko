import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

export type LevelRewardSchema = typeof levelRewards.$inferSelect;

import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const guildFeatures = pgTable(
  "guild_features",
  {
    guildId: text("guild_id").notNull(),
    featureId: text("feature_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.featureId] })]
);

export type GuildFeatureSchema = typeof guildFeatures.$inferSelect;

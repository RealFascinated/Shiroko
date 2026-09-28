import { jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const guildSettings = pgTable(
  "guild_settings",
  {
    guildId: text("guild_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull().$type<JsonValue>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.key] })]
);

export type GuildSettingSchema = typeof guildSettings.$inferSelect;

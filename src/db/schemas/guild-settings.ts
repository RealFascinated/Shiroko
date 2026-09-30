import { customType, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * A `jsonb` column. `node-postgres` already parses `jsonb` into a JS value,
 * so drizzle's own `jsonb` would parse the result a second time: a numeric
 * string such as a snowflake id then round-trips through `JSON.parse` as a
 * lossy number. Writing still stringifies; reading takes the value as-is.
 */
const json = customType<{ data: JsonValue; driverData: JsonValue }>({
  dataType: () => "jsonb",
  toDriver: value => JSON.stringify(value),
});

export const guildSettings = pgTable(
  "guild_settings",
  {
    guildId: text("guild_id").notNull(),
    key: text("key").notNull(),
    value: json("value").notNull().$type<JsonValue>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.key] })]
);

export type GuildSettingSchema = typeof guildSettings.$inferSelect;

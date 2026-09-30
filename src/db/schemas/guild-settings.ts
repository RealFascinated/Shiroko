import { customType, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const json = customType<{ data: JsonValue; driverData: JsonValue }>({
  dataType: () => "jsonb",
  toDriver: value => JSON.stringify(value),
});

export const guildSettingsSchema = pgTable(
  "guild_settings",
  {
    guildId: text("guild_id").notNull(),
    key: text("key").notNull(),
    value: json("value").notNull().$type<JsonValue>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.key] })]
);

export type GuildSettingSchema = typeof guildSettingsSchema.$inferSelect;

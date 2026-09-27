import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const globalUsers = pgTable("global_users", {
  id: text("id").primaryKey(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
});

export const guildUsers = pgTable(
  "guild_users",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

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

export const permissionRoles = pgTable(
  "permission_roles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    flags: text("flags").notNull().default("0"),
    parentRoleId: text("parent_role_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);

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

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const schema = {
  globalUsers,
  guildUsers,
  guildFeatures,
  permissionRoles,
  guildSettings,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type GuildUserSchema = typeof guildUsers.$inferSelect;
export type GuildFeatureSchema = typeof guildFeatures.$inferSelect;
export type PermissionRoleSchema = typeof permissionRoles.$inferSelect;
export type GuildSettingSchema = typeof guildSettings.$inferSelect;
export const now = sql`now()`;

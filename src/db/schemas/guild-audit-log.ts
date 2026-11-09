import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { JsonValue } from "./guild-settings";

export const guildAuditLogSchema = pgTable(
  "guild_audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guildId: text("guild_id").notNull(),
    // null = the bot itself (a Discord role event, not a person)
    actorId: text("actor_id"),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    // null = unset / default
    oldValue: jsonb("old_value").$type<JsonValue>(),
    newValue: jsonb("new_value").$type<JsonValue>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("guild_audit_log_guild_created_idx").on(table.guildId, table.createdAt.desc()),
    index("guild_audit_log_guild_key_idx").on(table.guildId, table.key),
  ]
);

export type GuildAuditLogSchema = typeof guildAuditLogSchema.$inferSelect;

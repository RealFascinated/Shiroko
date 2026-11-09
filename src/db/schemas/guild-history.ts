import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { JsonValue } from "./guild-settings";

export const guildHistorySchema = pgTable(
  "guild_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    guildId: text("guild_id").notNull(),
    kind: text("kind").notNull(),
    // The user, role, channel, emoji or invite the change is about; not a
    // foreign key because it is not always a user.
    subjectId: text("subject_id").notNull(),
    // null = unknown (no actor found) or the bot itself
    actorId: text("actor_id"),
    // null = unset
    oldValue: jsonb("old_value").$type<JsonValue>(),
    newValue: jsonb("new_value").$type<JsonValue>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("guild_history_subject_created_idx").on(table.guildId, table.subjectId, table.createdAt.desc()),
    index("guild_history_kind_created_idx").on(table.guildId, table.kind, table.createdAt.desc()),
  ]
);

export type GuildHistorySchema = typeof guildHistorySchema.$inferSelect;

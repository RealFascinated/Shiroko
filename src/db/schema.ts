import { sql } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const globalUsers = pgTable("global_users", {
  id: text("id").primaryKey(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
});

export const interactions = pgTable(
  "interactions",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    count: integer("count").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.actorId, table.targetId, table.type] })]
);

/**
 * One row per guild message sent by a user. `id` is the Discord message id,
 * so redelivered events dedupe on insert. Metadata only; message content is
 * never stored.
 */
export const messageEvents = pgTable(
  "message_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("message_events_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("message_events_guild_created_idx").on(table.guildId, table.createdAt.desc()),
  ]
);

/**
 * One row per voice session. A row is open while the user is in voice
 * (`leftAt` is null); leaving sets `leftAt` and `durationSeconds`.
 */
export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
  },
  table => [
    index("voice_sessions_user_joined_idx").on(table.userId, table.joinedAt.desc()),
    index("voice_sessions_guild_joined_idx").on(table.guildId, table.joinedAt.desc()),
  ]
);

export const schema = {
  globalUsers,
  interactions,
  messageEvents,
  voiceSessions,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type InteractionSchema = typeof interactions.$inferSelect;
export type MessageEventSchema = typeof messageEvents.$inferSelect;
export type VoiceSessionSchema = typeof voiceSessions.$inferSelect;
export const now = sql`now()`;

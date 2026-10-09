import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { JsonValue } from "./guild-settings";

/**
 * Interactive components attached to a message: one row per component, so a
 * press is resolved by a database lookup instead of an in-process collector
 * and therefore survives a restart.
 *
 * `messageId` groups the components of one message, so a handler can rewrite
 * or drop its siblings in a single query, and the expiry sweep can find the
 * message it must strip. `userId` is the only user allowed to press; null
 * means anyone. `type` gates the interaction kind, so a row can never be
 * satisfied by the wrong sort of component. `expiresAt` is null for a row
 * that never expires.
 *
 * `guildId` is null for a component on a DM reply, which a user-installable
 * command can produce; it is matched against the interaction rather than
 * required, so those presses resolve too.
 *
 * `extraData` carries what the handler cannot re-derive. Anything that lives
 * in the database is re-queried on press rather than copied in here, so a
 * stale payload cannot disagree with the stored state.
 */
export const componentsSchema = pgTable(
  "components",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    guildId: text("guild_id"),
    channelId: text("channel_id"),
    messageId: text("message_id").notNull(),
    userId: text("user_id"),
    type: text("type").notNull(),
    extraData: jsonb("extra_data").notNull().$type<JsonValue>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  table => [
    index("components_message_idx").on(table.messageId),
    index("components_expires_idx").on(table.expiresAt),
  ]
);

export type ComponentSchema = typeof componentsSchema.$inferSelect;

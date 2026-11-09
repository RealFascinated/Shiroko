import { bigint, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";
import type { JsonValue } from "./guild-settings";

export const userAuditSchema = pgTable(
  "audit_log_users",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    // null = unset
    oldValue: jsonb("old_value").$type<JsonValue>(),
    newValue: jsonb("new_value").$type<JsonValue>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index("audit_log_users_user_created_idx").on(table.userId, table.createdAt.desc())]
);

export type UserAuditSchema = typeof userAuditSchema.$inferSelect;

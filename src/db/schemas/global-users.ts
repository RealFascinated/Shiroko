import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const globalUsersSchema = pgTable("global_users", {
  id: text("id").primaryKey(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
});

export type GlobalUserSchema = typeof globalUsersSchema.$inferSelect;

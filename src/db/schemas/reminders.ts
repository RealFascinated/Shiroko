import { boolean, index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

/**
 * A scheduled reminder. Global and user-scoped: there is no guild column,
 * and the auto-incrementing `id` is the reminder's user-facing number. The
 * delivery target is resolved at set time into `channel_id` (a DM channel
 * or a guild channel), so the sweep that drains due rows never branches.
 */
export const remindersSchema = pgTable(
  "reminders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    dm: boolean("dm").notNull(),
    about: text("about").notNull(),
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index("reminders_remind_at_idx").on(table.remindAt)]
);

export type ReminderSchema = typeof remindersSchema.$inferSelect;

import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { componentsSchema } from "./components";
import { globalUsersSchema } from "./global-users";

/**
 * A member's wish on a birthday announcement. Keyed to the announcement's
 * button row rather than the message, so the expiry sweep that drops the
 * button's `components` row takes its wishes with it.
 */
export const birthdayWishesSchema = pgTable(
  "birthday_wishes",
  {
    componentId: uuid("component_id")
      .notNull()
      .references(() => componentsSchema.id, { onDelete: "cascade" }),
    wisherId: text("wisher_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.componentId, table.wisherId] }),
    index("birthday_wishes_wisher_id_idx").on(table.wisherId),
  ]
);

export type BirthdayWishSchema = typeof birthdayWishesSchema.$inferSelect;

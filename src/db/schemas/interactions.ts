import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { globalUsersSchema } from "./global-users";

export const interactionsSchema = pgTable(
  "interactions",
  {
    actorId: text("actor_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    targetId: text("target_id")
      .notNull()
      .references(() => globalUsersSchema.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    count: integer("count").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.actorId, table.targetId, table.type] })]
);

export type InteractionSchema = typeof interactionsSchema.$inferSelect;

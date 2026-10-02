import { bigint, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Cumulative slash-command invocations, one row per command. `count`
 * accumulates in place via an upsert, so the table stays small no matter
 * how many calls happen; the per-call detail lives in the event stream,
 * not here.
 *
 * `command` is the top-level command id, so `/user avatar` and
 * `/user banner` collapse into `user`; a call that is refused by a gate
 * (feature off, missing permission) is not counted.
 */
export const commandCallsSchema = pgTable("command_calls", {
  command: text("command").primaryKey(),
  count: bigint("count", { mode: "number" }).notNull().default(1),
});

export type CommandCallSchema = typeof commandCallsSchema.$inferSelect;

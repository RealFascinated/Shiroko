import { integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { componentsSchema } from "./components";

/**
 * One player's guess on a trivia question. Keyed to the question's first
 * answer button so the primary key allows one guess per player, and the
 * expiry sweep that drops that button's row takes the guesses with it.
 */
export const triviaGuessesSchema = pgTable(
  "trivia_guesses",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => componentsSchema.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    answerIndex: integer("answer_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.gameId, table.userId] })]
);

export type TriviaGuessSchema = typeof triviaGuessesSchema.$inferSelect;

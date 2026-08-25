import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

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
 * Cooldowns, keyed by subject (e.g. "gamble:123456"). `endsAt` is when the
 * cooldown lifts; `metadata` carries an optional arbitrary payload (amounts,
 * streak counts, flavor) alongside the timer. Backed by Postgres via
 * `DbCooldowns`; in-memory sessions use `MemoryCooldowns` instead.
 */
export const cooldowns = pgTable("cooldowns", {
  key: text("key").primaryKey(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata"),
});

/**
 * Per-user rune economy: spendable wallet, safe bank, and daily-claim
 * streak tracking. A row exists for every user who has interacted with the
 * economy.
 */
export const userEconomy = pgTable("economy_user_economy", {
  userId: text("user_id")
    .primaryKey()
    .references(() => globalUsers.id, { onDelete: "cascade" }),
  wallet: integer("wallet").notNull().default(0),
  bank: integer("bank").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  lastClaimed: timestamp("last_claimed", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Per-user quest state: the daily and weekly lists drawn for the current
 * period, each quest's progress, and which have been claimed. A row is
 * `null` for quests not in the user's current lists. `dailyStart`/`dailyEnd`
 * and `weeklyStart`/`weeklyEnd` bound the period; `id` is stable across the
 * list re-rolls via the unique `(userId, period, kind, slug)`.
 */
export const quests = pgTable("quests", {
  userId: text("user_id")
    .notNull()
    .references(() => globalUsers.id, { onDelete: "cascade" }),
  period: text("period").notNull(), // e.g. "2026-08-25" (daily) or "2026-W35" (weekly)
  kind: text("kind").notNull(), // "daily" | "weekly"
  slug: text("slug").notNull(), // quest definition id, e.g. "earn:500"
  progress: integer("progress").notNull().default(0),
  claimed: boolean("claimed").notNull().default(false),
  dailyStart: timestamp("daily_start", { withTimezone: true }).notNull(),
  dailyEnd: timestamp("daily_end", { withTimezone: true }).notNull(),
  weeklyStart: timestamp("weekly_start", { withTimezone: true }).notNull(),
  weeklyEnd: timestamp("weekly_end", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The two pockets a rune balance lives in: the spendable wallet or the safe bank. */
export const pocketEnum = pgEnum("pocket", ["wallet", "bank"]);

/**
 * Every rune flow in the economy, one row per flow. `amount` is the net
 * delta at `actorPocket` (positive = gained, negative = spent/lost). A flow
 * touching a second user records their id and pocket in the `target*`
 * columns; fees, tips, and gains with no counterparty leave them `null`.
 * `metadata` carries optional per-kind extras (streak counts, wagers, GIF
 * sources) without a schema change.
 */
export const economyTransactions = pgTable(
  "economy_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    actorPocket: pocketEnum("actor_pocket").notNull(),
    amount: integer("amount").notNull(),
    kind: text("kind").notNull(),
    targetId: text("target_id").references(() => globalUsers.id, { onDelete: "cascade" }),
    targetPocket: pocketEnum("target_pocket"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("economy_transactions_created_idx").on(table.createdAt.desc()),
    index("economy_transactions_actor_idx").on(table.actorId, table.createdAt.desc()),
  ]
);

export const schema = {
  globalUsers,
  interactions,
  cooldowns,
  userEconomy,
  quests,
  economyTransactions,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type InteractionSchema = typeof interactions.$inferSelect;
export type CooldownSchema = typeof cooldowns.$inferSelect;
export type UserEconomySchema = typeof userEconomy.$inferSelect;
export type QuestSchema = typeof quests.$inferSelect;
export type EconomyTransactionSchema = typeof economyTransactions.$inferSelect;
export type Pocket = "wallet" | "bank";
export const now = sql`now()`;

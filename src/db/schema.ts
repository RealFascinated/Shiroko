import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

export const schema = {
  globalUsers,
  interactions,
  cooldowns,
  userEconomy,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type InteractionSchema = typeof interactions.$inferSelect;
export type CooldownSchema = typeof cooldowns.$inferSelect;
export type UserEconomySchema = typeof userEconomy.$inferSelect;
export const now = sql`now()`;

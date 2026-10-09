import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const inviteJoinsSchema = pgTable(
  "invite_joins",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    // The member whose invite it is; null for a vanity URL or unattributed join.
    inviterId: text("inviter_id"),
    // The invite code the join used, or the vanity URL's code; null when unattributed.
    code: text("code"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    // When the member left the guild; null while they are still in it.
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  table => [
    index("invite_joins_guild_joined_idx").on(table.guildId, table.joinedAt.desc()),
    index("invite_joins_inviter_idx").on(table.guildId, table.inviterId),
    index("invite_joins_member_idx").on(table.guildId, table.memberId, table.joinedAt.desc()),
  ]
);

export type InviteJoinSchema = typeof inviteJoinsSchema.$inferSelect;

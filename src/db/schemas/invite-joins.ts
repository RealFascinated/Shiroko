import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const inviteJoins = pgTable(
  "invite_joins",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    guildId: text("guild_id").notNull(),
    memberId: text("member_id").notNull(),
    inviterId: text("inviter_id"),
    code: text("code"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("invite_joins_guild_joined_idx").on(table.guildId, table.joinedAt.desc()),
    index("invite_joins_inviter_idx").on(table.guildId, table.inviterId),
  ]
);

export type InviteJoinSchema = typeof inviteJoins.$inferSelect;

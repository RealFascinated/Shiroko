import { sql } from "drizzle-orm";
import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const guildInvites = pgTable(
  "guild_invites",
  {
    guildId: text("guild_id").notNull(),
    code: text("code").notNull(),
    inviterId: text("inviter_id"),
    uses: integer("uses").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.code] })]
);

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

export type GuildInviteSchema = typeof guildInvites.$inferSelect;
export type InviteJoinSchema = typeof inviteJoins.$inferSelect;

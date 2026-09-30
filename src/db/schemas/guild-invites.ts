import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const guildInvitesSchema = pgTable(
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

export type GuildInviteSchema = typeof guildInvitesSchema.$inferSelect;

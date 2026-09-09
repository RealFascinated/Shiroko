import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
 * One row per guild message sent by a user. `id` is the Discord message id,
 * so redelivered events dedupe on insert. Metadata only; message content is
 * never stored.
 */
export const messageEvents = pgTable(
  "message_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index("message_events_user_created_idx").on(table.userId, table.createdAt.desc()),
    index("message_events_guild_created_idx").on(table.guildId, table.createdAt.desc()),
  ]
);

/**
 * One row per voice session. A row is open while the user is in voice
 * (`leftAt` is null); leaving sets `leftAt` and `durationSeconds`.
 */
export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
  },
  table => [
    index("voice_sessions_user_joined_idx").on(table.userId, table.joinedAt.desc()),
    index("voice_sessions_guild_joined_idx").on(table.guildId, table.joinedAt.desc()),
  ]
);

/**
 * Explicit per-guild feature toggles. Missing rows fall back to the
 * feature's default; stored rows override it.
 */
export const guildFeatures = pgTable(
  "guild_features",
  {
    guildId: text("guild_id").notNull(),
    featureId: text("feature_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.featureId] })]
);

/**
 * One row per guild invite code, snapshotting its current use count so
 * joins can be diffed against the live cache after a restart.
 */
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

/**
 * Per-role bot permission configuration for one guild. `roleId` equals the
 * guild id for the `@everyone` role. `flags` is a BigInt bitfield stored as
 * a decimal string (see `PermissionFlags` in `src/permission/permissions.ts`).
 * `parentRoleId` links to another row in the same guild for additive
 * permission inheritance; a dangling or missing parent resolves to no
 * inherited flags (no FK — the link is enforced in the app layer).
 */
export const permissionRoles = pgTable(
  "permission_roles",
  {
    guildId: text("guild_id").notNull(),
    roleId: text("role_id").notNull(),
    flags: text("flags").notNull().default("0"),
    parentRoleId: text("parent_role_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.roleId] })]
);

/**
 * One row per guild join with an attributed invite code. `inviterId` and
 * `code` are null when the join came from outside a tracked invite
 * (vanity URL, OAuth widget, expired single-use code). Totals derive from
 * `count()`/`groupBy` — there is no counter column to desync.
 */
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

export const schema = {
  globalUsers,
  interactions,
  messageEvents,
  voiceSessions,
  guildFeatures,
  guildInvites,
  inviteJoins,
  permissionRoles,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type InteractionSchema = typeof interactions.$inferSelect;
export type MessageEventSchema = typeof messageEvents.$inferSelect;
export type VoiceSessionSchema = typeof voiceSessions.$inferSelect;
export type GuildFeatureSchema = typeof guildFeatures.$inferSelect;
export type GuildInviteSchema = typeof guildInvites.$inferSelect;
export type InviteJoinSchema = typeof inviteJoins.$inferSelect;
export type PermissionRoleSchema = typeof permissionRoles.$inferSelect;
export const now = sql`now()`;

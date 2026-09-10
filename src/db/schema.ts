import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const globalUsers = pgTable("global_users", {
  id: text("id").primaryKey(),
  firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per user per guild. The per-guild view of a global user:
 * `lastMessageAt` is the timestamp of the user's most recent message in
 * the guild, used to gate the levelling message-XP cooldown. Row creation
 * is idempotent (INSERT ... ON CONFLICT DO NOTHING), so a row may exist
 * before any level data is tracked.
 */
export const guildUsers = pgTable(
  "guild_users",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.userId] })]
);

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
 * inherited flags (no FK; the link is enforced in the app layer).
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
 * `count()`/`groupBy`; there is no counter column to desync.
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

/**
 * One row per user per guild for levelling. `xp` is cumulative; the level
 * is always derived from `xp` at read time (see `levelForXp`), so there
 * is no stored level column to go stale.
 * The message-XP cooldown is gated by `guild_users.last_message_at`.
 */
export const userLevels = pgTable(
  "user_levels",
  {
    guildId: text("guild_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => globalUsers.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index("user_levels_guild_xp_idx").on(table.guildId, table.xp.desc()),
  ]
);

/**
 * One reward row per (guild, level). `type` discriminates the reward kind;
 * only "Role" exists today; future kinds add a variant, not a new table.
 * `roleId` is set for Role rewards.
 */
export const levelRewards = pgTable(
  "level_rewards",
  {
    guildId: text("guild_id").notNull(),
    level: integer("level").notNull(),
    type: text("type").notNull(),
    roleId: text("role_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.guildId, table.level] })]
);

/**
 * Per-guild levelling configuration. Missing rows fall back to the defaults
 * below. `ignoredChannelIds` is a JSON array of Discord channel ids.
 * `announceChannelId` is null/absent when level-ups should not be announced;
 * when set, level-ups are posted to that channel.
 */
export const levelConfigs = pgTable("level_configs", {
  guildId: text("guild_id").primaryKey(),
  messageXp: integer("message_xp").notNull().default(10),
  messageCooldownSeconds: integer("message_cooldown_seconds").notNull().default(60),
  voiceXpPerMin: integer("voice_xp_per_min").notNull().default(5),
  ignoredChannelIds: text("ignored_channel_ids").notNull().default("[]"),
  announceChannelId: text("announce_channel_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  globalUsers,
  guildUsers,
  interactions,
  messageEvents,
  voiceSessions,
  guildFeatures,
  guildInvites,
  inviteJoins,
  permissionRoles,
  userLevels,
  levelRewards,
  levelConfigs,
};

export type GlobalUserSchema = typeof globalUsers.$inferSelect;
export type GuildUserSchema = typeof guildUsers.$inferSelect;
export type InteractionSchema = typeof interactions.$inferSelect;
export type MessageEventSchema = typeof messageEvents.$inferSelect;
export type VoiceSessionSchema = typeof voiceSessions.$inferSelect;
export type GuildFeatureSchema = typeof guildFeatures.$inferSelect;
export type GuildInviteSchema = typeof guildInvites.$inferSelect;
export type InviteJoinSchema = typeof inviteJoins.$inferSelect;
export type PermissionRoleSchema = typeof permissionRoles.$inferSelect;
export type UserLevelSchema = typeof userLevels.$inferSelect;
export type LevelRewardSchema = typeof levelRewards.$inferSelect;
export type LevelConfigSchema = typeof levelConfigs.$inferSelect;
export const now = sql`now()`;

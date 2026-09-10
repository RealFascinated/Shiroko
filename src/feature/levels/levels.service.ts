import type { Guild } from "discord.js";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { levelConfigs, levelRewards, userLevels } from "../../db/schema";
import { EventBus } from "../../event/event-bus";
import LevelUpEvent from "../../event/events/level-up.event";
import GuildUsersManager from "../../user/guild-users-manager";
import type UserLevelSnapshot from "./user-level-snapshot";
import { levelForXp, progressToNext, xpForLevel } from "./xp";

export interface RankState {
  level: number;
  xp: number;
  guildRank: number | null;
  totalTracked: number;
  nextLevelXp: number;
  progress: number;
}

export interface LeaderboardRow {
  userId: string;
  xp: number;
}

export interface RewardRow {
  guildId: string;
  level: number;
  type: string;
  roleId: string | null;
}

/**
 * A guild's levelling configuration, read straight from `level_configs`
 * on every request; deliberately not cached.
 */
export interface LevelConfig {
  messageXp: number;
  messageCooldownSeconds: number;
  voiceXpPerMin: number;
  ignoredChannelIds: string[];
  announceChannelId: string | null;
}

export const DEFAULT_CONFIG: LevelConfig = {
  messageXp: 10,
  messageCooldownSeconds: 60,
  voiceXpPerMin: 5,
  ignoredChannelIds: [],
  announceChannelId: null,
};

/**
 * Levelling service. Grants XP for messages and voice, detects level-ups
 * under the fixed curve, persists the new (xp, level) pair via one
 * upsert, and emits `LevelUpEvent` for every level crossed so reward
 * granters and announcements can react independently.
 *
 * Message grants are rate-limited by the guild user's `lastMessageAt`;
 * ignored channels never grant. Voice grants use whole minutes from
 * `VoiceSessionEndedEvent`. XP and levels come straight from the DB on
 * every read; no in-memory level or config cache exists.
 */
export default class LevelsService {
  /**
   * Read a guild's config straight from `level_configs`, falling back to
   * {@link DEFAULT_CONFIG} for guilds without a row. Not cached; config
   * is read per request.
   */
  public async getConfig(guildId: string): Promise<LevelConfig> {
    const [row] = await db.select().from(levelConfigs).where(eq(levelConfigs.guildId, guildId));
    return row ?? { ...DEFAULT_CONFIG };
  }

  /**
   * Persist changes to a guild's config. Returns the effective config.
   */
  public async setConfig(guildId: string, updates: Partial<LevelConfig>): Promise<LevelConfig> {
    const current = await this.getConfig(guildId);
    const next: LevelConfig = { ...current, ...updates };
    const values = {
      guildId,
      messageXp: next.messageXp,
      messageCooldownSeconds: next.messageCooldownSeconds,
      voiceXpPerMin: next.voiceXpPerMin,
      ignoredChannelIds: next.ignoredChannelIds,
      announceChannelId: next.announceChannelId,
    };
    await db
      .insert(levelConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: levelConfigs.guildId,
        set: {
          messageXp: values.messageXp,
          messageCooldownSeconds: values.messageCooldownSeconds,
          voiceXpPerMin: values.voiceXpPerMin,
          ignoredChannelIds: values.ignoredChannelIds,
          announceChannelId: values.announceChannelId,
        },
      });
    return next;
  }

  /**
   * Try to grant message XP to a user in a guild, gated by the per-guild
   * user's `lastMessageAt` cooldown (atomically claimed in SQL — exactly
   * one concurrent message per window wins). Returns the new level
   * snapshot, or `null` when the grant was skipped (bot-safe channel
   * ignored, cooldown not elapsed, no guild).
   */
  public async grantMessageXp(
    guild: Guild,
    userId: string,
    channelId: string,
    now: Date = new Date()
  ): Promise<UserLevelSnapshot | null> {
    const config = await this.getConfig(guild.id);
    if (config.ignoredChannelIds.includes(channelId)) {
      return null;
    }
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return null;
    }
    const claimed = await GuildUsersManager.claimLastMessage(
      guild,
      member.user,
      now,
      config.messageCooldownSeconds
    );
    if (!claimed) {
      return null;
    }
    return this.grant(guild, userId, config.messageXp, now);
  }

  /**
   * Grant voice XP from a completed voice session, at the guild's rate per
   * whole minute. Returns the new level snapshot.
   */
  public async grantVoiceXp(
    guild: Guild,
    userId: string,
    durationSeconds: number,
    now: Date = new Date()
  ): Promise<UserLevelSnapshot> {
    const config = await this.getConfig(guild.id);
    const minutes = Math.max(0, Math.floor(durationSeconds / 60));
    if (minutes === 0) {
      return this.getLevel(guild.id, userId);
    }
    // Voice grants have no cooldown, so `grant` always writes; fall back
    // to a fresh read only if the upsert unexpectedly returned no row.
    return (
      (await this.grant(guild, userId, minutes * config.voiceXpPerMin, now)) ??
      this.getLevel(guild.id, userId)
    );
  }

  /**
   * The (level, xp) pair for a user in a guild, derived fresh from
   * `user_levels`. No cache — every read hits the DB.
   *
   * **Level is always derived from `xp`**. Reads never trust a stored
   * level, so they stay consistent: the same `xp` maps to the same level
   * for everyone.
   */
  public async getLevel(guildId: string, userId: string): Promise<UserLevelSnapshot> {
    const [row] = await db
      .select()
      .from(userLevels)
      .where(and(eq(userLevels.guildId, guildId), eq(userLevels.userId, userId)));
    const xp = row?.xp ?? 0;
    return {
      xp,
      level: levelForXp(xp),
    };
  }

  /**
   * A user's rank card data: cached level/xp plus rank, the XP required
   * for the next level, and progress toward it.
   */
  public async getRankState(guildId: string, userId: string): Promise<RankState> {
    const entry = await this.getLevel(guildId, userId);
    const { position, total } = await this.rankAndTotal(guildId, entry.xp);
    const nextLevelXp = xpForLevel(entry.level + 1);
    const progress = progressToNext(entry.xp);
    return { ...entry, guildRank: position, totalTracked: total, nextLevelXp, progress };
  }

  /**
   * One aggregate query for the user's 1-based rank and the number of
   * users the guild tracks, so rank cards make a single round-trip. Rank
   * counts users with strictly more XP; ties on XP fall back to whoever
   * updated last, but a stable order only really matters when users are
   * exactly tied. `position` is `null` for users with no XP yet.
   */
  private async rankAndTotal(
    guildId: string,
    xp: number
  ): Promise<{ position: number | null; total: number }> {
    const [row] = await db
      .select({
        ahead: sql<number>`count(*) filter (where ${userLevels.xp} > ${xp})`.mapWith(Number),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(userLevels)
      .where(eq(userLevels.guildId, guildId));
    return {
      position: xp === 0 ? null : (row?.ahead ?? 0) + 1,
      total: row?.total ?? 0,
    };
  }

  /**
   * The top `limit` XP holders in a guild (by stored xp, descending).
   */
  public async leaderboard(guildId: string, limit: number): Promise<LeaderboardRow[]> {
    const rows = await db
      .select({ userId: userLevels.userId, xp: userLevels.xp })
      .from(userLevels)
      .where(eq(userLevels.guildId, guildId))
      .orderBy(desc(userLevels.xp))
      .limit(limit);
    return rows.map(row => ({ userId: row.userId, xp: row.xp }));
  }

  /**
   * The guild's first `Role` reward at a level strictly above `atLevel`,
   * or `null` when none is configured. Powers the "next reward at level X"
   * line on rank cards.
   */
  public async nextReward(guildId: string, atLevel: number): Promise<RewardRow | null> {
    const [row] = await db
      .select()
      .from(levelRewards)
      .where(
        and(
          eq(levelRewards.guildId, guildId),
          eq(levelRewards.type, "Role"),
          sql`${levelRewards.level} > ${atLevel}`
        )
      )
      .orderBy(levelRewards.level)
      .limit(1);
    return row ?? null;
  }

  /**
   * Upsert a level reward (role type for now) for a guild level. Rejects
   * levels below 1.
   */
  public async setRewardRole(guild: Guild, level: number, roleId: string): Promise<void> {
    await db
      .insert(levelRewards)
      .values({ guildId: guild.id, level, type: "Role", roleId })
      .onConflictDoUpdate({
        target: [levelRewards.guildId, levelRewards.level],
        set: { type: "Role", roleId },
      });
  }

  /**
   * Remove the reward for a guild level.
   */
  public async removeReward(guildId: string, level: number): Promise<void> {
    await db
      .delete(levelRewards)
      .where(and(eq(levelRewards.guildId, guildId), eq(levelRewards.level, level)));
  }

  /**
   * Every reward row for a guild, ordered by level ascending. Powers the
   * `/levels rewards` listing.
   */
  public async rewards(guildId: string): Promise<RewardRow[]> {
    const rows = await db
      .select()
      .from(levelRewards)
      .where(eq(levelRewards.guildId, guildId))
      .orderBy(levelRewards.level);
    return rows;
  }

  /**
   * Reward rows for a guild between `fromLevel` and `toLevel` inclusive.
   * Used by the level-up reward granter.
   */
  public async rewardsBetween(guildId: string, fromLevel: number, toLevel: number): Promise<RewardRow[]> {
    const rows = await db
      .select()
      .from(levelRewards)
      .where(
        and(
          eq(levelRewards.guildId, guildId),
          sql`${levelRewards.level} >= ${fromLevel}`,
          sql`${levelRewards.level} <= ${toLevel}`
        )
      );
    return rows;
  }

  /**
   * Persist an XP gain and emit a `LevelUpEvent` for every level crossed.
   * The message-XP cooldown is enforced atomically upstream via
   * `GuildUsersManager.claimLastMessage`; this method only ever adds XP.
   */
  private async grant(
    guild: Guild,
    userId: string,
    amount: number,
    now: Date
  ): Promise<UserLevelSnapshot | null> {
    if (amount <= 0) {
      return this.getLevel(guild.id, userId);
    }
    const before = await this.getLevel(guild.id, userId);

    // Atomic upsert: the DB owns the xp total under concurrency; level
    // derives from the returned total.
    const [row] = await db
      .insert(userLevels)
      .values({ guildId: guild.id, userId, xp: amount })
      .onConflictDoUpdate({
        target: [userLevels.guildId, userLevels.userId],
        set: { xp: sql`${userLevels.xp} + ${amount}`, updatedAt: now },
      })
      .returning({ xp: userLevels.xp });

    if (!row) {
      return null;
    }

    const persistedLevel = levelForXp(row.xp);
    const persisted: UserLevelSnapshot = {
      xp: row.xp,
      level: persistedLevel,
    };

    // Emit every level crossed. The pre-grant level is derived from the
    // pre-grant xp (which clamps new users to level 1) so a first grant
    // that jumps multiple levels still emits 1→2.
    const startLevel = levelForXp(before.xp);
    for (let lvl = startLevel + 1; lvl <= persisted.level; lvl++) {
      await EventBus.post(new LevelUpEvent({ userId, guild, prevLevel: lvl - 1, newLevel: lvl }));
    }
    return persisted;
  }
}

export const levelsService = new LevelsService();

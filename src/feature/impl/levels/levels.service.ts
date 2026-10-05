import { db } from "@/db/index";
import { userLevelsSchema } from "@/db/schemas/user-levels";
import { EventBus } from "@/event/event-bus";
import LevelUpEvent from "@/event/events/level-up.event";
import LeaderboardManager from "@/leaderboard/index";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import GuildUsersManager from "@/user/guild-users-manager";
import type { Guild } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { levelsSettings, type LevelReward } from "./levels-settings";
import { levelForXp, progressToNext, xpForLevel } from "./xp";

export interface RankState {
  level: number;
  xp: number;
  guildRank: number | null;
  totalTracked: number;
  nextLevelXp: number;
  progress: number;
}

export interface RewardRow extends LevelReward {
  guildId: string;
  level: number;
}

interface UserLevelSnapshot {
  readonly level: number;
  readonly xp: number;
}

/**
 * Levelling service. Grants XP for messages and voice, detects level-ups
 * under the fixed curve, persists the new (xp, level) pair via one
 * upsert, and emits `LevelUpEvent` for every level crossed so reward
 * granters and announcements can react independently.
 *
 * Message grants are rate-limited by the guild user's `lastMessageAt`;
 * ignored channels never grant. Voice grants use whole minutes from
 * `VoiceSessionEndedEvent`. XP and levels come straight from the DB on
 * every read; config is read through the settings system on every
 * request; no in-memory level or config cache exists.
 */
export default class LevelsService {
  /**
   * Try to grant message XP to a user in a guild, gated by the per-guild
   * user's `lastMessageAt` cooldown (atomically claimed in SQL; exactly
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
    const ignored = await levelsSettings.get(guild.id, "ignoredChannelIds");
    if (ignored.includes(channelId)) {
      return null;
    }
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      return null;
    }
    const cooldownMs = await levelsSettings.get(guild.id, "messageCooldownMs");
    const claimed = await GuildUsersManager.claimLastMessage(
      guild,
      member.user,
      now,
      Math.floor(cooldownMs / 1000)
    );
    if (!claimed) {
      return null;
    }
    const messageXp = await levelsSettings.get(guild.id, "messageXp");
    return this.grant(guild, userId, messageXp, now);
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
    const minutes = Math.max(0, Math.floor(durationSeconds / 60));
    if (minutes === 0) {
      return this.getLevel(guild.id, userId);
    }
    const voiceXpPerMin = await levelsSettings.get(guild.id, "voiceXpPerMin");
    // Voice grants have no cooldown, so `grant` always writes; fall back
    // to a fresh read only if the upsert unexpectedly returned no row.
    return (await this.grant(guild, userId, minutes * voiceXpPerMin, now)) ?? this.getLevel(guild.id, userId);
  }

  /**
   * The (level, xp) pair for a user in a guild, derived fresh from
   * `user_levels`. No cache: every read hits the DB.
   *
   * **Level is always derived from `xp`**. Reads never trust a stored
   * level, so they stay consistent: the same `xp` maps to the same level
   * for everyone.
   */
  public async getLevel(guildId: string, userId: string): Promise<UserLevelSnapshot> {
    const [row] = await db
      .select()
      .from(userLevelsSchema)
      .where(and(eq(userLevelsSchema.guildId, guildId), eq(userLevelsSchema.userId, userId)));
    const xp = row?.xp ?? 0;
    return {
      xp,
      level: levelForXp(xp),
    };
  }

  /**
   * A user's rank card data: level/xp plus the guild's leaderboard
   * standing, the XP required for the next level, and progress toward
   * it.
   */
  public async getRankState(guildId: string, userId: string): Promise<RankState> {
    const position = await LeaderboardManager.getLeaderboard(LeaderboardId.Level).getPosition(
      guildId,
      userId
    );
    const xp = position.row?.value ?? 0;
    const level = levelForXp(xp);
    return {
      xp,
      level,
      guildRank: position.position,
      totalTracked: position.total,
      nextLevelXp: xpForLevel(level + 1),
      progress: progressToNext(xp),
    };
  }

  /**
   * The guild's first `Role` reward at a level strictly above `atLevel`,
   * or `null` when none is configured. Powers the "next reward at level X"
   * line on rank cards.
   */
  public async nextReward(guildId: string, atLevel: number): Promise<RewardRow | null> {
    const rewards = await this.rewards(guildId);
    return rewards.find(reward => reward.type === "Role" && reward.level > atLevel) ?? null;
  }

  /**
   * Upsert a level reward (role type for now) for a guild level. Rejects
   * levels below 1.
   */
  public async setRewardRole(guild: Guild, level: number, roleId: string): Promise<void> {
    await levelsSettings.setEntry(guild.id, "rewards", String(level), { type: "Role", roleId });
  }

  public async removeReward(guildId: string, level: number): Promise<void> {
    await levelsSettings.removeEntry(guildId, "rewards", String(level));
  }

  /**
   * Every reward for a guild, ordered by level ascending. Powers the
   * `/levels rewards` listing.
   */
  public async rewards(guildId: string): Promise<RewardRow[]> {
    const entries = await levelsSettings.entries(guildId, "rewards");
    return Object.entries(entries)
      .map(([level, reward]) => ({ guildId, level: Number(level), ...reward }))
      .sort((a, b) => a.level - b.level);
  }

  /**
   * Rewards for a guild between `fromLevel` and `toLevel` inclusive.
   * Used by the level-up reward granter.
   */
  public async rewardsBetween(guildId: string, fromLevel: number, toLevel: number): Promise<RewardRow[]> {
    const rewards = await this.rewards(guildId);
    return rewards.filter(reward => reward.level >= fromLevel && reward.level <= toLevel);
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
      .insert(userLevelsSchema)
      .values({ guildId: guild.id, userId, xp: amount })
      .onConflictDoUpdate({
        target: [userLevelsSchema.guildId, userLevelsSchema.userId],
        set: { xp: sql`${userLevelsSchema.xp} + ${amount}`, updatedAt: now },
      })
      .returning({ xp: userLevelsSchema.xp });

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

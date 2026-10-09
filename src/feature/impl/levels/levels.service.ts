import { db } from "@/db/index";
import { userLevelsSchema } from "@/db/schemas/user-levels";
import { EventBus } from "@/event/event-bus";
import LevelUpEvent from "@/event/events/level-up.event";
import LeaderboardManager from "@/leaderboard/index";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import GuildUsersManager from "@/user/guild-users-manager";
import type { Guild, Role } from "discord.js";
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

/**
 * Counts from a guild-wide level-reward sync. `changed` counts members who
 * received at least one role; `granted` counts the roles handed out.
 */
export interface LevelsRewardSyncResult {
  scanned: number;
  changed: number;
  granted: number;
  failed: number;
}

/**
 * Progress callback for {@link LevelsService.syncRewardsToGuild}: `scanned`
 * of `total` members have been examined so far.
 */
export type LevelsRewardSyncProgress = (scanned: number, total: number) => Promise<void>;

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

  public async setRewardRole(guild: Guild, level: number, roleId: string): Promise<void> {
    await levelsSettings.setEntry(guild.id, "rewards", String(level), { type: "Role", roleId });
  }

  public async removeReward(guildId: string, level: number): Promise<void> {
    await levelsSettings.removeEntry(guildId, "rewards", String(level));
  }

  public async rewards(guildId: string): Promise<RewardRow[]> {
    const entries = await levelsSettings.entries(guildId, "rewards");
    return Object.entries(entries)
      .map(([level, reward]) => ({ guildId, level: Number(level), ...reward }))
      .sort((a, b) => a.level - b.level);
  }

  public async rewardsBetween(guildId: string, fromLevel: number, toLevel: number): Promise<RewardRow[]> {
    const rewards = await this.rewards(guildId);
    return rewards.filter(reward => reward.level >= fromLevel && reward.level <= toLevel);
  }

  /**
   * Grant every reward role the guild's members have unlocked but do not
   * hold, covering rewards added after a member already passed the level,
   * members who re-joined, and grants that failed while the bot was
   * offline. Bots are ignored and reward roles the bot cannot assign
   * (deleted, or at or above its highest role) are skipped; per-member
   * grant failures are logged and counted, never fatal. `onProgress` is
   * awaited every 100 members and on the final member.
   */
  public async syncRewardsToGuild(
    guild: Guild,
    onProgress?: LevelsRewardSyncProgress
  ): Promise<LevelsRewardSyncResult> {
    const roles = (await this.rewards(guild.id))
      .filter(reward => reward.type === "Role" && reward.roleId)
      .map(reward => ({ level: reward.level, role: guild.roles.cache.get(reward.roleId as string) }))
      .filter(
        (entry): entry is { level: number; role: Role } =>
          entry.role !== undefined && this.isAssignable(entry.role)
      );

    // One query for every stored total, so the sweep costs O(1) reads per
    // member instead of a per-member `getLevel` round trip. A member with
    // no row is level 1.
    const xpRows = await db
      .select({ userId: userLevelsSchema.userId, xp: userLevelsSchema.xp })
      .from(userLevelsSchema)
      .where(eq(userLevelsSchema.guildId, guild.id));
    const xpByUser = new Map(xpRows.map(row => [row.userId, row.xp]));

    const result: LevelsRewardSyncResult = { scanned: 0, changed: 0, granted: 0, failed: 0 };
    const members = await guild.members.fetch();
    const total = members.size;
    for (const member of members.values()) {
      result.scanned++;
      if (!member.user.bot) {
        const level = levelForXp(xpByUser.get(member.id) ?? 0);
        const missing = roles
          .filter(entry => entry.level <= level && !member.roles.cache.has(entry.role.id))
          .map(entry => entry.role);
        if (missing.length > 0) {
          try {
            await member.roles.add(missing, "Level reward");
            result.changed++;
            result.granted += missing.length;
          } catch (error) {
            result.failed++;
            console.error(`Failed to grant level rewards to ${member.id} in ${guild.id}:`, error);
          }
        }
      }
      if (onProgress && (result.scanned % 100 === 0 || result.scanned === total)) {
        await onProgress(result.scanned, total);
      }
    }
    return result;
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
      await EventBus.post(new LevelUpEvent({ userId, guild, prevLevel: lvl - 1, newLevel: lvl, xp: row.xp }));
    }
    return persisted;
  }

  /**
   * Whether a role can be assigned in its guild: it is not `@everyone` and
   * is not above the bot's highest role position.
   */
  private isAssignable(role: Role): boolean {
    if (role.id === role.guild.id) {
      return false;
    }
    const me = role.guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      return false;
    }
    return true;
  }
}

export const levelsService = new LevelsService();

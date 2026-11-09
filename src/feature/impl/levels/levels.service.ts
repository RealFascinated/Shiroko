import { db } from "@/db/index";
import { userLevelsSchema } from "@/db/schemas/user-levels";
import { EventBus } from "@/event/event-bus";
import LevelUpEvent from "@/event/events/level-up.event";
import LeaderboardManager from "@/leaderboard/index";
import { LeaderboardId } from "@/leaderboard/leaderboard";
import { syncMembers, type MemberSyncProgress, type MemberSyncResult } from "@/lib/member-sync";
import { isAssignableRole } from "@/lib/roles";
import GuildUsersManager from "@/user/guild-users-manager";
import { MessageType, type Guild, type Message, type Role } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { levelsSettings, type LevelReward } from "./levels-settings";
import { levelForXp, progressToNext, xpForLevel } from "./xp";

export interface RankState {
  level: number;
  xp: number;
  currentLevelXp: number;
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

// Without the MessageContent intent the text is unreadable, so system messages (joins, pins, boosts) and stickers are the only filterable noise.
const XP_MESSAGE_TYPES: ReadonlySet<MessageType> = new Set([MessageType.Default, MessageType.Reply]);

/**
 * Levelling service. Grants XP for messages, detects level-ups under the
 * fixed curve, persists the new (xp, level) pair via one upsert, and emits
 * one `LevelUpEvent` per grant that crosses a level so reward granters and
 * announcements can react independently.
 *
 * Message grants are rate-limited by the guild user's `lastMessageAt`;
 * ignored channels, their threads, and ignored categories never grant.
 * XP and levels come straight from the DB on every read; config is read
 * through the settings system on every request; no in-memory level or
 * config cache exists.
 */
export default class LevelsService {
  /**
   * Try to grant a random `messageXpMin..messageXpMax` XP for a message,
   * gated by the per-guild user's `lastMessageAt` cooldown (atomically
   * claimed in SQL; exactly one concurrent message per window wins).
   * Returns the new level snapshot, or `null` when the grant was skipped
   * (system message or sticker, ignored channel, cooldown not elapsed).
   */
  public async grantMessageXp(
    message: Message<true>,
    now: Date = new Date()
  ): Promise<UserLevelSnapshot | null> {
    if (!XP_MESSAGE_TYPES.has(message.type) || message.stickers.size > 0) {
      return null;
    }
    const { guild, channel, author } = message;
    const settings = await levelsSettings.values(guild.id);
    const parent = channel.isThread() ? channel.parent : null;
    const lineage = [channel.id, channel.parentId, parent?.parentId];
    if (lineage.some(id => id && settings.ignoredChannelIds.includes(id))) {
      return null;
    }
    const claimed = await GuildUsersManager.claimLastMessage(
      guild,
      author,
      now,
      Math.floor(settings.messageCooldownMs / 1000)
    );
    if (!claimed) {
      return null;
    }
    const amount = randomInt(
      settings.messageXpMin,
      Math.max(settings.messageXpMin, settings.messageXpMax) + 1
    );
    return this.grant(guild, author.id, amount, now);
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
      currentLevelXp: xpForLevel(level),
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

  public async setRewardRole(guild: Guild, level: number, roleId: string, userId: string): Promise<void> {
    await levelsSettings.setEntry(
      guild.id,
      "rewards",
      String(level),
      { type: "Role", roleId },
      { guild, userId }
    );
  }

  public async removeReward(guild: Guild, level: number, userId: string): Promise<void> {
    await levelsSettings.removeEntry(guild.id, "rewards", String(level), { guild, userId });
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
  public async syncRewardsToGuild(guild: Guild, onProgress?: MemberSyncProgress): Promise<MemberSyncResult> {
    const roles = (await this.rewards(guild.id))
      .filter(reward => reward.type === "Role" && reward.roleId)
      .map(reward => ({ level: reward.level, role: guild.roles.cache.get(reward.roleId as string) }))
      .filter(
        (entry): entry is { level: number; role: Role } =>
          entry.role !== undefined && isAssignableRole(entry.role)
      );

    // One query for every stored total, so the sweep costs O(1) reads per
    // member instead of a per-member `getLevel` round trip. A member with
    // no row is level 1.
    const xpRows = await db
      .select({ userId: userLevelsSchema.userId, xp: userLevelsSchema.xp })
      .from(userLevelsSchema)
      .where(eq(userLevelsSchema.guildId, guild.id));
    const xpByUser = new Map(xpRows.map(row => [row.userId, row.xp]));

    return syncMembers(
      guild,
      "Level reward",
      member => {
        const level = levelForXp(xpByUser.get(member.id) ?? 0);
        return roles
          .filter(entry => entry.level <= level && !member.roles.cache.has(entry.role.id))
          .map(entry => entry.role);
      },
      onProgress
    );
  }

  /**
   * Persist an XP gain and emit one `LevelUpEvent` spanning every level crossed.
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

    // The pre-grant xp comes from the upserted total, not a separate read,
    // so concurrent grants cannot both claim the same crossing;
    // `levelForXp` clamps new users to level 1, so a first grant that jumps
    // multiple levels still starts its span at 1.
    const prevLevel = levelForXp(row.xp - amount);
    if (persisted.level > prevLevel) {
      await EventBus.post(
        new LevelUpEvent({ userId, guild, prevLevel, newLevel: persisted.level, xp: row.xp })
      );
    }
    return persisted;
  }
}

export const levelsService = new LevelsService();

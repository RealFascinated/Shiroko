import type { Guild, User } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { guildUsers } from "../db/schema";
import { nowMinus } from "../lib/time";
import GuildUser from "./guild-user";

export default class GuildUsersManager {
  /**
   * Get (creating if needed) the guild user for `user` in `guild`,
   * mirroring `GlobalUsersManager.getUser`. Reads the DB every call;
   * there is no in-process cache.
   */
  public static async getUser(guild: Guild, user: User): Promise<GuildUser> {
    const [existing] = await db
      .select()
      .from(guildUsers)
      .where(and(eq(guildUsers.guildId, guild.id), eq(guildUsers.userId, user.id)));

    if (existing) {
      return new GuildUser(user, existing);
    }

    const [inserted] = await db
      .insert(guildUsers)
      .values({ guildId: guild.id, userId: user.id })
      .onConflictDoNothing({
        target: [guildUsers.guildId, guildUsers.userId],
      })
      .returning();

    if (inserted) {
      console.log(`Created new guild user for ${user.tag} (${user.id}) in ${guild.id}`);
      return new GuildUser(user, inserted);
    }

    const [row] = await db
      .select()
      .from(guildUsers)
      .where(and(eq(guildUsers.guildId, guild.id), eq(guildUsers.userId, user.id)));
    return new GuildUser(user, row!);
  }

  /**
   * Atomically claim the message-XP cooldown for a guild user: stamp
   * `lastMessageAt` to `at` only when the stored value is null or older
   * than `cooldownSeconds`. Exactly one concurrent writer wins; the
   * losers get `false` and grant no XP. The row is created on the first
   * claim (INSERT ... ON CONFLICT). The SQL `where` clause is the source
   * of truth; there is no in-process cache.
   */
  public static async claimLastMessage(
    guild: Guild,
    user: User,
    at: Date,
    cooldownSeconds: number
  ): Promise<boolean> {
    const [row] = await db
      .insert(guildUsers)
      .values({ guildId: guild.id, userId: user.id, lastMessageAt: at })
      .onConflictDoUpdate({
        target: [guildUsers.guildId, guildUsers.userId],
        set: { lastMessageAt: at },
        where: sql`${guildUsers.lastMessageAt} is null or ${guildUsers.lastMessageAt} <= ${nowMinus(cooldownSeconds, at)}`,
      })
      .returning();
    return row !== undefined;
  }
}

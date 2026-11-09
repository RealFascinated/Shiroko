import type { Guild, User } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index";
import { guildUsersSchema } from "../db/schemas/guild-users";
import { nowMinus } from "../lib/time";

export default class GuildUsersManager {
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
      .insert(guildUsersSchema)
      .values({ guildId: guild.id, userId: user.id, lastMessageAt: at })
      .onConflictDoUpdate({
        target: [guildUsersSchema.guildId, guildUsersSchema.userId],
        set: { lastMessageAt: at },
        where: sql`${guildUsersSchema.lastMessageAt} is null or ${guildUsersSchema.lastMessageAt} <= ${nowMinus(cooldownSeconds, at)}`,
      })
      .returning();
    return row !== undefined;
  }
}

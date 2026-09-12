import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { userLevels } from "../../db/schema";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { UserLeaderboard } from "../user-leaderboard";

/**
 * Per-guild XP leaderboard backed by `user_levels`. One row per user,
 * so every query is a plain scan of the value table.
 */
export default class LevelLeaderboard extends UserLeaderboard<LeaderboardRow> {
  public override readonly id: LeaderboardId = LeaderboardId.Level;

  protected async fetchTop(scope: string, limit: number, offset: number): Promise<LeaderboardRow[]> {
    return db
      .select({ id: userLevels.userId, value: userLevels.xp })
      .from(userLevels)
      .where(eq(userLevels.guildId, scope))
      .orderBy(desc(userLevels.xp), userLevels.userId)
      .limit(limit)
      .offset(offset);
  }

  protected async fetchRow(scope: string, id: string): Promise<LeaderboardRow | null> {
    const [row] = await db
      .select({ id: userLevels.userId, value: userLevels.xp })
      .from(userLevels)
      .where(and(eq(userLevels.guildId, scope), eq(userLevels.userId, id)));
    return row ?? null;
  }

  protected async countAhead(scope: string, value: number): Promise<number> {
    const [row] = await db
      .select({ ahead: sql<number>`count(*) filter (where ${userLevels.xp} > ${value})`.mapWith(Number) })
      .from(userLevels)
      .where(eq(userLevels.guildId, scope));
    return row?.ahead ?? 0;
  }

  protected async total(scope: string): Promise<number> {
    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(userLevels)
      .where(eq(userLevels.guildId, scope));
    return row?.total ?? 0;
  }
}

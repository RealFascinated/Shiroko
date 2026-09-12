import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { voiceSessions } from "../../db/schema";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { UserLeaderboard } from "../user-leaderboard";

/**
 * Per-guild voice-time leaderboard backed by `voice_sessions`. One row
 * per session; completed sessions only (open sessions have no duration
 * yet), summed per user.
 */
export default class VoiceLeaderboard extends UserLeaderboard<LeaderboardRow> {
  public override readonly id: LeaderboardId = LeaderboardId.Voice;

  protected async fetchTop(scope: string, limit: number, offset: number): Promise<LeaderboardRow[]> {
    return db
      .select({
        id: voiceSessions.userId,
        value: sql<number>`sum(${voiceSessions.durationSeconds})`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(and(eq(voiceSessions.guildId, scope), isNotNull(voiceSessions.leftAt)))
      .groupBy(voiceSessions.userId)
      .orderBy(desc(sql`sum(${voiceSessions.durationSeconds})`), voiceSessions.userId)
      .limit(limit)
      .offset(offset);
  }

  protected async fetchRow(scope: string, id: string): Promise<LeaderboardRow | null> {
    const [row] = await db
      .select({
        id: voiceSessions.userId,
        value: sql<number>`sum(${voiceSessions.durationSeconds})`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(
        and(eq(voiceSessions.guildId, scope), eq(voiceSessions.userId, id), isNotNull(voiceSessions.leftAt))
      )
      .groupBy(voiceSessions.userId);
    return row ?? null;
  }

  protected async countAhead(scope: string, value: number): Promise<number> {
    const grouped = db
      .select({
        id: voiceSessions.userId,
        value: sql<number>`sum(${voiceSessions.durationSeconds})`.mapWith(Number).as("value"),
      })
      .from(voiceSessions)
      .where(and(eq(voiceSessions.guildId, scope), isNotNull(voiceSessions.leftAt)))
      .groupBy(voiceSessions.userId)
      .as("t");
    const [row] = await db
      .select({ ahead: sql<number>`count(*) filter (where ${grouped.value} > ${value})`.mapWith(Number) })
      .from(grouped);
    return row?.ahead ?? 0;
  }

  protected async total(scope: string): Promise<number> {
    const grouped = db
      .select({
        id: voiceSessions.userId,
        value: sql<number>`sum(${voiceSessions.durationSeconds})`.mapWith(Number).as("value"),
      })
      .from(voiceSessions)
      .where(and(eq(voiceSessions.guildId, scope), isNotNull(voiceSessions.leftAt)))
      .groupBy(voiceSessions.userId)
      .as("t");
    const [row] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(grouped);
    return row?.total ?? 0;
  }
}

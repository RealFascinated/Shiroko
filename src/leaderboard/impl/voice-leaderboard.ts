import { db } from "@/db/index";
import { voiceSessionsSchema } from "@/db/schemas/voice-sessions";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
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
        id: voiceSessionsSchema.userId,
        value: sql<number>`sum(${voiceSessionsSchema.durationSeconds})`.mapWith(Number),
      })
      .from(voiceSessionsSchema)
      .where(and(eq(voiceSessionsSchema.guildId, scope), isNotNull(voiceSessionsSchema.leftAt)))
      .groupBy(voiceSessionsSchema.userId)
      .orderBy(desc(sql`sum(${voiceSessionsSchema.durationSeconds})`), voiceSessionsSchema.userId)
      .limit(limit)
      .offset(offset);
  }

  protected async fetchRow(scope: string, id: string): Promise<LeaderboardRow | null> {
    const [row] = await db
      .select({
        id: voiceSessionsSchema.userId,
        value: sql<number>`sum(${voiceSessionsSchema.durationSeconds})`.mapWith(Number),
      })
      .from(voiceSessionsSchema)
      .where(
        and(eq(voiceSessionsSchema.guildId, scope), eq(voiceSessionsSchema.userId, id), isNotNull(voiceSessionsSchema.leftAt))
      )
      .groupBy(voiceSessionsSchema.userId);
    return row ?? null;
  }

  protected async countAhead(scope: string, value: number): Promise<number> {
    const grouped = db
      .select({
        id: voiceSessionsSchema.userId,
        value: sql<number>`sum(${voiceSessionsSchema.durationSeconds})`.mapWith(Number).as("value"),
      })
      .from(voiceSessionsSchema)
      .where(and(eq(voiceSessionsSchema.guildId, scope), isNotNull(voiceSessionsSchema.leftAt)))
      .groupBy(voiceSessionsSchema.userId)
      .as("t");
    const [row] = await db
      .select({ ahead: sql<number>`count(*) filter (where ${grouped.value} > ${value})`.mapWith(Number) })
      .from(grouped);
    return row?.ahead ?? 0;
  }

  protected async total(scope: string): Promise<number> {
    const grouped = db
      .select({
        id: voiceSessionsSchema.userId,
        value: sql<number>`sum(${voiceSessionsSchema.durationSeconds})`.mapWith(Number).as("value"),
      })
      .from(voiceSessionsSchema)
      .where(and(eq(voiceSessionsSchema.guildId, scope), isNotNull(voiceSessionsSchema.leftAt)))
      .groupBy(voiceSessionsSchema.userId)
      .as("t");
    const [row] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(grouped);
    return row?.total ?? 0;
  }
}

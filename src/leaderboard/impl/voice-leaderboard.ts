import { db } from "@/db/index";
import { voiceSessionsSchema } from "@/db/schemas/voice-sessions";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { GroupedUserLeaderboard } from "../grouped-user-leaderboard";
import type { GroupedScores } from "../grouped-user-leaderboard";

/**
 * Per-guild voice-time leaderboard backed by `voice_sessions`. One row
 * per session; completed sessions only (open sessions have no duration
 * yet), summed per user.
 */
export default class VoiceLeaderboard extends GroupedUserLeaderboard<LeaderboardRow> {
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
        and(
          eq(voiceSessionsSchema.guildId, scope),
          eq(voiceSessionsSchema.userId, id),
          isNotNull(voiceSessionsSchema.leftAt)
        )
      )
      .groupBy(voiceSessionsSchema.userId);
    return row ?? null;
  }

  protected grouped(scope: string): GroupedScores {
    return db
      .select({
        id: voiceSessionsSchema.userId,
        value: sql<number>`sum(${voiceSessionsSchema.durationSeconds})`.mapWith(Number).as("value"),
      })
      .from(voiceSessionsSchema)
      .where(and(eq(voiceSessionsSchema.guildId, scope), isNotNull(voiceSessionsSchema.leftAt)))
      .groupBy(voiceSessionsSchema.userId)
      .as("t");
  }
}

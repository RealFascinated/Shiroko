import { db } from "@/db/index";
import { messageEventsSchema } from "@/db/schemas/message-events";
import { and, desc, eq, sql } from "drizzle-orm";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { GroupedUserLeaderboard } from "../grouped-user-leaderboard";
import type { GroupedScores } from "../grouped-user-leaderboard";

/**
 * Per-guild message-count leaderboard backed by `message_events`. One
 * row per message, so pages group by user first and position counts
 * compare the grouped values.
 */
export default class MessageLeaderboard extends GroupedUserLeaderboard<LeaderboardRow> {
  public override readonly id: LeaderboardId = LeaderboardId.Messages;

  protected async fetchTop(scope: string, limit: number, offset: number): Promise<LeaderboardRow[]> {
    return db
      .select({ id: messageEventsSchema.userId, value: sql<number>`count(*)`.mapWith(Number) })
      .from(messageEventsSchema)
      .where(eq(messageEventsSchema.guildId, scope))
      .groupBy(messageEventsSchema.userId)
      .orderBy(desc(sql`count(*)`), messageEventsSchema.userId)
      .limit(limit)
      .offset(offset);
  }

  protected async fetchRow(scope: string, id: string): Promise<LeaderboardRow | null> {
    const [row] = await db
      .select({ id: messageEventsSchema.userId, value: sql<number>`count(*)`.mapWith(Number) })
      .from(messageEventsSchema)
      .where(and(eq(messageEventsSchema.guildId, scope), eq(messageEventsSchema.userId, id)))
      .groupBy(messageEventsSchema.userId);
    return row ?? null;
  }

  protected grouped(scope: string): GroupedScores {
    return db
      .select({ id: messageEventsSchema.userId, value: sql<number>`count(*)`.mapWith(Number).as("value") })
      .from(messageEventsSchema)
      .where(eq(messageEventsSchema.guildId, scope))
      .groupBy(messageEventsSchema.userId)
      .as("t");
  }
}

import { db } from "@/db/index";
import { messageEventsSchema } from "@/db/schemas/message-events";
import { and, desc, eq, sql } from "drizzle-orm";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { UserLeaderboard } from "../user-leaderboard";

/**
 * Per-guild message-count leaderboard backed by `message_events`. One
 * row per message, so pages group by user first and position counts
 * compare the grouped values.
 */
export default class MessageLeaderboard extends UserLeaderboard<LeaderboardRow> {
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

  protected async countAhead(scope: string, value: number): Promise<number> {
    const grouped = db
      .select({ id: messageEventsSchema.userId, value: sql<number>`count(*)`.mapWith(Number).as("value") })
      .from(messageEventsSchema)
      .where(eq(messageEventsSchema.guildId, scope))
      .groupBy(messageEventsSchema.userId)
      .as("t");
    const [row] = await db
      .select({ ahead: sql<number>`count(*) filter (where ${grouped.value} > ${value})`.mapWith(Number) })
      .from(grouped);
    return row?.ahead ?? 0;
  }

  protected async total(scope: string): Promise<number> {
    const grouped = db
      .select({ id: messageEventsSchema.userId, value: sql<number>`count(*)`.mapWith(Number).as("value") })
      .from(messageEventsSchema)
      .where(eq(messageEventsSchema.guildId, scope))
      .groupBy(messageEventsSchema.userId)
      .as("t");
    const [row] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(grouped);
    return row?.total ?? 0;
  }
}

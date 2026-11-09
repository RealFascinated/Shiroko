import { db } from "@/db/index";
import { inviteJoinsSchema } from "@/db/schemas/invite-joins";
import { FAKE_INVITE_WINDOW_MINUTES } from "@/lib/join-source";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { LeaderboardId, type LeaderboardRow } from "../leaderboard";
import { GroupedUserLeaderboard } from "../grouped-user-leaderboard";
import type { GroupedScores } from "../grouped-user-leaderboard";

/** One inviter's standing: attributed invites plus the joins that ended early. */
export interface InviteLeaderboardRow extends LeaderboardRow {
  /** Attributed joins whose member left within the fake-invite window. */
  leaves: number;
}

/**
 * A join that ended within the fake-invite window, the flag the board
 * counts as a leave.
 */
const fakeLeave = sql<boolean>`${inviteJoinsSchema.leftAt} is not null and ${inviteJoinsSchema.leftAt} - ${inviteJoinsSchema.joinedAt} <= make_interval(mins => ${FAKE_INVITE_WINDOW_MINUTES})`;

const inviterScore = {
  id: inviteJoinsSchema.inviterId,
  value: sql<number>`count(*)`.mapWith(Number),
  leaves: sql<number>`count(*) filter (where ${fakeLeave})`.mapWith(Number),
};

/**
 * Per-guild invite leaderboard backed by `invite_joins`. One row per
 * attributed join; unknown joins (null inviter) are excluded, so the
 * board ranks inviting users by their attributed invite count and carries
 * each inviter's fake invites as `leaves`.
 */
export default class InviteLeaderboard extends GroupedUserLeaderboard<InviteLeaderboardRow> {
  public override readonly id: LeaderboardId = LeaderboardId.Invites;

  protected async fetchTop(scope: string, limit: number, offset: number): Promise<InviteLeaderboardRow[]> {
    const rows = await db
      .select(inviterScore)
      .from(inviteJoinsSchema)
      .where(and(eq(inviteJoinsSchema.guildId, scope), isNotNull(inviteJoinsSchema.inviterId)))
      .groupBy(inviteJoinsSchema.inviterId)
      .orderBy(desc(sql`count(*)`), inviteJoinsSchema.inviterId)
      .limit(limit)
      .offset(offset);
    return rows.map(row => ({ id: row.id as string, value: row.value, leaves: row.leaves }));
  }

  protected async fetchRow(scope: string, id: string): Promise<InviteLeaderboardRow | null> {
    const [row] = await db
      .select(inviterScore)
      .from(inviteJoinsSchema)
      .where(and(eq(inviteJoinsSchema.guildId, scope), eq(inviteJoinsSchema.inviterId, id)))
      .groupBy(inviteJoinsSchema.inviterId);
    return row ? { id: row.id as string, value: row.value, leaves: row.leaves } : null;
  }

  protected grouped(scope: string): GroupedScores {
    return db
      .select({ id: inviteJoinsSchema.inviterId, value: sql<number>`count(*)`.mapWith(Number).as("value") })
      .from(inviteJoinsSchema)
      .where(and(eq(inviteJoinsSchema.guildId, scope), isNotNull(inviteJoinsSchema.inviterId)))
      .groupBy(inviteJoinsSchema.inviterId)
      .as("t");
  }
}

import { db } from "@/db/index";
import { sql, type SQL } from "drizzle-orm";
import type { SubqueryWithSelection } from "drizzle-orm/pg-core";
import type { LeaderboardRow } from "./leaderboard";
import { UserLeaderboard } from "./user-leaderboard";

/**
 * One row per user after grouping the event table; `value` is the
 * aggregate the board ranks by.
 */
export type GroupedScores = SubqueryWithSelection<{ value: SQL.Aliased<number> }, "t">;

/**
 * A board whose value is an aggregate over many rows per user, so the
 * position counts run over a grouped subquery instead of the table.
 */
export abstract class GroupedUserLeaderboard<T extends LeaderboardRow> extends UserLeaderboard<T> {
  /**
   * The per-user aggregate in `scope`, aliased as `t` with a `value`
   * column.
   */
  protected abstract grouped(scope: string): GroupedScores;

  protected async countAhead(scope: string, value: number): Promise<number> {
    const grouped = this.grouped(scope);
    const [row] = await db
      .select({ ahead: sql<number>`count(*) filter (where ${grouped.value} > ${value})`.mapWith(Number) })
      .from(grouped);
    return row?.ahead ?? 0;
  }

  protected async total(scope: string): Promise<number> {
    const [row] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(this.grouped(scope));
    return row?.total ?? 0;
  }
}

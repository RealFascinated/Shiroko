import { loadPage, type Page } from "../lib/pagination";
import Leaderboard, {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type LeaderboardEntity,
  type LeaderboardPosition,
  type LeaderboardRow,
  type LeaderboardScope,
} from "./leaderboard";

/**
 * A leaderboard that ranks user ids. Carries the generic page and
 * position mechanics shared by every user board; subclasses only
 * provide the four table-specific queries.
 */
export abstract class UserLeaderboard<T extends LeaderboardRow> extends Leaderboard<T> {
  public override readonly entity: LeaderboardEntity = "user";
  /** Guild-scoped by default; a global user board overrides this. */
  public override readonly scope: LeaderboardScope = "guild";

  /**
   * The top `limit` rows of the board in `scope`, starting at
   * `offset`, in board order (value desc, id asc).
   */
  protected abstract fetchTop(scope: string, limit: number, offset: number): Promise<T[]>;

  /**
   * The single row for one entity in `scope`, or null when the entity
   * has no score.
   */
  protected abstract fetchRow(scope: string, id: string): Promise<T | null>;

  /**
   * The number of entities in `scope` with a strictly greater value
   * than `value`.
   */
  protected abstract countAhead(scope: string, value: number): Promise<number>;

  /**
   * The total number of ranked entities in `scope`.
   */
  protected abstract total(scope: string): Promise<number>;

  public async getPage(scope: string, page: number, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Page<T>> {
    return loadPage({
      page,
      pageSize: Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE),
      count: () => this.total(scope),
      rows: (limit, offset) => this.fetchTop(scope, limit, offset),
    });
  }

  public async getPosition(scope: string, id: string): Promise<LeaderboardPosition<T>> {
    const row = await this.fetchRow(scope, id);
    if (!row) {
      return { position: null, total: await this.total(scope), row: null };
    }
    const ahead = await this.countAhead(scope, row.value);
    return { position: ahead + 1, total: await this.total(scope), row };
  }
}

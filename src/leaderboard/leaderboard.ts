import type { Page } from "../lib/pagination";

/**
 * Stable slugs for the registered leaderboards; the registry is keyed
 * by them and commands dispatch on them.
 */
export enum LeaderboardId {
  Invites = "invites",
  Level = "level",
  Messages = "messages",
  Voice = "voice",
}

/**
 * One ranked entity. `id` is the user id; `value` is the score in the
 * board's units (XP, message count, seconds, ...).
 */
export interface LeaderboardRow {
  id: string;
  value: number;
}

/**
 * One entity's standing in a leaderboard: its 1-based position (ties
 * share a position), the total ranked entities, and the entity's own
 * row. `position` and `row` are null when the entity has no score.
 */
export interface LeaderboardPosition<T extends LeaderboardRow> {
  position: number | null;
  total: number;
  row: T | null;
}

/** Default page size; matches the existing leaderboard renders. */
export const DEFAULT_PAGE_SIZE = 15;
export const MAX_PAGE_SIZE = 50;

/**
 * A fully DB-backed leaderboard over a set of ranked entities. `T` is the
 * row type the board emits; the board is unit-agnostic. Concrete boards
 * implement the table-specific queries via {@link UserLeaderboard}, which
 * provides the shared page and position mechanics.
 */
export default abstract class Leaderboard<T extends LeaderboardRow> {
  public abstract readonly id: LeaderboardId;

  /**
   * One page of the board in `scope` (a guild id). `page` is 1-based and
   * clamped into range; `pageSize` defaults to {@link DEFAULT_PAGE_SIZE}
   * and is clamped to [1, MAX_PAGE_SIZE]. The page's rows come from the
   * database via `LIMIT`/`OFFSET`, never from slicing a full result.
   */
  public abstract getPage(scope: string, page: number, pageSize?: number): Promise<Page<T>>;

  public abstract getPosition(scope: string, id: string): Promise<LeaderboardPosition<T>>;
}

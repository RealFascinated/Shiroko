/**
 * What a leaderboard ranks: user ids or guild ids. Drives how callers
 * resolve display names.
 */
export type LeaderboardEntity = "user" | "guild";

/**
 * How a leaderboard is scoped: "guild" means the scope parameter is a
 * guild id; "global" means the scope parameter is ignored.
 */
export type LeaderboardScope = "guild" | "global";

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
 * One ranked entity. `id` is the user id or guild id; `value` is the
 * score in the board's units (XP, message count, seconds, ...).
 */
export interface LeaderboardRow {
  id: string;
  value: number;
}

/**
 * One page of a leaderboard: the ranked rows for that page plus the
 * totals callers need to render pagination.
 */
export interface LeaderboardPage<T extends LeaderboardRow> {
  /** 1-based page number, clamped into range. */
  page: number;
  /** The effective page size after clamping. */
  pageSize: number;
  /** Total pages; 1 for an empty board. */
  pageCount: number;
  /** Total ranked entities in scope. */
  total: number;
  rows: T[];
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
export const DEFAULT_PAGE_SIZE = 10;
/** Hard ceiling for requested page sizes. */
export const MAX_PAGE_SIZE = 50;

/**
 * A fully DB-backed leaderboard over a set of ranked entities. `T` is
 * the row type the board emits; the board is unit-agnostic. Concrete
 * boards implement the table-specific queries via {@link UserLeaderboard}
 * or {@link GuildLeaderboard}, which provide the shared page and
 * position mechanics.
 */
export default abstract class Leaderboard<T extends LeaderboardRow> {
  /** The board's registry slug ({@link LeaderboardId}). */
  public abstract readonly id: LeaderboardId;
  /** What is ranked: user ids or guild ids. */
  public abstract readonly entity: LeaderboardEntity;
  /** "guild": the scope parameter is a guild id. "global": ignored. */
  public abstract readonly scope: LeaderboardScope;

  /**
   * One page of the board in `scope` (a guild id for guild-scoped
   * boards, ignored for global boards). `page` is 1-based and clamped
   * into range; `pageSize` defaults to {@link DEFAULT_PAGE_SIZE} and is
   * clamped to [1, MAX_PAGE_SIZE].
   */
  public abstract getPage(scope: string, page: number, pageSize?: number): Promise<LeaderboardPage<T>>;

  /**
   * One entity's standing in `scope`: its 1-based position (ties share
   * a position), the total ranked entities, and the entity's own row.
   * `position` and `row` are null when the entity has no score.
   */
  public abstract getPosition(scope: string, id: string): Promise<LeaderboardPosition<T>>;
}

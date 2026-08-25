import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { quests } from "../../db/schema";
import { runesService } from "../economy/runes.service";
import {
  DAILY_QUESTS_PER_PERIOD,
  WEEKLY_QUESTS_PER_PERIOD,
  drawQuests,
  findQuestBySlug,
  type QuestDefinition,
  type QuestKind,
  type QuestPeriod,
} from "./definitions";

/**
 * A scheduled window for one period, inclusive at the start and instant at
 * the end. `daily` windows start at 00:00 UTC every calendar day;
 * `weekly` windows start at 00:00 UTC every Monday.
 */
export interface QuestWindow {
  start: Date;
  end: Date;
}

/**
 * A quest in a player's list with the definition it was drawn from.
 * `definition` is resolved from the stored `slug`.
 */
export interface PlayerQuest {
  definition: QuestDefinition;
  progress: number;
  claimed: boolean;
  window: QuestWindow;
}

/**
 * The two windows that bound a player's quest state. `daily`/`weekly` are
 * the *next* period's windows; `dailyPre`/`weeklyPre` are the previous
 * period's windows, used to seed carry-over progress.
 */
export interface QuestState {
  daily: QuestWindow;
  weekly: QuestWindow;
  dailyPre: QuestWindow;
  weeklyPre: QuestWindow;
}

/** A quest that has been completed and its raw reward. */
export interface ClaimedQuest {
  slug: string;
  reward: number;
}

/**
 * Bounds for a UTC period. Daily periods are calendar days; weekly periods
 * are Monday-to-Sunday weeks. Both are derived deterministically from the
 * current time so the whole app agrees on where a period starts and ends.
 */
export function questWindow(period: QuestPeriod, at: Date = new Date()): QuestWindow {
  if (period === "daily") {
    const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = start.getUTCDay(); // 0 = Sunday
  const mondayOffset = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return { start, end: new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000) };
}

/** Stable id for the period `at` falls in, e.g. "2026-08-25" or "2026-W35". */
export function questPeriodId(period: QuestPeriod, at: Date = new Date()): string {
  if (period === "daily") {
    return at.toISOString().slice(0, 10);
  }
  const { start } = questWindow("weekly", at);
  const year = start.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((start.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + jan1.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Keep the quest lists fresh: if the player's stored period is behind the
 * current one, roll the new lists (random per user, seeded from the catalog)
 * and return `true`. A row that's empty for a player (fresh user, or a
 * period that never got assigned) is treated as needing a roll.
 */
export async function ensureQuestState(
  userId: string,
  state: QuestState,
  now: Date = new Date()
): Promise<boolean> {
  const lists = await loadLists(userId, state);
  const needDaily =
    lists.daily.length < DAILY_QUESTS_PER_PERIOD || lists.dailyPeriod !== questPeriodId("daily", now);
  const needWeekly =
    lists.weekly.length < WEEKLY_QUESTS_PER_PERIOD || lists.weeklyPeriod !== questPeriodId("weekly", now);
  const rolled = needDaily || needWeekly;

  if (needDaily) {
    const defs = drawQuests("daily", DAILY_QUESTS_PER_PERIOD);
    await replaceLists(userId, "daily", defs, state.daily, state.dailyPre);
  }
  if (needWeekly) {
    const defs = drawQuests("weekly", WEEKLY_QUESTS_PER_PERIOD);
    await replaceLists(userId, "weekly", defs, state.weekly, state.weeklyPre);
  }

  return rolled;
}

/**
 * Load the player's stored lists for the current periods, plus the windows
 * they were drawn for. `period` may be `null` if the player has no rows.
 */
async function loadLists(userId: string, state: QuestState) {
  const rows = await db
    .select({
      period: quests.period,
      kind: quests.kind,
      slug: quests.slug,
      progress: quests.progress,
      claimed: quests.claimed,
    })
    .from(quests)
    .where(eq(quests.userId, userId));

  const byKind = (kind: QuestPeriod) =>
    rows.filter(row => row.kind === kind && row.period === questPeriodId(kind, state[kind].start));
  return {
    daily: byKind("daily"),
    dailyPeriod: rows.find(row => row.kind === "daily")?.period ?? null,
    weekly: byKind("weekly"),
    weeklyPeriod: rows.find(row => row.kind === "weekly")?.period ?? null,
  };
}

/**
 * Remove every row for this player's current period and roll the fresh
 * list. Progress from the *previous* period's same-named quest carries
 * over, so a player doesn't lose credit for a repeating quest. Writes are
 * wrapped in a transaction so the roll and its carry-over commit together.
 */
async function replaceLists(
  userId: string,
  kind: QuestPeriod,
  defs: QuestDefinition[],
  window: QuestWindow,
  previousWindow: QuestWindow
): Promise<void> {
  await db.transaction(async tx => {
    const previousPeriod = questPeriodId(kind, previousWindow.start);
    for (const def of defs) {
      const [prev] = await tx
        .select({ progress: quests.progress })
        .from(quests)
        .where(
          and(
            eq(quests.userId, userId),
            eq(quests.kind, kind),
            eq(quests.period, previousPeriod),
            eq(quests.slug, def.slug)
          )
        );
      await tx
        .insert(quests)
        .values({
          userId,
          period: questPeriodId(kind, window.start),
          kind,
          slug: def.slug,
          progress: prev?.progress ?? 0,
          claimed: false,
          dailyStart: window.start,
          dailyEnd: window.end,
          weeklyStart: window.start,
          weeklyEnd: window.end,
        })
        .onConflictDoNothing({ target: [quests.userId, quests.period, quests.kind, quests.slug] });
    }

    await tx
      .delete(quests)
      .where(
        and(
          eq(quests.userId, userId),
          eq(quests.kind, kind),
          sql`${quests.period} != ${questPeriodId(kind, window.start)}`
        )
      );
  });
}

/**
 * Apply `amount` progress to the player's quests of `kind`, capped at their
 * targets. Returns the definitions that crossed their goal on this call;
 * their reward is now claimable. No-op if the player has no rows for the
 * current period (e.g. they've never opened `/quests`).
 */
export async function addQuestProgress(
  userId: string,
  kind: QuestKind,
  amount: number,
  at: Date = new Date()
): Promise<QuestDefinition[]> {
  const period = questPeriodId(kind as QuestPeriod, at);
  const state = buildQuestState(at);
  const window = kind === "claimDaily" ? state.daily : state.weekly;
  if (!period || !matchesPeriod(window, at)) {
    return [];
  }

  const rows = await db
    .select({ slug: quests.slug, progress: quests.progress })
    .from(quests)
    .where(
      and(
        eq(quests.userId, userId),
        eq(quests.kind, kind),
        eq(quests.period, period),
        eq(quests.claimed, false)
      )
    );

  const completed: QuestDefinition[] = [];
  for (const row of rows) {
    const definition = findQuestBySlug(row.slug);
    if (!definition) {
      continue;
    }
    const newProgress = Math.min(row.progress + amount, definition.target);
    await db
      .update(quests)
      .set({ progress: newProgress, updatedAt: new Date() })
      .where(and(eq(quests.userId, userId), eq(quests.kind, kind), eq(quests.slug, row.slug)));
    if (newProgress >= definition.target) {
      completed.push(definition);
    }
  }

  return completed;
}

/** Build the quest state windows for `at`: the current and previous periods. */
export function buildQuestState(at: Date = new Date()): QuestState {
  return {
    daily: questWindow("daily", at),
    weekly: questWindow("weekly", at),
    dailyPre: questWindow("daily", new Date(at.getTime() - 24 * 60 * 60 * 1000)),
    weeklyPre: questWindow("weekly", new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000)),
  };
}

/** Whether `when` falls inside `window`. */
export function matchesPeriod(window: QuestWindow, when: Date): boolean {
  return when.getTime() >= window.start.getTime() && when.getTime() < window.end.getTime();
}

/**
 * The core quest service: keeps lists fresh, tracks progress, and pays out
 * rewards. One instance is shared app-wide via `questsService`.
 */
export default class QuestsService {
  /**
   * The player's current quest panels for both periods. Also rolls a fresh
   * list if the stored period is behind the current one, so a stale player
   * sees their new quests the first time they open `/quests`.
   */
  public async getQuests(userId: string, at: Date = new Date()): Promise<PlayerQuest[][]> {
    const state = buildQuestState(at);
    const rolled = await ensureQuestState(userId, state, at);
    const lists = rolled ? await loadLists(userId, state) : await loadLists(userId, state);
    return [lists.daily, lists.weekly].map(list =>
      list
        .map(row => {
          const definition = findQuestBySlug(row.slug);
          return definition
            ? {
                definition,
                progress: row.progress,
                claimed: row.claimed,
                window: state[row.kind as QuestPeriod],
              }
            : null;
        })
        .filter((quest): quest is PlayerQuest => quest !== null)
    );
  }

  /**
   * Claim every completed, unclaimed quest in the player's current daily
   * period and pay the runes into their wallet. Returns the claimed quests
   * (empty if none are ready). Weekly quests share the daily period's id
   * only when both roll today, so claiming today's daily quests is safe.
   */
  public async claimAll(userId: string, at: Date = new Date()): Promise<ClaimedQuest[]> {
    const dailyPeriod = questPeriodId("daily", at);
    const rows = await db
      .select({ slug: quests.slug, kind: quests.kind, progress: quests.progress })
      .from(quests)
      .where(and(eq(quests.userId, userId), eq(quests.claimed, false), eq(quests.period, dailyPeriod)));

    const claimed: ClaimedQuest[] = [];
    for (const row of rows) {
      const definition = findQuestBySlug(row.slug);
      if (!definition || row.progress < definition.target) {
        continue;
      }
      await db
        .update(quests)
        .set({ claimed: true, updatedAt: new Date() })
        .where(
          and(eq(quests.userId, userId), eq(quests.kind, row.kind as QuestPeriod), eq(quests.slug, row.slug))
        );
      await runesService.addMoney(userId, definition.reward, "wallet", "quest");
      claimed.push({ slug: row.slug, reward: definition.reward });
    }

    return claimed;
  }
}

/**
 * App-wide singleton for quest tracking and payouts, created once at
 * startup and shared by every quest command.
 */
export const questsService = new QuestsService();

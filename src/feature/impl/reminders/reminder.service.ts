import { db } from "@/db/index";
import { remindersSchema, type ReminderSchema } from "@/db/schemas/reminders";
import { loadPage, type Page } from "@/lib/pagination";
import { and, eq, lte, sql } from "drizzle-orm";

export type Reminder = ReminderSchema;

/** Default rows per page for {@link ReminderService.list}. */
export const REMINDER_PAGE_SIZE = 10;

/**
 * Reminder storage: reads and writes `reminders` and nothing else. The
 * 30-second sweep that renders and posts lives in `reminder-sweep.ts`, so
 * this module stays off the `lib/embed.ts` -> `src/index.ts` import cycle.
 *
 * Like the other feature services, nothing is cached: every read hits the
 * DB.
 */
export default class ReminderService {
  /**
   * Store a reminder against an already-resolved delivery target. The
   * caller has validated the delay and picked `channelId`.
   */
  public async create(
    userId: string,
    channelId: string,
    dm: boolean,
    about: string,
    remindAt: Date
  ): Promise<Reminder> {
    const [row] = await db
      .insert(remindersSchema)
      .values({ userId, channelId, dm, about, remindAt })
      .returning();
    return row!;
  }

  /**
   * Delete one of `userId`'s reminders. The ownership check is in the
   * predicate, so a foreign id is indistinguishable from a missing one and
   * both report `false`.
   */
  public async remove(id: number, userId: string): Promise<boolean> {
    const rows = await db
      .delete(remindersSchema)
      .where(and(eq(remindersSchema.id, id), eq(remindersSchema.userId, userId)))
      .returning({ id: remindersSchema.id });
    return rows.length > 0;
  }

  /**
   * Delete every reminder `userId` has. Returns how many rows went.
   */
  public async clear(userId: string): Promise<number> {
    const rows = await db
      .delete(remindersSchema)
      .where(eq(remindersSchema.userId, userId))
      .returning({ id: remindersSchema.id });
    return rows.length;
  }

  /**
   * One page of a member's pending reminders, soonest first. Counted and
   * windowed in Postgres, so the caller never loads the whole set.
   */
  public async list(
    userId: string,
    page: number = 1,
    pageSize: number = REMINDER_PAGE_SIZE
  ): Promise<Page<Reminder>> {
    const scope = eq(remindersSchema.userId, userId);
    return loadPage({
      page,
      pageSize,
      count: async () => {
        const [row] = await db
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(remindersSchema)
          .where(scope);
        return row?.total ?? 0;
      },
      rows: (limit, offset) =>
        db
          .select()
          .from(remindersSchema)
          .where(scope)
          .orderBy(remindersSchema.remindAt, remindersSchema.id)
          .limit(limit)
          .offset(offset),
    });
  }

  /**
   * Claim every reminder due at or before `now`, removing the rows as it
   * returns them. `DELETE ... RETURNING` is both the read and the write, so
   * two overlapping sweeps can never hand the same row to two sends.
   */
  public async claimDue(now: Date = new Date()): Promise<Reminder[]> {
    return db.delete(remindersSchema).where(lte(remindersSchema.remindAt, now)).returning();
  }
}

export const reminderService = new ReminderService();

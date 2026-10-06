import { db } from "@/db/index";
import { remindersSchema, type ReminderSchema } from "@/db/schemas/reminders";
import { loadPage, type Page } from "@/lib/pagination";
import { TimeUnit } from "@/lib/time";
import { and, eq, lte, sql } from "drizzle-orm";

export type Reminder = ReminderSchema;

export const REMINDER_PAGE_SIZE = 10;

export const MAX_REMINDERS_PER_USER = 100;

/**
 * How far ahead a reminder's timestamp is rendered relatively. Past this,
 * "in 3 months" says nothing about when it actually is, so the renderers
 * switch to an absolute date; see `timestampLabel`.
 */
export const REMINDER_RELATIVE_WINDOW_MS = TimeUnit.toMillis(TimeUnit.Day, 1);

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
   * Store a reminder against an already-resolved delivery target, unless
   * `userId` already holds {@link MAX_REMINDERS_PER_USER} of them. Returns
   * `null` when the cap rejected the insert.
   *
   * The cap is enforced inside the insert rather than as a count followed by
   * a write, so concurrent sets cannot both pass the check and slip past it.
   * A plain `INSERT ... SELECT ... WHERE` (Drizzle's typed builder cannot
   * express it, since it always names every target column) is used for the
   * same reason `claimDue` deletes in one statement.
   *
   * The insert returns only the id and the row is read back through the
   * typed builder: `db.execute` hands `timestamptz` back as a raw string,
   * while a typed select parses it into a `Date`, and re-reading keeps this
   * module's row shape defined in exactly one place.
   */
  public async create(
    userId: string,
    channelId: string,
    dm: boolean,
    about: string,
    remindAt: Date
  ): Promise<Reminder | null> {
    const result = await db.execute(sql`
      insert into reminders (user_id, channel_id, dm, about, remind_at)
      select ${userId}, ${channelId}, ${dm}, ${about}, ${remindAt}
      where (select count(*) from reminders where user_id = ${userId}) < ${MAX_REMINDERS_PER_USER}
      returning id
    `);
    const [inserted] = result.rows as Array<{ id: number }>;
    if (!inserted) {
      return null;
    }
    const [row] = await db.select().from(remindersSchema).where(eq(remindersSchema.id, inserted.id));
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

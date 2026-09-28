import { db } from "@/db/index";
import { guildBirthdays } from "@/db/schemas/guild-birthdays";
import { loadPage, type Page } from "@/lib/pagination";
import type { Guild } from "discord.js";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { birthdaySettings } from "./birthday-settings";
import { ageInYears } from "./date";

export interface BirthdayRow {
  month: number;
  day: number;
}

export interface Celebrant {
  userId: string;
  /** The age they turn today. */
  age: number;
}

export interface UpcomingBirthday {
  userId: string;
  month: number;
  day: number;
  /** Days from today until the next occurrence; 0 means today. */
  inDays: number;
}

/** Default rows per page for {@link BirthdayService.upcoming}. */
export const UPCOMING_PAGE_SIZE = 10;

/**
 * The next occurrence of a stored birthday on or after `today`, as a
 * UTC date. Postgres computes it so the ordering and the `LIMIT`/`OFFSET`
 * window happen in one query.
 *
 * A 29 February birthday only exists in leap years, so the search walks
 * forward until the constructed date lands on the stored month and day
 * instead of rolling into 1 March. This mirrors `daysUntil` in `date.ts`,
 * which the sweep relies on; the two must agree on when a birthday is.
 */
function nextOccurrence(today: string): SQL {
  return sql`(
    select min(candidate.occurrence)
    from generate_series(0, 8) as step
    cross join lateral (
      select make_date(
        extract(year from ${today}::date)::int + step,
        extract(month from ${guildBirthdays.birthDate})::int,
        1
      ) + (extract(day from ${guildBirthdays.birthDate})::int - 1) as occurrence
    ) as candidate
    where extract(month from candidate.occurrence) = extract(month from ${guildBirthdays.birthDate})
      and extract(day from candidate.occurrence) = extract(day from ${guildBirthdays.birthDate})
      and candidate.occurrence >= ${today}::date
  )`;
}

/**
 * Birthday storage: reads and writes `guild_birthdays` and nothing else.
 * The nightly sweep that renders and posts lives in `birthday-sweep.ts`, so
 * this module stays off the `lib/embed.ts` -> `src/index.ts` import cycle.
 *
 * Like the other feature services, nothing is cached: every read hits the
 * DB.
 */
export default class BirthdayService {
  /**
   * Store (or replace) a member's date of birth in a guild. The caller has
   * already validated the date; the column rejects impossible ones as a
   * second line of defence.
   */
  public async setBirthday(guildId: string, userId: string, birthDate: Date): Promise<void> {
    await db
      .insert(guildBirthdays)
      .values({ guildId, userId, birthDate })
      .onConflictDoUpdate({
        target: [guildBirthdays.guildId, guildBirthdays.userId],
        set: { birthDate, updatedAt: sql`now()` },
      });
  }

  /**
   * Delete a member's stored birthday. Returns whether a row was removed.
   */
  public async removeBirthday(guildId: string, userId: string): Promise<boolean> {
    const rows = await db
      .delete(guildBirthdays)
      .where(and(eq(guildBirthdays.guildId, guildId), eq(guildBirthdays.userId, userId)))
      .returning({ userId: guildBirthdays.userId });
    return rows.length > 0;
  }

  /**
   * A member's stored birthday in a guild, or `null` when unset.
   */
  public async getBirthday(guildId: string, userId: string): Promise<BirthdayRow | null> {
    const [row] = await db
      .select({ birthDate: guildBirthdays.birthDate })
      .from(guildBirthdays)
      .where(and(eq(guildBirthdays.guildId, guildId), eq(guildBirthdays.userId, userId)));
    if (!row) {
      return null;
    }
    return { month: row.birthDate.getUTCMonth() + 1, day: row.birthDate.getUTCDate() };
  }

  /**
   * One page of a guild's member birthdays, soonest first, with today
   * present as `inDays: 0`.
   *
   * Ordering, projection, counting, and the page window all happen in
   * Postgres, so a guild with thousands of saved birthdays still reads one
   * page. `memberIds` is the guild's current membership, which lives in
   * Discord's cache rather than the DB: stored rows outlive membership, so
   * rows for departed members are filtered out in the same query. Takes the
   * reference instant rather than a separate month and day so "today"
   * cannot disagree with itself.
   */
  public async upcoming(
    guildId: string,
    memberIds: ReadonlySet<string>,
    page: number = 1,
    pageSize: number = UPCOMING_PAGE_SIZE,
    now: Date = new Date()
  ): Promise<Page<UpcomingBirthday>> {
    const today = now.toISOString().slice(0, 10);
    const occurrence = nextOccurrence(today);
    const inScope = and(
      eq(guildBirthdays.guildId, guildId),
      sql`${guildBirthdays.userId} = any(${sql.param([...memberIds])})`
    );
    return loadPage({
      page,
      pageSize,
      count: async () => {
        const [row] = await db
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(guildBirthdays)
          .where(inScope);
        return row?.total ?? 0;
      },
      rows: (limit, offset) =>
        db
          .select({
            userId: guildBirthdays.userId,
            month: sql<number>`extract(month from ${guildBirthdays.birthDate})::int`.mapWith(Number),
            day: sql<number>`extract(day from ${guildBirthdays.birthDate})::int`.mapWith(Number),
            inDays: sql<number>`${occurrence} - ${today}::date`.mapWith(Number),
          })
          .from(guildBirthdays)
          .where(inScope)
          .orderBy(occurrence, guildBirthdays.userId)
          .limit(limit)
          .offset(offset),
    });
  }

  /**
   * Every guild's celebrants for the given month/day in one query, keyed by
   * guild id. Rows are grouped in memory rather than queried per guild.
   *
   * Each celebrant carries the age they turn on that date, so callers can
   * announce it without reading the birth year themselves.
   */
  public async birthdaysOn(
    month: number,
    day: number,
    now: Date = new Date()
  ): Promise<Map<string, Celebrant[]>> {
    const rows = await db
      .select({
        guildId: guildBirthdays.guildId,
        userId: guildBirthdays.userId,
        birthDate: guildBirthdays.birthDate,
      })
      .from(guildBirthdays)
      .where(
        and(
          eq(sql`extract(month from ${guildBirthdays.birthDate})`, month),
          eq(sql`extract(day from ${guildBirthdays.birthDate})`, day)
        )
      );

    const byGuild = new Map<string, Celebrant[]>();
    for (const row of rows) {
      const celebrant: Celebrant = {
        userId: row.userId,
        age: ageInYears(row.birthDate, now),
      };
      const celebrants = byGuild.get(row.guildId);
      if (celebrants) {
        celebrants.push(celebrant);
      } else {
        byGuild.set(row.guildId, [celebrant]);
      }
    }
    return byGuild;
  }

  /**
   * Remove the birthday role from one member immediately, used when they
   * clear their birthday mid-grant. Best effort: a missing role or member
   * is a no-op.
   */
  public async stripRole(guild: Guild, userId: string): Promise<void> {
    const roleId = await birthdaySettings.get(guild.id, "roleId");
    if (!roleId) {
      return;
    }
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
    if (!member || !member.roles.cache.has(roleId)) {
      return;
    }
    try {
      await member.roles.remove(roleId, "Birthday removed");
    } catch (error) {
      console.error(`Failed to strip birthday role from ${userId}:`, error);
    }
  }
}

export const birthdayService = new BirthdayService();

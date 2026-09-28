import { db } from "@/db/index";
import { guildBirthdays } from "@/db/schemas/guild-birthdays";
import type { Guild } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { birthdaySettings } from "./birthday-settings";
import { ageInYears, daysUntil } from "./date";

/** How many rows `/birthday upcoming` lists. */
const UPCOMING_LIMIT = 10;

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
   * The next `UPCOMING_LIMIT` birthdays in a guild, soonest first, with
   * today present as `inDays: 0`.
   *
   * `memberIds` is the guild's current membership: stored rows outlive
   * membership, so rows for departed members are dropped before the limit is
   * applied. Takes the reference instant rather than a separate month and
   * day so "today" cannot disagree with itself.
   */
  public async upcoming(
    guildId: string,
    memberIds: ReadonlySet<string>,
    now: Date = new Date()
  ): Promise<UpcomingBirthday[]> {
    const rows = await db
      .select({ userId: guildBirthdays.userId, birthDate: guildBirthdays.birthDate })
      .from(guildBirthdays)
      .where(eq(guildBirthdays.guildId, guildId));

    const upcoming: UpcomingBirthday[] = [];
    for (const row of rows) {
      if (!memberIds.has(row.userId)) {
        continue;
      }
      const month = row.birthDate.getUTCMonth() + 1;
      const day = row.birthDate.getUTCDate();
      upcoming.push({ userId: row.userId, month, day, inDays: daysUntil(month, day, now) });
    }
    return upcoming.sort((a, b) => a.inDays - b.inDays).slice(0, UPCOMING_LIMIT);
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

import type { Client } from "discord.js";
import { Events } from "discord.js";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { globalUsers, messageEvents, voiceSessions } from "../../db/schema";
import type { StatsCardKind } from "./stats-card";

/**
 * One guild message to record. `id` is the Discord message id; `createdAt`
 * is the message's own timestamp.
 */
export interface MessageRecord {
  id: string;
  userId: string;
  guildId: string;
  channelId: string;
  createdAt: Date;
}

/**
 * A user currently in voice, used to seed open sessions at startup.
 */
export interface VoiceOccupant {
  userId: string;
  guildId: string;
  channelId: string;
}

/**
 * Counts for one display window set: today, last 7 days, last 30 days, total.
 */
export interface StatsSummary {
  today: number;
  last7days: number;
  last30days: number;
  total: number;
}

/**
 * Voice activity in one window: closed sessions plus any live session.
 */
export interface VoiceWindow {
  sessions: number;
  seconds: number;
}

/**
 * Voice activity across every display window.
 */
export interface VoiceSummary {
  today: VoiceWindow;
  last7days: VoiceWindow;
  last30days: VoiceWindow;
  total: VoiceWindow;
}

/**
 * Per-day values for the chart, oldest first, with weekday initials drawn
 * under each bar. Both derive from the same UTC days as the query window.
 */
export interface DaySeries {
  values: number[];
  dayLabels: string[];
}

/**
 * Everything `/stats` paints for one card: both windowed summaries plus
 * the charted kind's daily series.
 */
export interface CardStats {
  messages: StatsSummary;
  voice: VoiceSummary;
  series: DaySeries;
}

/**
 * Display window bounds for one read. Computed once per call so every
 * query agrees on where today, the rolling windows, and the chart start.
 */
interface StatsWindows {
  today: Date;
  last7Start: Date;
  last30Start: Date;
  seriesStart: Date;
}

/**
 * Derive the window bounds for `now`: UTC day start, the rolling 7-day
 * and 30-day starts, and the chart start.
 */
function statsWindows(now: Date, days = 7): StatsWindows {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    today,
    last7Start: new Date(today.getTime() - 6 * dayMs),
    last30Start: new Date(today.getTime() - 29 * dayMs),
    seriesStart: new Date(today.getTime() - (days - 1) * dayMs),
  };
}

/**
 * Fill `days` calendar days from `start` with bucketed values, defaulting
 * empty days to zero. Labels are UTC weekday initials for the chart.
 */
function toDaySeries(start: Date, days: number, byDay: Map<string, number>): DaySeries {
  const values: number[] = [];
  const dayLabels: string[] = [];
  for (let offset = 0; offset < days; offset++) {
    const day = new Date(start.getTime() + offset * 24 * 60 * 60 * 1000);
    values.push(byDay.get(day.toISOString().slice(0, 10)) ?? 0);
    dayLabels.push("SMTWTFS"[day.getUTCDay()]!);
  }
  return { values, dayLabels };
}

/**
 * Snapshot the non-bot users currently in voice across every guild.
 */
function collectVoiceOccupants(client: Client): VoiceOccupant[] {
  const occupants: VoiceOccupant[] = [];
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (!state.channelId || state.id === client.user?.id || state.member?.user.bot) {
        continue;
      }
      occupants.push({ userId: state.id, guildId: guild.id, channelId: state.channelId });
    }
  }
  return occupants;
}

/**
 * An in-memory open voice session, keyed by guild + user.
 */
interface OpenSession {
  sessionId: string;
  joinedAt: Date;
}

/**
 * Records message and voice activity. Tracking is fire-and-forget: callers
 * attach a `.catch` and never await. Reads serve `/stats`: one aggregate
 * query per domain plus the charted domain's daily buckets.
 */
export default class StatsService {
  private openSessions: Map<string, OpenSession> = new Map<string, OpenSession>();

  /**
   * Record one guild message. Redelivered events dedupe on the message id.
   */
  public async recordMessage(record: MessageRecord): Promise<void> {
    await this.ensureUser(record.userId);
    await db
      .insert(messageEvents)
      .values({
        id: record.id,
        userId: record.userId,
        guildId: record.guildId,
        channelId: record.channelId,
        createdAt: record.createdAt,
      })
      .onConflictDoNothing({ target: messageEvents.id });
  }

  /**
   * Advance `userId`'s voice state: close on leave/move, open on join/move.
   * No-ops (mute/deafen) carry equal channels and are ignored.
   */
  public async trackVoiceState(
    userId: string,
    guildId: string,
    oldChannelId: string | null,
    newChannelId: string | null,
    now: Date = new Date()
  ): Promise<void> {
    if (oldChannelId === newChannelId) {
      return;
    }
    if (oldChannelId !== null) {
      await this.closeSession(guildId, userId, now);
    }
    if (newChannelId !== null) {
      await this.openSession(guildId, userId, newChannelId, now);
    }
  }

  /**
   * Close every session left open by a previous process. Returns the count.
   */
  public async closeStaleSessions(now: Date = new Date()): Promise<number> {
    const stale = await db.select().from(voiceSessions).where(isNull(voiceSessions.leftAt));
    for (const row of stale) {
      await this.finishSession(row.id, row.joinedAt, now);
    }
    this.openSessions.clear();
    return stale.length;
  }

  /**
   * Open sessions for users already in voice at startup.
   */
  public async seedOpenSessions(occupants: VoiceOccupant[], now: Date = new Date()): Promise<void> {
    for (const occupant of occupants) {
      await this.openSession(occupant.guildId, occupant.userId, occupant.channelId, now);
    }
  }

  /**
   * Message counts in every display window, from a single aggregate query.
   */
  public async getMessageWindows(
    userId: string,
    guildId: string,
    now: Date = new Date()
  ): Promise<StatsSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        today: sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.today})`.mapWith(
          Number
        ),
        last7days:
          sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.last7Start})`.mapWith(
            Number
          ),
        last30days:
          sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.last30Start})`.mapWith(
            Number
          ),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(messageEvents)
      .where(and(eq(messageEvents.userId, userId), eq(messageEvents.guildId, guildId)));
    return {
      today: row?.today ?? 0,
      last7days: row?.last7days ?? 0,
      last30days: row?.last30days ?? 0,
      total: row?.total ?? 0,
    };
  }

  /**
   * Voice sessions and seconds in every display window, from a single
   * aggregate query. A live open session contributes its running duration;
   * its row is already counted in the session totals.
   */
  public async getVoiceWindows(
    userId: string,
    guildId: string,
    now: Date = new Date()
  ): Promise<VoiceSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        todaySessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.today})`.mapWith(Number),
        todaySeconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.today}), 0)`.mapWith(
            Number
          ),
        last7Sessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.last7Start})`.mapWith(
            Number
          ),
        last7Seconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.last7Start}), 0)`.mapWith(
            Number
          ),
        last30Sessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.last30Start})`.mapWith(
            Number
          ),
        last30Seconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.last30Start}), 0)`.mapWith(
            Number
          ),
        totalSessions: sql<number>`count(*)`.mapWith(Number),
        totalSeconds: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(and(eq(voiceSessions.userId, userId), eq(voiceSessions.guildId, guildId)));
    const live = this.liveVoice(guildId, userId, now);
    return {
      today: this.voiceWindow(row, "today", windows.today, live),
      last7days: this.voiceWindow(row, "last7", windows.last7Start, live),
      last30days: this.voiceWindow(row, "last30", windows.last30Start, live),
      total: {
        sessions: row?.totalSessions ?? 0,
        seconds: (row?.totalSeconds ?? 0) + (live?.seconds ?? 0),
      },
    };
  }

  /**
   * Pick one window out of a voice aggregate row, overlaying the live
   * session's running duration when it started inside the window.
   */
  private voiceWindow(
    row:
      | {
          todaySessions: number;
          todaySeconds: number;
          last7Sessions: number;
          last7Seconds: number;
          last30Sessions: number;
          last30Seconds: number;
        }
      | undefined,
    prefix: "today" | "last7" | "last30",
    start: Date,
    live: { joinedAt: Date; seconds: number } | null
  ): VoiceWindow {
    const liveSeconds = live && live.joinedAt >= start ? live.seconds : 0;
    return {
      sessions: (row?.[`${prefix}Sessions`] ?? 0) + (liveSeconds > 0 ? 1 : 0),
      seconds: (row?.[`${prefix}Seconds`] ?? 0) + liveSeconds,
    };
  }

  /**
   * Per-day message counts for the chart, oldest first, from one grouped
   * query over the chart range.
   */
  public async getMessageSeries(
    userId: string,
    guildId: string,
    days = 7,
    now: Date = new Date()
  ): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const byDay = await this.messageBuckets(userId, guildId, windows.seriesStart);
    return toDaySeries(windows.seriesStart, days, byDay);
  }

  /**
   * Per-day voice seconds for the chart, oldest first. Sessions land on
   * their join day; a live session adds its running duration there.
   */
  public async getVoiceSeries(
    userId: string,
    guildId: string,
    days = 7,
    now: Date = new Date()
  ): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const byDay = await this.voiceBuckets(userId, guildId, windows.seriesStart);
    const series = toDaySeries(windows.seriesStart, days, byDay);
    const live = this.liveVoice(guildId, userId, now);
    if (live && live.joinedAt >= windows.seriesStart) {
      const offset = Math.floor(
        (live.joinedAt.getTime() - windows.seriesStart.getTime()) / (24 * 60 * 60 * 1000)
      );
      series.values[offset]! += live.seconds;
    }
    return series;
  }

  /**
   * Everything one card paints: both windowed summaries plus the charted
   * kind's daily series. Three queries total.
   */
  public async getCardData(
    userId: string,
    guildId: string,
    kind: StatsCardKind,
    now: Date = new Date()
  ): Promise<CardStats> {
    const [messages, voice, series] = await Promise.all([
      this.getMessageWindows(userId, guildId, now),
      this.getVoiceWindows(userId, guildId, now),
      kind === "voice"
        ? this.getVoiceSeries(userId, guildId, 7, now)
        : this.getMessageSeries(userId, guildId, 7, now),
    ]);
    return { messages, voice, series };
  }

  /**
   * Everything one server card paints: guild-wide summaries over all
   * users plus the charted kind's daily series. Three queries total.
   */
  public async getGuildCardData(
    guildId: string,
    kind: StatsCardKind,
    now: Date = new Date()
  ): Promise<CardStats> {
    const [messages, voice, series] = await Promise.all([
      this.getGuildMessageWindows(guildId, now),
      this.getGuildVoiceWindows(guildId, now),
      kind === "voice"
        ? this.getGuildVoiceSeries(guildId, 7, now)
        : this.getGuildMessageSeries(guildId, 7, now),
    ]);
    return { messages, voice, series };
  }

  /**
   * Guild-wide message counts in every display window, from a single
   * aggregate query over all users in the guild.
   */
  public async getGuildMessageWindows(guildId: string, now: Date = new Date()): Promise<StatsSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        today: sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.today})`.mapWith(
          Number
        ),
        last7days:
          sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.last7Start})`.mapWith(
            Number
          ),
        last30days:
          sql<number>`count(*) filter (where ${messageEvents.createdAt} >= ${windows.last30Start})`.mapWith(
            Number
          ),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(messageEvents)
      .where(eq(messageEvents.guildId, guildId));
    return {
      today: row?.today ?? 0,
      last7days: row?.last7days ?? 0,
      last30days: row?.last30days ?? 0,
      total: row?.total ?? 0,
    };
  }

  /**
   * Guild-wide voice sessions and seconds in every display window, from a
   * single aggregate query. Live open sessions contribute their running
   * durations; their rows are already counted in the session totals.
   */
  public async getGuildVoiceWindows(guildId: string, now: Date = new Date()): Promise<VoiceSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        todaySessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.today})`.mapWith(Number),
        todaySeconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.today}), 0)`.mapWith(
            Number
          ),
        last7Sessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.last7Start})`.mapWith(
            Number
          ),
        last7Seconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.last7Start}), 0)`.mapWith(
            Number
          ),
        last30Sessions:
          sql<number>`count(*) filter (where ${voiceSessions.joinedAt} >= ${windows.last30Start})`.mapWith(
            Number
          ),
        last30Seconds:
          sql<number>`coalesce(sum(${voiceSessions.durationSeconds}) filter (where ${voiceSessions.joinedAt} >= ${windows.last30Start}), 0)`.mapWith(
            Number
          ),
        totalSessions: sql<number>`count(*)`.mapWith(Number),
        totalSeconds: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(eq(voiceSessions.guildId, guildId));
    const live = this.liveGuildVoice(guildId, now);
    return {
      today: this.guildVoiceWindow(row, "today", windows.today, live),
      last7days: this.guildVoiceWindow(row, "last7", windows.last7Start, live),
      last30days: this.guildVoiceWindow(row, "last30", windows.last30Start, live),
      total: {
        sessions: row?.totalSessions ?? 0,
        seconds: (row?.totalSeconds ?? 0) + live.seconds,
      },
    };
  }

  /**
   * Pick one window out of a guild voice aggregate row, overlaying live
   * sessions' running durations when they started inside the window.
   */
  private guildVoiceWindow(
    row:
      | {
          todaySessions: number;
          todaySeconds: number;
          last7Sessions: number;
          last7Seconds: number;
          last30Sessions: number;
          last30Seconds: number;
        }
      | undefined,
    prefix: "today" | "last7" | "last30",
    start: Date,
    live: { sessions: Array<{ joinedAt: Date; seconds: number }>; seconds: number }
  ): VoiceWindow {
    const liveIn = live.sessions.filter(session => session.joinedAt >= start);
    return {
      sessions: (row?.[`${prefix}Sessions`] ?? 0) + liveIn.length,
      seconds: (row?.[`${prefix}Seconds`] ?? 0) + liveIn.reduce((sum, session) => sum + session.seconds, 0),
    };
  }

  /**
   * Guild-wide per-day message counts for the chart, oldest first.
   */
  public async getGuildMessageSeries(guildId: string, days = 7, now: Date = new Date()): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const day = sql<string>`to_char(${messageEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ day, count: sql<number>`count(*)`.mapWith(Number) })
      .from(messageEvents)
      .where(and(eq(messageEvents.guildId, guildId), gte(messageEvents.createdAt, windows.seriesStart)))
      .groupBy(day);
    return toDaySeries(windows.seriesStart, days, new Map(rows.map(row => [row.day, row.count])));
  }

  /**
   * Guild-wide per-day voice seconds for the chart, oldest first. Live
   * sessions add their running durations on their join days.
   */
  public async getGuildVoiceSeries(guildId: string, days = 7, now: Date = new Date()): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const day = sql<string>`to_char(${voiceSessions.joinedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        day,
        seconds: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(and(eq(voiceSessions.guildId, guildId), gte(voiceSessions.joinedAt, windows.seriesStart)))
      .groupBy(day);
    const series = toDaySeries(windows.seriesStart, days, new Map(rows.map(row => [row.day, row.seconds])));
    for (const session of this.liveGuildVoice(guildId, now).sessions) {
      if (session.joinedAt < windows.seriesStart) {
        continue;
      }
      const offset = Math.floor(
        (session.joinedAt.getTime() - windows.seriesStart.getTime()) / (24 * 60 * 60 * 1000)
      );
      series.values[offset]! += session.seconds;
    }
    return series;
  }

  /**
   * Message counts keyed by UTC day (`YYYY-MM-DD`) since `start`.
   */
  private async messageBuckets(userId: string, guildId: string, start: Date): Promise<Map<string, number>> {
    const day = sql<string>`to_char(${messageEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ day, count: sql<number>`count(*)`.mapWith(Number) })
      .from(messageEvents)
      .where(
        and(
          eq(messageEvents.userId, userId),
          eq(messageEvents.guildId, guildId),
          gte(messageEvents.createdAt, start)
        )
      )
      .groupBy(day);
    return new Map(rows.map(row => [row.day, row.count]));
  }

  /**
   * Voice seconds keyed by UTC join day (`YYYY-MM-DD`) since `start`.
   */
  private async voiceBuckets(userId: string, guildId: string, start: Date): Promise<Map<string, number>> {
    const day = sql<string>`to_char(${voiceSessions.joinedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        day,
        seconds: sql<number>`coalesce(sum(${voiceSessions.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          eq(voiceSessions.guildId, guildId),
          gte(voiceSessions.joinedAt, start)
        )
      )
      .groupBy(day);
    return new Map(rows.map(row => [row.day, row.seconds]));
  }

  /**
   * Attach message and voice tracking to `client`, and recover open
   * sessions once the client is ready.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.MessageCreate, message => {
      if (message.author.bot || message.webhookId) {
        return;
      }
      if (!message.guildId) {
        return;
      }
      this.recordMessage({
        id: message.id,
        userId: message.author.id,
        guildId: message.guildId,
        channelId: message.channelId,
        createdAt: message.createdAt,
      }).catch(error => console.error("Message stats error:", error));
    });
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      if (newState.id === client.user?.id) {
        return;
      }
      const user = newState.member?.user ?? oldState.member?.user;
      if (user?.bot) {
        return;
      }
      this.trackVoiceState(newState.id, newState.guild.id, oldState.channelId, newState.channelId).catch(
        error => console.error("Voice stats error:", error)
      );
    });
    client.once(Events.ClientReady, readyClient => {
      void this.recoverOpenSessions(readyClient);
    });
  }

  /**
   * Close sessions orphaned by a restart, then open sessions for users
   * already in voice.
   */
  private async recoverOpenSessions(client: Client): Promise<void> {
    try {
      const staleClosed = await this.closeStaleSessions();
      if (staleClosed > 0) {
        console.log(`Closed ${staleClosed} stale voice session(s)`);
      }
      await this.seedOpenSessions(collectVoiceOccupants(client));
    } catch (error) {
      console.error("Voice stats recovery error:", error);
    }
  }

  /**
   * Key for the in-memory open session of one guild user.
   */
  private sessionKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  /**
   * Running duration of the in-memory open session, or `null` when the
   * user is not in voice. Closed rows already hold their durations, so
   * only the open session needs this overlay.
   */
  private liveVoice(guildId: string, userId: string, now: Date): { joinedAt: Date; seconds: number } | null {
    const open = this.openSessions.get(this.sessionKey(guildId, userId));
    if (!open) {
      return null;
    }
    return {
      joinedAt: open.joinedAt,
      seconds: Math.max(0, Math.floor((now.getTime() - open.joinedAt.getTime()) / 1000)),
    };
  }

  /**
   * Running durations of every in-memory open session in `guildId`. Closed
   * rows already hold their durations, so only open sessions need this
   * overlay. Keys are `guildId:userId`, so a prefix match scopes the guild.
   */
  private liveGuildVoice(
    guildId: string,
    now: Date
  ): { sessions: Array<{ joinedAt: Date; seconds: number }>; seconds: number } {
    const sessions: Array<{ joinedAt: Date; seconds: number }> = [];
    for (const [key, open] of this.openSessions) {
      if (!key.startsWith(`${guildId}:`)) {
        continue;
      }
      sessions.push({
        joinedAt: open.joinedAt,
        seconds: Math.max(0, Math.floor((now.getTime() - open.joinedAt.getTime()) / 1000)),
      });
    }
    return { sessions, seconds: sessions.reduce((sum, session) => sum + session.seconds, 0) };
  }
  /**
   * Insert the user row if missing, without a read. Satisfies the stats
   * foreign keys on the hot path.
   */
  private async ensureUser(userId: string): Promise<void> {
    await db.insert(globalUsers).values({ id: userId }).onConflictDoNothing({ target: globalUsers.id });
  }

  /**
   * Open a voice session, closing a duplicate open first.
   */
  private async openSession(guildId: string, userId: string, channelId: string, now: Date): Promise<void> {
    if (this.openSessions.has(this.sessionKey(guildId, userId))) {
      await this.closeSession(guildId, userId, now);
    }
    await this.ensureUser(userId);
    const [row] = await db
      .insert(voiceSessions)
      .values({ userId, guildId, channelId, joinedAt: now })
      .returning({ id: voiceSessions.id });
    this.openSessions.set(this.sessionKey(guildId, userId), { sessionId: row!.id, joinedAt: now });
  }
  /**
   * Close the open session, falling back to the newest open row when the
   * in-memory map missed it (e.g. joined before a restart).
   */
  private async closeSession(guildId: string, userId: string, now: Date): Promise<void> {
    const open = this.openSessions.get(this.sessionKey(guildId, userId));
    this.openSessions.delete(this.sessionKey(guildId, userId));
    if (open) {
      await this.finishSession(open.sessionId, open.joinedAt, now);
      return;
    }
    const [row] = await db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          eq(voiceSessions.guildId, guildId),
          isNull(voiceSessions.leftAt)
        )
      )
      .orderBy(desc(voiceSessions.joinedAt))
      .limit(1);
    if (row) {
      await this.finishSession(row.id, row.joinedAt, now);
    }
  }

  /**
   * Stamp `leftAt` and the whole-second duration on one session row.
   */
  private async finishSession(sessionId: string, joinedAt: Date, now: Date): Promise<void> {
    await db
      .update(voiceSessions)
      .set({
        leftAt: now,
        durationSeconds: Math.max(0, Math.floor((now.getTime() - joinedAt.getTime()) / 1000)),
      })
      .where(eq(voiceSessions.id, sessionId));
  }
}

/**
 * App-wide singleton for stats tracking, created once at startup and shared
 * by every event listener.
 */
export const statsService = new StatsService();

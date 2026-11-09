import { ownedByCluster } from "@/cluster/shard-sql";
import { db } from "@/db/index";
import GlobalUsersManager from "@/user/global-users-manager";
import { messageEventsSchema } from "@/db/schemas/message-events";
import { voiceSessionsSchema } from "@/db/schemas/voice-sessions";
import { EventBus } from "@/event/event-bus";
import VoiceSessionEndedEvent from "@/event/events/voice-session-ended.event";
import VoiceSessionStartedEvent from "@/event/events/voice-session-started.event";
import type { Client, Guild } from "discord.js";
import { and, desc, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type {
  CardStats,
  DaySeries,
  StatsCardKind,
  StatsSummary,
  VoiceSummary,
  VoiceWindow,
} from "./stats.types";

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
 * Running duration of an in-memory open voice session.
 */
interface LiveSession {
  joinedAt: Date;
  seconds: number;
}

// userId null = every user in the guild
function messageScope(guildId: string, userId: string | null): SQL | undefined {
  return and(
    eq(messageEventsSchema.guildId, guildId),
    userId === null ? undefined : eq(messageEventsSchema.userId, userId)
  );
}

function voiceScope(guildId: string, userId: string | null): SQL | undefined {
  return and(
    eq(voiceSessionsSchema.guildId, guildId),
    userId === null ? undefined : eq(voiceSessionsSchema.userId, userId)
  );
}

function countSince(column: PgColumn, start: Date): SQL<number> {
  return sql<number>`count(*) filter (where ${column} >= ${start})`.mapWith(Number);
}

function secondsSince(start: Date): SQL<number> {
  return sql<number>`coalesce(sum(${voiceSessionsSchema.durationSeconds}) filter (where ${voiceSessionsSchema.joinedAt} >= ${start}), 0)`.mapWith(
    Number
  );
}

/**
 * Pick one window out of a voice aggregate row, overlaying the live
 * sessions' running durations that started inside the window.
 */
function voiceWindow(
  row: Record<`${"today" | "last7" | "last30"}${"Sessions" | "Seconds"}`, number> | undefined,
  prefix: "today" | "last7" | "last30",
  start: Date,
  live: LiveSession[]
): VoiceWindow {
  const liveIn = live.filter(session => session.joinedAt >= start);
  return {
    sessions: row?.[`${prefix}Sessions`] ?? 0,
    seconds: (row?.[`${prefix}Seconds`] ?? 0) + liveIn.reduce((sum, session) => sum + session.seconds, 0),
  };
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

  public async recordMessage(record: MessageRecord): Promise<void> {
    await GlobalUsersManager.ensure(record.userId);
    await db
      .insert(messageEventsSchema)
      .values({
        id: record.id,
        userId: record.userId,
        guildId: record.guildId,
        channelId: record.channelId,
        createdAt: record.createdAt,
      })
      .onConflictDoNothing({ target: messageEventsSchema.id });
  }

  /**
   * Advance `userId`'s voice state: close on leave/move, open on join/move.
   * No-ops (mute/deafen) carry equal channels and are ignored. Session
   * start/end are posted as `VoiceSessionStartedEvent` / `VoiceSessionEndedEvent`
   * so progression consumers (levelling, etc.) can react.
   */
  public async trackVoiceState(
    guild: Guild,
    userId: string,
    oldChannelId: string | null,
    newChannelId: string | null,
    now: Date = new Date()
  ): Promise<void> {
    if (oldChannelId === newChannelId) {
      return;
    }
    if (oldChannelId !== null) {
      await this.closeSession(guild, userId, now);
    }
    if (newChannelId !== null) {
      await this.openSession(guild, userId, newChannelId, now);
    }
  }

  /** Scoped to this cluster's shards so a cluster restarting never closes another cluster's live sessions. */
  public async closeStaleSessions(client: Client): Promise<number> {
    const stale = await db
      .select()
      .from(voiceSessionsSchema)
      .where(and(isNull(voiceSessionsSchema.leftAt), ownedByCluster(voiceSessionsSchema.guildId, client)));
    // The real leave time is unknown, and closing at "now" would count the
    // whole downtime as voice time, so an orphaned session records no duration.
    for (const row of stale) {
      await this.finishSession(row.id, row.joinedAt, row.joinedAt);
    }
    this.openSessions.clear();
    return stale.length;
  }

  /**
   * Open sessions for users already in voice at startup, so their running
   * time keeps counting and future leaves close normally.
   */
  public async seedOpenSessions(
    client: Client,
    occupants: VoiceOccupant[],
    now: Date = new Date()
  ): Promise<void> {
    for (const occupant of occupants) {
      const guild = client.guilds.cache.get(occupant.guildId);
      if (!guild) {
        continue;
      }
      await this.openSession(guild, occupant.userId, occupant.channelId, now);
    }
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
    return this.cardData(guildId, userId, kind, now);
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
    return this.cardData(guildId, null, kind, now);
  }

  // userId null = every user in the guild
  private async cardData(
    guildId: string,
    userId: string | null,
    kind: StatsCardKind,
    now: Date
  ): Promise<CardStats> {
    const [messages, voice, series] = await Promise.all([
      this.messageWindows(guildId, userId, now),
      this.voiceWindows(guildId, userId, now),
      kind === "voice"
        ? this.voiceSeries(guildId, userId, 7, now)
        : this.messageSeries(guildId, userId, 7, now),
    ]);
    return { messages, voice, series };
  }

  private async messageWindows(guildId: string, userId: string | null, now: Date): Promise<StatsSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        today: countSince(messageEventsSchema.createdAt, windows.today),
        last7days: countSince(messageEventsSchema.createdAt, windows.last7Start),
        last30days: countSince(messageEventsSchema.createdAt, windows.last30Start),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(messageEventsSchema)
      .where(messageScope(guildId, userId));
    return {
      today: row?.today ?? 0,
      last7days: row?.last7days ?? 0,
      last30days: row?.last30days ?? 0,
      total: row?.total ?? 0,
    };
  }

  /**
   * Voice sessions and seconds in every display window, from a single
   * aggregate query. Live open sessions contribute their running durations;
   * their rows are already counted in the session totals.
   */
  private async voiceWindows(guildId: string, userId: string | null, now: Date): Promise<VoiceSummary> {
    const windows = statsWindows(now);
    const [row] = await db
      .select({
        todaySessions: countSince(voiceSessionsSchema.joinedAt, windows.today),
        todaySeconds: secondsSince(windows.today),
        last7Sessions: countSince(voiceSessionsSchema.joinedAt, windows.last7Start),
        last7Seconds: secondsSince(windows.last7Start),
        last30Sessions: countSince(voiceSessionsSchema.joinedAt, windows.last30Start),
        last30Seconds: secondsSince(windows.last30Start),
        totalSessions: sql<number>`count(*)`.mapWith(Number),
        totalSeconds: sql<number>`coalesce(sum(${voiceSessionsSchema.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessionsSchema)
      .where(voiceScope(guildId, userId));
    const live = this.liveSessions(guildId, userId, now);
    return {
      today: voiceWindow(row, "today", windows.today, live),
      last7days: voiceWindow(row, "last7", windows.last7Start, live),
      last30days: voiceWindow(row, "last30", windows.last30Start, live),
      total: {
        sessions: row?.totalSessions ?? 0,
        seconds: (row?.totalSeconds ?? 0) + live.reduce((sum, session) => sum + session.seconds, 0),
      },
    };
  }

  private async messageSeries(
    guildId: string,
    userId: string | null,
    days: number,
    now: Date
  ): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const day = sql<string>`to_char(${messageEventsSchema.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ day, count: sql<number>`count(*)`.mapWith(Number) })
      .from(messageEventsSchema)
      .where(and(messageScope(guildId, userId), gte(messageEventsSchema.createdAt, windows.seriesStart)))
      .groupBy(day);
    return toDaySeries(windows.seriesStart, days, new Map(rows.map(row => [row.day, row.count])));
  }

  /**
   * Per-day voice seconds for the chart, oldest first. Sessions land on
   * their join day; live sessions add their running durations there.
   */
  private async voiceSeries(
    guildId: string,
    userId: string | null,
    days: number,
    now: Date
  ): Promise<DaySeries> {
    const windows = statsWindows(now, days);
    const day = sql<string>`to_char(${voiceSessionsSchema.joinedAt} at time zone 'UTC', 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        day,
        seconds: sql<number>`coalesce(sum(${voiceSessionsSchema.durationSeconds}), 0)`.mapWith(Number),
      })
      .from(voiceSessionsSchema)
      .where(and(voiceScope(guildId, userId), gte(voiceSessionsSchema.joinedAt, windows.seriesStart)))
      .groupBy(day);
    const series = toDaySeries(windows.seriesStart, days, new Map(rows.map(row => [row.day, row.seconds])));
    for (const session of this.liveSessions(guildId, userId, now)) {
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
   * Close sessions orphaned by a restart, then open sessions for users
   * already in voice.
   */
  public async recoverOpenSessions(client: Client): Promise<void> {
    try {
      const staleClosed = await this.closeStaleSessions(client);
      if (staleClosed > 0) {
        console.log(`Closed ${staleClosed} stale voice session(s)`);
      }
      await this.seedOpenSessions(client, collectVoiceOccupants(client));
    } catch (error) {
      console.error("Voice stats recovery error:", error);
    }
  }

  private sessionKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  /**
   * Running durations of the in-memory open sessions in `guildId`, narrowed
   * to one user when `userId` is set. Closed rows already hold their
   * durations, so only open sessions need this overlay.
   */
  private liveSessions(guildId: string, userId: string | null, now: Date): LiveSession[] {
    const wanted = userId === null ? null : this.sessionKey(guildId, userId);
    const sessions: LiveSession[] = [];
    for (const [key, open] of this.openSessions) {
      if (wanted === null ? !key.startsWith(`${guildId}:`) : key !== wanted) {
        continue;
      }
      sessions.push({
        joinedAt: open.joinedAt,
        seconds: Math.max(0, Math.floor((now.getTime() - open.joinedAt.getTime()) / 1000)),
      });
    }
    return sessions;
  }

  private async openSession(guild: Guild, userId: string, channelId: string, now: Date): Promise<void> {
    const guildId = guild.id;
    if (this.openSessions.has(this.sessionKey(guildId, userId))) {
      await this.closeSession(guild, userId, now);
    }
    await GlobalUsersManager.ensure(userId);
    const [row] = await db
      .insert(voiceSessionsSchema)
      .values({ userId, guildId, channelId, joinedAt: now })
      .returning({ id: voiceSessionsSchema.id });
    this.openSessions.set(this.sessionKey(guildId, userId), { sessionId: row!.id, joinedAt: now });
    await EventBus.post(new VoiceSessionStartedEvent({ userId, guild, channelId, joinedAt: now }));
  }
  /**
   * Close the open session, falling back to the newest open row when the
   * in-memory map missed it (e.g. joined before a restart). Emits
   * `VoiceSessionEndedEvent` for progression consumers.
   */
  private async closeSession(guild: Guild, userId: string, now: Date): Promise<void> {
    const guildId = guild.id;
    const open = this.openSessions.get(this.sessionKey(guildId, userId));
    this.openSessions.delete(this.sessionKey(guildId, userId));
    let joinedAt: Date;
    if (open) {
      joinedAt = open.joinedAt;
      await this.finishSession(open.sessionId, joinedAt, now);
    } else {
      const [row] = await db
        .select()
        .from(voiceSessionsSchema)
        .where(
          and(
            eq(voiceSessionsSchema.userId, userId),
            eq(voiceSessionsSchema.guildId, guildId),
            isNull(voiceSessionsSchema.leftAt)
          )
        )
        .orderBy(desc(voiceSessionsSchema.joinedAt))
        .limit(1);
      if (!row) {
        return;
      }
      joinedAt = row.joinedAt;
      await this.finishSession(row.id, joinedAt, now);
    }
    await EventBus.post(
      new VoiceSessionEndedEvent({ userId, guild, channelId: null, joinedAt, leftAt: now })
    );
  }

  private async finishSession(sessionId: string, joinedAt: Date, now: Date): Promise<void> {
    await db
      .update(voiceSessionsSchema)
      .set({
        leftAt: now,
        durationSeconds: Math.max(0, Math.floor((now.getTime() - joinedAt.getTime()) / 1000)),
      })
      .where(eq(voiceSessionsSchema.id, sessionId));
  }
}

export const statsService = new StatsService();

import type { Client } from "discord.js";
import { Events } from "discord.js";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { globalUsers, messageEvents, voiceSessions } from "../../db/schema";

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
 * attach a `.catch` and never await.
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
   * Attach message and voice tracking to `client`, and recover open
   * sessions once the client is ready.
   */
  public registerHandlers(client: Client): void {
    client.on(Events.MessageCreate, message => {
      if (message.author.bot) {
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

  private sessionKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
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

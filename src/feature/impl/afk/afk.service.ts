import { ownedByCluster } from "@/cluster/shard-sql";
import { db } from "@/db/index";
import { guildAfkSchema } from "@/db/schemas/guild-afk";
import { TimeUnit } from "@/lib/time";
import type { Client } from "discord.js";
import { and, eq } from "drizzle-orm";

const NOTICE_COOLDOWN_MS = TimeUnit.toMillis(TimeUnit.Minute, 1);

export interface AfkState {
  reason: string | null;
  since: Date;
}

/**
 * Who is AFK, per guild. Every message asks "is the author away?", so the
 * rows are mirrored in memory (loaded on ready, kept current by `set` and
 * `clear`) instead of read from the database each time. Only the cluster that
 * owns a guild ever reads or writes its rows, so each cluster mirrors just its
 * own guilds and the table stays the source of truth only across restarts.
 */
class AfkService {
  private readonly states: Map<string, AfkState> = new Map();
  // last notice sent, per AFK member and channel, so a burst of mentions answers once
  private readonly lastNotice: Map<string, number> = new Map();

  private key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }

  public async load(client: Client): Promise<void> {
    this.states.clear();
    for (const row of await db
      .select()
      .from(guildAfkSchema)
      .where(ownedByCluster(guildAfkSchema.guildId, client))) {
      this.states.set(this.key(row.guildId, row.userId), { reason: row.reason, since: row.since });
    }
  }

  public get(guildId: string, userId: string): AfkState | undefined {
    return this.states.get(this.key(guildId, userId));
  }

  /** Marks the member away; running it again only replaces the reason, keeping `since`. */
  public async set(guildId: string, userId: string, reason: string | null): Promise<AfkState> {
    const [row] = await db
      .insert(guildAfkSchema)
      .values({ guildId, userId, reason })
      .onConflictDoUpdate({ target: [guildAfkSchema.guildId, guildAfkSchema.userId], set: { reason } })
      .returning();
    const state = { reason: row!.reason, since: row!.since };
    this.states.set(this.key(guildId, userId), state);
    return state;
  }

  /** The state that was cleared, or `null` when the member was not AFK. */
  public async clear(guildId: string, userId: string): Promise<AfkState | null> {
    const state = this.get(guildId, userId);
    if (!state) {
      return null;
    }
    this.states.delete(this.key(guildId, userId));
    await db
      .delete(guildAfkSchema)
      .where(and(eq(guildAfkSchema.guildId, guildId), eq(guildAfkSchema.userId, userId)));
    return state;
  }

  /** `true` when this notice may be sent now, and records it so the next one waits. */
  public claimNotice(guildId: string, userId: string, channelId: string, now: number = Date.now()): boolean {
    for (const [staleKey, at] of this.lastNotice) {
      if (now - at >= NOTICE_COOLDOWN_MS) {
        this.lastNotice.delete(staleKey);
      }
    }
    const key = `${this.key(guildId, userId)}:${channelId}`;
    if (now - (this.lastNotice.get(key) ?? 0) < NOTICE_COOLDOWN_MS) {
      return false;
    }
    this.lastNotice.set(key, now);
    return true;
  }
}

export const afkService = new AfkService();

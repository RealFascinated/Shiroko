import { and, count, desc, eq, like, or } from "drizzle-orm";
import type { Guild } from "discord.js";
import { db, type DbClient } from "../db/index";
import { guildAuditLogSchema, type GuildAuditLogSchema } from "../db/schemas/guild-audit-log";
import type { JsonValue } from "../db/schemas/guild-settings";
import { loadPage, type Page } from "../lib/pagination";

/** Who made a change; `userId` is null when the bot did it on its own. */
export interface AuditActor {
  guild: Guild;
  userId: string | null;
}

export interface AuditChange {
  oldValue: JsonValue | null;
  newValue: JsonValue | null;
}

export interface AuditFilter {
  /** A key or a key prefix: `levels` matches `levels.messageXp`. */
  key?: string;
  userId?: string;
}

/**
 * Append-only history of configuration changes, kept forever. A change is
 * written in the same transaction as the row it describes, so the log can
 * never disagree with the stored state.
 */
export default class AuditLog {
  /**
   * Run `change` in a transaction and record what it reports. `change`
   * performs the write and returns the before/after values, or `null` when
   * nothing actually changed, in which case no entry is recorded.
   * `onCommitted` runs after the transaction and before the entry event posts,
   * so its handlers read the state just written.
   */
  public static async write(
    actor: AuditActor,
    kind: string,
    key: string,
    change: (tx: DbClient) => Promise<AuditChange | null>,
    onCommitted?: () => void
  ): Promise<void> {
    const entry = await db.transaction(async tx => {
      const changed = await change(tx as unknown as DbClient);
      if (!changed) {
        return null;
      }
      const [row] = await tx
        .insert(guildAuditLogSchema)
        .values({ guildId: actor.guild.id, actorId: actor.userId, kind, key, ...changed })
        .returning();
      return row ?? null;
    });
    onCommitted?.();
    if (entry) {
      // Dynamic: the bus chain reaches `permissions.ts`, which imports this file.
      const { EventBus } = await import("../event/event-bus");
      const { default: AuditEntryRecordedEvent } = await import("../event/events/audit-entry-recorded.event");
      await EventBus.post(new AuditEntryRecordedEvent({ guild: actor.guild, entry }));
    }
  }

  public static async get(guildId: string, id: number): Promise<GuildAuditLogSchema | null> {
    const [row] = await db
      .select()
      .from(guildAuditLogSchema)
      .where(and(eq(guildAuditLogSchema.guildId, guildId), eq(guildAuditLogSchema.id, id)));
    return row ?? null;
  }

  public static async page(
    guildId: string,
    page: number,
    pageSize: number,
    filter: AuditFilter
  ): Promise<Page<GuildAuditLogSchema>> {
    const where = and(
      eq(guildAuditLogSchema.guildId, guildId),
      filter.userId ? eq(guildAuditLogSchema.actorId, filter.userId) : undefined,
      filter.key
        ? or(eq(guildAuditLogSchema.key, filter.key), like(guildAuditLogSchema.key, `${filter.key}.%`))
        : undefined
    );
    return loadPage({
      page,
      pageSize,
      count: async () => {
        const [row] = await db.select({ total: count() }).from(guildAuditLogSchema).where(where);
        return row?.total ?? 0;
      },
      rows: (limit, offset) =>
        db
          .select()
          .from(guildAuditLogSchema)
          .where(where)
          .orderBy(desc(guildAuditLogSchema.createdAt), desc(guildAuditLogSchema.id))
          .limit(limit)
          .offset(offset),
    });
  }
}

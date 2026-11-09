import { and, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { db } from "../db/index";
import { guildHistorySchema } from "../db/schemas/guild-history";
import { userHistorySchema } from "../db/schemas/user-history";
import { EventBus } from "../event/event-bus";
import type Event from "../event/event";
import { EventListener } from "../event/event-listener";
import { resolveAuditActor } from "../feature/impl/logging/lib/audit-log";
import { loadPage, type Page } from "../lib/pagination";
import GlobalUsersManager from "../user/global-users-manager";
import type { HistoryEntry } from "./history-kind";
import type GuildEventKind from "./guild-event-kind";
import type UserHistoryKind from "./user-history-kind";
import type { UserChangeEvent } from "./user-history-kind";
import { GUILD_EVENT_KINDS, GUILD_KIND_BY_ID, USER_HISTORY_KINDS, USER_KIND_BY_ID } from "./kinds";

export interface GuildHistoryFilter {
  /** Defaults to every guild kind. */
  kinds?: readonly string[];
  /** A subject id or a dotted prefix of one: `levels` matches `levels.messageXp`. */
  subject?: string;
  actorId?: string;
}

/**
 * Records every change its kinds describe into `user_history` (global
 * account changes) and `guild_history` (everything inside one guild), and
 * reads them back. A new event-driven kind needs no code here: add it to
 * `kinds.ts`. Kinds without an event (settings, permissions) are written by
 * `HistoryWriter` into the same table.
 */
export default class History extends EventListener {
  constructor() {
    super();
    for (const kind of USER_HISTORY_KINDS) {
      EventBus.register(this, kind.eventClass, event => this.recordUser(kind, event));
    }
    for (const kind of GUILD_EVENT_KINDS) {
      EventBus.register(this, kind.eventClass, event => this.recordGuild(kind, event));
    }
  }

  private async recordUser(kind: UserHistoryKind<UserChangeEvent>, event: UserChangeEvent): Promise<void> {
    const draft = kind.draft(event);
    if (!draft) {
      return;
    }
    const user = await GlobalUsersManager.getUser(draft.user);
    await db
      .insert(userHistorySchema)
      .values({ userId: user.id, kind: kind.id, oldValue: draft.oldValue, newValue: draft.newValue });
  }

  private async recordGuild(kind: GuildEventKind<Event>, event: Event): Promise<void> {
    const draft = kind.draft(event);
    if (!draft) {
      return;
    }
    const actor =
      kind.auditActions.length > 0
        ? await resolveAuditActor(draft.guild, kind.auditActions, draft.subjectId)
        : null;
    await db.insert(guildHistorySchema).values({
      guildId: draft.guild.id,
      kind: kind.id,
      subjectId: draft.subjectId,
      actorId: actor?.executor?.id ?? null,
      oldValue: draft.oldValue,
      newValue: draft.newValue,
    });
  }

  /**
   * A user's account changes and their changes in `guildId`, newest first.
   * `kinds` narrows to those kinds, which also decides which tables are read.
   */
  public static async userPage(
    userId: string,
    guildId: string,
    page: number,
    pageSize: number,
    kinds?: readonly string[]
  ): Promise<Page<HistoryEntry>> {
    const account = kinds === undefined || kinds.some(kind => kind in USER_KIND_BY_ID);
    const server = kinds === undefined || kinds.some(kind => kind in GUILD_KIND_BY_ID);
    const accountWhere = and(
      eq(userHistorySchema.userId, userId),
      kinds ? inArray(userHistorySchema.kind, [...kinds]) : undefined
    );
    const serverWhere = and(
      eq(guildHistorySchema.guildId, guildId),
      eq(guildHistorySchema.subjectId, userId),
      kinds ? inArray(guildHistorySchema.kind, [...kinds]) : undefined
    );
    return loadPage({
      page,
      pageSize,
      count: async () =>
        (account ? await History.total(userHistorySchema, accountWhere) : 0) +
        (server ? await History.total(guildHistorySchema, serverWhere) : 0),
      rows: (limit, offset) => {
        const newest = desc(sql`created_at`);
        if (account && server) {
          return unionAll(History.accountEntries(accountWhere), History.serverEntries(serverWhere))
            .orderBy(newest)
            .limit(limit)
            .offset(offset);
        }
        return (account ? History.accountEntries(accountWhere) : History.serverEntries(serverWhere))
          .orderBy(newest)
          .limit(limit)
          .offset(offset);
      },
    });
  }

  public static async get(guildId: string, id: number): Promise<HistoryEntry | null> {
    const [row] = await History.serverEntries(
      and(eq(guildHistorySchema.guildId, guildId), eq(guildHistorySchema.id, id))
    );
    return row ?? null;
  }

  /** Every recorded change in the guild, newest first, optionally narrowed by `filter`. */
  public static async guildPage(
    guildId: string,
    page: number,
    pageSize: number,
    filter: GuildHistoryFilter = {}
  ): Promise<Page<HistoryEntry>> {
    const { kinds = Object.keys(GUILD_KIND_BY_ID), subject, actorId } = filter;
    const where = and(
      eq(guildHistorySchema.guildId, guildId),
      inArray(guildHistorySchema.kind, [...kinds]),
      subject
        ? or(eq(guildHistorySchema.subjectId, subject), like(guildHistorySchema.subjectId, `${subject}.%`))
        : undefined,
      actorId ? eq(guildHistorySchema.actorId, actorId) : undefined
    );
    return loadPage({
      page,
      pageSize,
      count: () => History.total(guildHistorySchema, where),
      rows: (limit, offset) =>
        History.serverEntries(where)
          .orderBy(desc(sql`created_at`), desc(sql`id`))
          .limit(limit)
          .offset(offset),
    });
  }

  private static async total(
    table: typeof userHistorySchema | typeof guildHistorySchema,
    where?: SQL
  ): Promise<number> {
    const [row] = await db.select({ total: count() }).from(table).where(where);
    return row?.total ?? 0;
  }

  private static accountEntries(where?: SQL) {
    return db
      .select({
        id: userHistorySchema.id,
        kind: userHistorySchema.kind,
        subjectId: userHistorySchema.userId,
        actorId: sql<string | null>`null::text`,
        oldValue: userHistorySchema.oldValue,
        newValue: userHistorySchema.newValue,
        createdAt: userHistorySchema.createdAt,
      })
      .from(userHistorySchema)
      .where(where);
  }

  private static serverEntries(where?: SQL) {
    return db
      .select({
        id: guildHistorySchema.id,
        kind: guildHistorySchema.kind,
        subjectId: guildHistorySchema.subjectId,
        actorId: guildHistorySchema.actorId,
        oldValue: guildHistorySchema.oldValue,
        newValue: guildHistorySchema.newValue,
        createdAt: guildHistorySchema.createdAt,
      })
      .from(guildHistorySchema)
      .where(where);
  }
}

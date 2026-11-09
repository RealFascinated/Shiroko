import { and, count, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";
import { db } from "../db/index";
import { guildAuditSchema } from "../db/schemas/guild-audit";
import { userAuditSchema } from "../db/schemas/user-audit";
import { EventBus } from "../event/event-bus";
import type Event from "../event/event";
import { EventListener } from "../event/event-listener";
import { resolveAuditActor } from "../feature/impl/logging/lib/audit-log";
import { loadPage, type Page } from "../lib/pagination";
import GlobalUsersManager from "../user/global-users-manager";
import type { AuditEntry } from "./audit-kind";
import type GuildEventKind from "./guild-event-kind";
import type UserAuditKind from "./user-audit-kind";
import type { UserChangeEvent } from "./user-audit-kind";
import { GUILD_EVENT_KINDS, GUILD_KIND_BY_ID, USER_AUDIT_KINDS, USER_KIND_BY_ID } from "./kinds";

export interface GuildAuditFilter {
  /** Defaults to every guild kind. */
  kinds?: readonly string[];
  /** A subject id or a dotted prefix of one: `levels` matches `levels.messageXpMin`. */
  subject?: string;
  actorId?: string;
}

/**
 * Records every change its kinds describe into `user_audit` (global
 * account changes) and `guild_audit` (everything inside one guild), and
 * reads them back. A new event-driven kind needs no code here: add it to
 * `kinds.ts`. Kinds without an event (settings, permissions) are written by
 * `AuditWriter` into the same table.
 */
export default class Audit extends EventListener {
  constructor() {
    super();
    for (const kind of USER_AUDIT_KINDS) {
      EventBus.register(this, kind.eventClass, event => this.recordUser(kind, event));
    }
    for (const kind of GUILD_EVENT_KINDS) {
      EventBus.register(this, kind.eventClass, event => this.recordGuild(kind, event));
    }
  }

  private async recordUser(kind: UserAuditKind<UserChangeEvent>, event: UserChangeEvent): Promise<void> {
    const draft = kind.draft(event);
    if (!draft) {
      return;
    }
    const user = await GlobalUsersManager.getUser(draft.user);
    await db
      .insert(userAuditSchema)
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
    await db.insert(guildAuditSchema).values({
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
  ): Promise<Page<AuditEntry>> {
    const account = kinds === undefined || kinds.some(kind => kind in USER_KIND_BY_ID);
    const server = kinds === undefined || kinds.some(kind => kind in GUILD_KIND_BY_ID);
    const accountWhere = and(
      eq(userAuditSchema.userId, userId),
      kinds ? inArray(userAuditSchema.kind, [...kinds]) : undefined
    );
    const serverWhere = and(
      eq(guildAuditSchema.guildId, guildId),
      eq(guildAuditSchema.subjectId, userId),
      kinds ? inArray(guildAuditSchema.kind, [...kinds]) : undefined
    );
    return loadPage({
      page,
      pageSize,
      count: async () =>
        (account ? await Audit.total(userAuditSchema, accountWhere) : 0) +
        (server ? await Audit.total(guildAuditSchema, serverWhere) : 0),
      rows: (limit, offset) => {
        const newest = desc(sql`created_at`);
        if (account && server) {
          return unionAll(Audit.accountEntries(accountWhere), Audit.serverEntries(serverWhere))
            .orderBy(newest)
            .limit(limit)
            .offset(offset);
        }
        return (account ? Audit.accountEntries(accountWhere) : Audit.serverEntries(serverWhere))
          .orderBy(newest)
          .limit(limit)
          .offset(offset);
      },
    });
  }

  public static async get(guildId: string, id: number): Promise<AuditEntry | null> {
    const [row] = await Audit.serverEntries(
      and(eq(guildAuditSchema.guildId, guildId), eq(guildAuditSchema.id, id))
    );
    return row ?? null;
  }

  /** Every recorded change in the guild, newest first, optionally narrowed by `filter`. */
  public static async guildPage(
    guildId: string,
    page: number,
    pageSize: number,
    filter: GuildAuditFilter = {}
  ): Promise<Page<AuditEntry>> {
    const { kinds = Object.keys(GUILD_KIND_BY_ID), subject, actorId } = filter;
    const where = and(
      eq(guildAuditSchema.guildId, guildId),
      inArray(guildAuditSchema.kind, [...kinds]),
      subject
        ? or(eq(guildAuditSchema.subjectId, subject), like(guildAuditSchema.subjectId, `${subject}.%`))
        : undefined,
      actorId ? eq(guildAuditSchema.actorId, actorId) : undefined
    );
    return loadPage({
      page,
      pageSize,
      count: () => Audit.total(guildAuditSchema, where),
      rows: (limit, offset) =>
        Audit.serverEntries(where)
          .orderBy(desc(sql`created_at`), desc(sql`id`))
          .limit(limit)
          .offset(offset),
    });
  }

  private static async total(
    table: typeof userAuditSchema | typeof guildAuditSchema,
    where?: SQL
  ): Promise<number> {
    const [row] = await db.select({ total: count() }).from(table).where(where);
    return row?.total ?? 0;
  }

  private static accountEntries(where?: SQL) {
    return db
      .select({
        id: userAuditSchema.id,
        kind: userAuditSchema.kind,
        subjectId: userAuditSchema.userId,
        actorId: sql<string | null>`null::text`,
        oldValue: userAuditSchema.oldValue,
        newValue: userAuditSchema.newValue,
        createdAt: userAuditSchema.createdAt,
      })
      .from(userAuditSchema)
      .where(where);
  }

  private static serverEntries(where?: SQL) {
    return db
      .select({
        id: guildAuditSchema.id,
        kind: guildAuditSchema.kind,
        subjectId: guildAuditSchema.subjectId,
        actorId: guildAuditSchema.actorId,
        oldValue: guildAuditSchema.oldValue,
        newValue: guildAuditSchema.newValue,
        createdAt: guildAuditSchema.createdAt,
      })
      .from(guildAuditSchema)
      .where(where);
  }
}

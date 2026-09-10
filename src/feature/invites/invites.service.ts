import { PermissionFlagsBits, type Guild, type Invite } from "discord.js";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { guildInvites, inviteJoins } from "../../db/schema";

/**
 * The result of diffing a member join against the invite snapshot
 * immediately before it: either the code that gained a use, or nothing.
 */
export type JoinAttribution = {
  code: string;
  inviterId: string | null;
};

/**
 * A row of the /invites leaderboard, aggregated per inviting user.
 */
export interface InviteLeaderRow {
  inviterId: string;
  invites: number;
}

/**
 * Live invite tracking for one guild: snapshots `uses` per code in memory
 * so `guildMemberAdd` can diff them against a fresh fetch and attribute
 * the join to whichever code gained a use.
 *
 * In-memory state is seeded per guild on `ClientReady`/`GuildCreate` and
 * maintained on `inviteCreate`/`inviteDelete`. The DB snapshot (`guild_invites`)
 * only records current state; `invite_joins` holds one row per attributed
 * join, so totals always derive from `count()`.
 *
 * Not all joins have a code that gained a use: vanity URLs, the OAuth
 * widget, and expired single-use invites shift no `uses` counter. Those
 * land in `invite_joins` with `(inviter_id, code)` null.
 *
 * The service records best-effort: callers attach `.catch` and never
 * await. It falls back to unknown attribution when the bot lacks
 * `ManageGuild` (so the cache stays empty and every join is unknown).
 */
export default class InvitesService {
  /** Per-guild snapshot of `code -> uses`, the pre-join diff baseline. */
  private cache: Map<string, Map<string, number>> = new Map();

  /**
   * Fetch every invite for `guild`, replace the in-memory snapshot, and
   * upsert the DB snapshot. Returns `false` when the fetch failed (missing
   * `ManageGuild`); the caller leaves the cache empty and yields unknown
   * joins.
   */
  public async refreshGuild(guild: Guild): Promise<boolean> {
    let invites: Map<string, Invite>;
    try {
      invites = await guild.invites.fetch();
    } catch {
      this.cache.set(guild.id, new Map());
      return false;
    }
    const snapshot = new Map<string, number>();
    for (const invite of invites.values()) {
      snapshot.set(invite.code, invite.uses ?? 0);
      await this.upsertGuildInvite(guild.id, invite);
    }
    this.cache.set(guild.id, snapshot);
    return true;
  }

  /**
   * Record a newly created invite in the snapshot and DB.
   */
  public async handleInviteCreate(invite: Invite): Promise<void> {
    const guild = invite.guild;
    if (!guild) {
      return;
    }
    const guildState = this.guildState(guild.id);
    guildState.set(invite.code, invite.uses ?? 0);
    await this.upsertGuildInvite(guild.id, invite);
  }

  /**
   * Drop a deleted invite from the snapshot and DB. The delete payload
   * carries no `uses`, so only delete when we know the code we cached.
   */
  public async handleInviteDelete(invite: Invite): Promise<void> {
    const guild = invite.guild;
    if (!guild) {
      return;
    }
    this.guildState(guild.id).delete(invite.code);
    const known = await db
      .select({ inviterId: guildInvites.inviterId })
      .from(guildInvites)
      .where(and(eq(guildInvites.guildId, guild.id), eq(guildInvites.code, invite.code)));
    if (known.length === 1) {
      await db
        .delete(guildInvites)
        .where(and(eq(guildInvites.guildId, guild.id), eq(guildInvites.code, invite.code)));
    }
  }

  /**
   * Diff a fresh invite fetch against `snapshot` to find which code, if
   * any, gained uses. Returns `null` when no code gained (vanity, widget,
   * expired single-use) or the fetch failed. Afterward the in-memory and
   * DB snapshots are rebased onto the fresh fetch.
   *
   * The fetch is intentionally sequential with the caller's member join
   * handling; the event loop is single-threaded so no other invite diff
   * can interleave. Multiple members joining at once resolve to whatever
   * their respective diffs saw. Best-effort, not exact.
   */
  public async diffJoin(guild: Guild, snapshot: Map<string, number>): Promise<JoinAttribution | null> {
    let invites: Map<string, Invite>;
    try {
      invites = await guild.invites.fetch();
    } catch {
      this.cache.set(guild.id, new Map());
      return null;
    }
    let used: Invite | null = null;
    for (const invite of invites.values()) {
      const after = invite.uses ?? 0;
      if (after > (snapshot.get(invite.code) ?? 0)) {
        used = invite;
        break;
      }
    }
    // Rebase both snapshots onto the fresh fetch so the next join diffs
    // against this state.
    const rebased = new Map<string, number>();
    for (const invite of invites.values()) {
      rebased.set(invite.code, invite.uses ?? 0);
      await this.upsertGuildInvite(guild.id, invite);
    }
    this.cache.set(guild.id, rebased);
    if (!used) {
      return null;
    }
    const inviterId = used.inviter?.id ?? used.inviterId ?? null;
    return { code: used.code, inviterId };
  }

  /**
   * Record a member join, attributed or not.
   */
  public async recordJoin(
    guildId: string,
    memberId: string,
    attribution: JoinAttribution | null,
    now: Date = new Date()
  ): Promise<void> {
    await db.insert(inviteJoins).values({
      guildId,
      memberId,
      inviterId: attribution?.inviterId ?? null,
      code: attribution?.code ?? null,
      joinedAt: now,
    });
  }

  /**
   * Snapshot state for one guild, creating an empty map on first use.
   */
  private guildState(guildId: string): Map<string, number> {
    let state = this.cache.get(guildId);
    if (!state) {
      state = new Map();
      this.cache.set(guildId, state);
    }
    return state;
  }

  /**
   * Current cached baseline for one guild (empty when not yet seeded).
   */
  public snapshot(guildId: string): Map<string, number> {
    return this.guildState(guildId);
  }

  /**
   * Whether the bot has `ManageGuild` in `guild`, without throwing: the
   * permission check needs a member fetch, so it surfaces as false without
   * one.
   */
  public async canTrack(guild: Guild): Promise<boolean> {
    try {
      const me = await guild.members.fetchMe();
      return me.permissions.has(PermissionFlagsBits.ManageGuild);
    } catch {
      return false;
    }
  }

  /**
   * Leaderboard rows for `guildId`: total invited members per inviter,
   * most-invited first. Unknown joins (null inviter) are excluded.
   */
  public async leaderboard(guildId: string): Promise<InviteLeaderRow[]> {
    const rows = await db
      .select({
        inviterId: inviteJoins.inviterId,
        invites: sql<number>`count(*)`.mapWith(Number),
      })
      .from(inviteJoins)
      .where(and(eq(inviteJoins.guildId, guildId), isNotNull(inviteJoins.inviterId)))
      .groupBy(inviteJoins.inviterId)
      .orderBy(desc(sql`count(*)`));
    return rows.map(row => ({ inviterId: row.inviterId as string, invites: row.invites }));
  }

  /**
   * Upsert one invite's snapshot row in the DB, keeping `createdAt` from
   * the first sighting.
   */
  private async upsertGuildInvite(guildId: string, invite: Invite): Promise<void> {
    await db
      .insert(guildInvites)
      .values({
        guildId,
        code: invite.code,
        inviterId: invite.inviterId ?? null,
        uses: invite.uses ?? 0,
      })
      .onConflictDoUpdate({
        target: [guildInvites.guildId, guildInvites.code],
        set: {
          inviterId: sql`excluded.inviter_id`,
          uses: sql`excluded.uses`,
          createdAt: sql`guild_invites.created_at`,
        },
      });
  }
}

export const invitesService = new InvitesService();

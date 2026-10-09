import { db } from "@/db/index";
import { guildInvitesSchema } from "@/db/schemas/guild-invites";
import { inviteJoinsSchema } from "@/db/schemas/invite-joins";
import { PermissionFlagsBits, type Guild, type Invite } from "discord.js";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  emptySnapshot,
  findJoinSource,
  type InviteSnapshot,
  type JoinSource,
  type TrackedInvite,
} from "./join-source";

/**
 * Live invite tracking for one guild: snapshots each invite's `uses` and
 * inviter in memory, plus the vanity URL's uses, so a member join can be
 * diffed against a fresh fetch and attributed to whichever source gained a
 * use.
 *
 * In-memory state is seeded per guild on `ClientReady`/`GuildCreate` and
 * maintained on `inviteCreate`/`inviteDelete`. The DB snapshot (`guild_invites`)
 * only records current state; `invite_joins` holds one row per attributed
 * join, so totals always derive from `count()`.
 *
 * Not all joins have a source that gained a use: the OAuth widget and
 * expired single-use invites shift no counter. Those land in `invite_joins`
 * with `(inviter_id, code)` null.
 *
 * The service is best-effort: attribution never throws, so a join is always
 * logged and recorded, and it falls back to unknown when the bot lacks
 * `ManageGuild` (so the cache stays empty and every join is unknown).
 */
export default class InvitesService {
  /** Per-guild snapshot of invite and vanity `uses`, the pre-join diff baseline. */
  private cache: Map<string, InviteSnapshot> = new Map();

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
      this.cache.set(guild.id, emptySnapshot());
      return false;
    }
    const snapshot = new Map<string, TrackedInvite>();
    for (const invite of invites.values()) {
      snapshot.set(invite.code, trackedInvite(invite));
      await this.upsertGuildInvite(guild.id, invite);
    }
    const vanity = await this.fetchVanity(guild);
    this.cache.set(guild.id, { invites: snapshot, vanity });
    return true;
  }

  public async handleInviteCreate(invite: Invite): Promise<void> {
    const guild = invite.guild;
    if (!guild) {
      return;
    }
    this.guildState(guild.id).invites.set(invite.code, trackedInvite(invite));
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
    this.guildState(guild.id).invites.delete(invite.code);
    const known = await db
      .select({ inviterId: guildInvitesSchema.inviterId })
      .from(guildInvitesSchema)
      .where(and(eq(guildInvitesSchema.guildId, guild.id), eq(guildInvitesSchema.code, invite.code)));
    if (known.length === 1) {
      await db
        .delete(guildInvitesSchema)
        .where(and(eq(guildInvitesSchema.guildId, guild.id), eq(guildInvitesSchema.code, invite.code)));
    }
  }

  /**
   * Where a member joining now came from: the invite code that gained a use,
   * the guild's vanity URL when that gained one instead, or `null` when
   * neither did (the widget, an expired single-use invite) or the guild
   * cannot be tracked.
   *
   * Never throws. Attribution is best-effort, while the join it explains
   * still has to be logged and recorded, so a failed fetch or rebase
   * degrades to unknown.
   */
  public async resolveJoin(guild: Guild): Promise<JoinSource | null> {
    try {
      return await this.diff(guild);
    } catch {
      return null;
    }
  }

  /**
   * Diff a fresh fetch against the cached snapshot and rebase both the
   * in-memory and DB snapshots onto it, so the next join diffs against this
   * state.
   *
   * The fetch is intentionally sequential with the caller's member join
   * handling; the event loop is single-threaded so no other invite diff can
   * interleave. Multiple members joining at once resolve to whatever their
   * respective diffs saw. Best-effort, not exact.
   */
  private async diff(guild: Guild): Promise<JoinSource | null> {
    const before = this.guildState(guild.id);
    let invites: Map<string, Invite>;
    try {
      invites = await guild.invites.fetch();
    } catch {
      this.cache.set(guild.id, emptySnapshot());
      return null;
    }
    const after: InviteSnapshot = { invites: new Map(), vanity: await this.fetchVanity(guild) };
    for (const invite of invites.values()) {
      after.invites.set(invite.code, trackedInvite(invite));
    }
    const source = findJoinSource(before, after);
    // Rebase both snapshots onto the fresh fetch so the next join diffs
    // against this state. The cache goes first: a failed DB write must not
    // leave the baseline stale and re-attribute the same use to the next
    // join.
    this.cache.set(guild.id, after);
    for (const invite of invites.values()) {
      await this.upsertGuildInvite(guild.id, invite);
    }
    return source;
  }

  /**
   * The guild's vanity URL and its uses, or `null` when it has none or the
   * fetch failed (below boost level 3, or missing `ManageGuild`). A vanity
   * URL is a bonus, not a tracking requirement, so the failure stays quiet.
   */
  private async fetchVanity(guild: Guild): Promise<{ code: string; uses: number } | null> {
    try {
      const vanity = await guild.fetchVanityData();
      return vanity.code ? { code: vanity.code, uses: vanity.uses } : null;
    } catch {
      return null;
    }
  }

  public async recordJoin(
    guildId: string,
    memberId: string,
    source: JoinSource | null,
    now: Date = new Date()
  ): Promise<void> {
    await db.insert(inviteJoinsSchema).values({
      guildId,
      memberId,
      inviterId: source?.kind === "invite" ? source.inviterId : null,
      code: source?.code ?? null,
      joinedAt: now,
    });
  }

  /**
   * Stamp the member's newest unstamped join in the guild as left now.
   * Every leave is recorded; a board decides from the stay length whether
   * the join counts as a fake invite.
   */
  public async recordLeave(guildId: string, memberId: string, now: Date = new Date()): Promise<void> {
    const latest = db
      .select({ id: inviteJoinsSchema.id })
      .from(inviteJoinsSchema)
      .where(
        and(
          eq(inviteJoinsSchema.guildId, guildId),
          eq(inviteJoinsSchema.memberId, memberId),
          isNull(inviteJoinsSchema.leftAt)
        )
      )
      .orderBy(desc(inviteJoinsSchema.joinedAt))
      .limit(1);
    await db.update(inviteJoinsSchema).set({ leftAt: now }).where(inArray(inviteJoinsSchema.id, latest));
  }

  private guildState(guildId: string): InviteSnapshot {
    let state = this.cache.get(guildId);
    if (!state) {
      state = emptySnapshot();
      this.cache.set(guildId, state);
    }
    return state;
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
   * Upsert one invite's snapshot row in the DB, keeping `createdAt` from
   * the first sighting.
   */
  private async upsertGuildInvite(guildId: string, invite: Invite): Promise<void> {
    await db
      .insert(guildInvitesSchema)
      .values({
        guildId,
        code: invite.code,
        inviterId: invite.inviterId ?? null,
        uses: invite.uses ?? 0,
      })
      .onConflictDoUpdate({
        target: [guildInvitesSchema.guildId, guildInvitesSchema.code],
        set: {
          inviterId: sql`excluded.inviter_id`,
          uses: sql`excluded.uses`,
          createdAt: sql`guild_invites.created_at`,
        },
      });
  }
}

/** The tracked state of one invite: what a diff compares against and the DB stores. */
function trackedInvite(invite: Invite): TrackedInvite {
  return { uses: invite.uses ?? 0, inviterId: invite.inviter?.id ?? invite.inviterId ?? null };
}

export const invitesService = new InvitesService();

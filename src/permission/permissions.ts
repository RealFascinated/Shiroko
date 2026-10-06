import { PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import { and, eq, sql } from "drizzle-orm";
import { Cache } from "../cache/cache";
import { Caches } from "../cache/index";
import { guildKey } from "../cache/key";
import { db } from "../db/index";
import { permissionRolesSchema } from "../db/schemas/permission-roles";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import RoleDeletedEvent from "../event/events/role-deleted.event";
import RoleUpdatedEvent from "../event/events/role-updated.event";
import { loadPage, type Page } from "../lib/pagination";

/**
 * One bit per bot permission; named after the command it gates. Bits are
 * permanent; once a flag is assigned, its bit is never reused for another
 * meaning (existing rows persist indefinitely).
 *
 * A frozen const object rather than a TS enum: TS enums only support
 * `number` values, and flag bits are `bigint`s (Discord's own model).
 */
export const PermissionFlags = Object.freeze({
  FEATURE_COMMAND: 1n << 1n,
  PERMISSIONS_COMMAND: 1n << 2n,
  SETTINGS_COMMAND: 1n << 4n,
  AUTOROLE_COMMAND: 1n << 5n,
  WELCOMER_COMMAND: 1n << 6n,
  LOGGING_COMMAND: 1n << 7n,
  LEVELS_COMMAND: 1n << 9n,
  // 1n << 8n was retired with the YouTube feature; never reuse a retired bit.
} as const satisfies Record<string, bigint>);

/**
 * Single source of truth for user-facing, formatted flag names, used both
 * for `/permissions` choice labels and for decoding flags in `/view`.
 */
export const FLAG_DISPLAY_NAMES: ReadonlyArray<{ flag: PermissionFlag; label: string }> = [
  { flag: PermissionFlags.FEATURE_COMMAND, label: "Feature Command" },
  { flag: PermissionFlags.PERMISSIONS_COMMAND, label: "Permissions Command" },
  { flag: PermissionFlags.SETTINGS_COMMAND, label: "Settings Command" },
  { flag: PermissionFlags.AUTOROLE_COMMAND, label: "Autoroles Command" },
  { flag: PermissionFlags.WELCOMER_COMMAND, label: "Welcomer Command" },
  { flag: PermissionFlags.LOGGING_COMMAND, label: "Logging Command" },
  { flag: PermissionFlags.LEVELS_COMMAND, label: "Levels Command" },
];

export type PermissionFlag = (typeof PermissionFlags)[keyof typeof PermissionFlags];

export function isPermissionFlag(value: unknown): value is PermissionFlag {
  return Object.values(PermissionFlags).includes(value as PermissionFlag);
}

export function flagLabels(flags: bigint): string[] {
  return FLAG_DISPLAY_NAMES.filter(({ flag }) => (flags & flag) === flag).map(({ label }) => label);
}

/** Every known flag OR'd together; the "all permissions" grant. */
export const ALL_FLAGS = FLAG_DISPLAY_NAMES.reduce((all, { flag }) => all | flag, 0n);

export function hasFlags(flags: bigint, required: bigint): boolean {
  return (flags & required) === required;
}

/** Members holding Discord `Administrator` bypass every flag check (owner always does, regardless). */
export const ALLOW_ADMIN_BYPASS = true;

type RoleConfig = { own: bigint; parent: string | null };

/**
 * One configured role as listed by `/permissions view`, with the flags it
 * effectively holds once inheritance is applied.
 */
export interface PaginatedRoleConfig extends RoleConfig {
  roleId: string;
  effective: bigint;
}

/**
 * Role-based bot permissions.
 *
 * Resolution: a role's effective flags are its own flags OR'd with its
 * parent's effective flags (additive inheritance), and a member's flags are
 * the OR across every role they hold. Owner and (optionally) Discord
 * `Administrator` bypass everything.
 *
 * The whole guild's configured roles are cached as one entry, because every
 * read needs the full map anyway: resolution walks a role's ancestry, which
 * the cache cannot know in advance. Any write to a guild's rows drops that
 * guild's entry, so the cache is authoritative. Guild leave purges it
 * through the cache registry.
 */
export default class Permissions {
  private static readonly CACHE: Cache<Map<string, RoleConfig>> = Caches.register(
    new Cache<Map<string, RoleConfig>>({ name: "permissions", mode: "authoritative", max: 5_000 })
  );

  /**
   * Sanity check: a `bigint` beyond the loaded window is meaningless.
   */
  public static isKnownFlag(flag: bigint): boolean {
    return FLAG_DISPLAY_NAMES.some(({ flag: known }) => known === flag);
  }

  /**
   * Set a role's own flags and (optionally) its parent, rejecting cycles
   * where `roleId` would appear in its own ancestry. Drops the guild's
   * cached config. Returns the new effective flags for the role.
   */
  public static async setRole(
    guildId: string,
    roleId: string,
    ownFlags: bigint,
    parentRoleId: string | null = null
  ): Promise<bigint> {
    await Permissions.assertNoCycle(guildId, roleId, parentRoleId);
    await db
      .insert(permissionRolesSchema)
      .values({
        guildId,
        roleId,
        flags: String(ownFlags),
        parentRoleId,
      })
      .onConflictDoUpdate({
        target: [permissionRolesSchema.guildId, permissionRolesSchema.roleId],
        set: { flags: String(ownFlags), parentRoleId },
      });
    Permissions.invalidateGuild(guildId);
    return Permissions.roleEffectiveFlags(guildId, roleId);
  }

  /**
   * Change only a role's parent link (upserting with `0n` own flags if the
   * role has no row yet). Returns the role's new effective flags.
   */
  public static async setParent(
    guildId: string,
    roleId: string,
    parentRoleId: string | null
  ): Promise<bigint> {
    // Validate before any DB access so a clean rejection doesn't touch the DB.
    await Permissions.assertNoCycle(guildId, roleId, parentRoleId);
    const current = await Permissions.roleOwnFlags(guildId, roleId);
    return Permissions.setRole(guildId, roleId, current, parentRoleId);
  }

  /**
   * Delete a role's row entirely; the role then resolves to no flags.
   * Descendants pointing at it become dangling-parent → no inherited flags.
   */
  public static async clearRole(guildId: string, roleId: string): Promise<void> {
    await db
      .delete(permissionRolesSchema)
      .where(and(eq(permissionRolesSchema.guildId, guildId), eq(permissionRolesSchema.roleId, roleId)));
    Permissions.invalidateGuild(guildId);
  }

  /**
   * Move (or clear) a role's parent link. Used when a Discord role is
   * deleted. Descendants of the deleted role become standalone. Returns the
   * updated rows.
   */
  public static async onRoleDeleted(guildId: string, roleId: string): Promise<void> {
    await Permissions.clearRole(guildId, roleId);
    await db
      .update(permissionRolesSchema)
      .set({ parentRoleId: null, updatedAt: new Date() })
      .where(and(eq(permissionRolesSchema.guildId, guildId), eq(permissionRolesSchema.parentRoleId, roleId)));
    Permissions.invalidateGuild(guildId);
  }

  public static async memberFlags(guild: Guild, member: GuildMember): Promise<bigint> {
    if (guild.ownerId === member.id) {
      return ALL_FLAGS;
    }
    if (ALLOW_ADMIN_BYPASS && member.permissions.has(PermissionFlagsBits.Administrator)) {
      return ALL_FLAGS;
    }
    const configs = await Permissions.loadGuild(guild.id);
    let flags = 0n;
    for (const roleId of member.roles.cache.keys()) {
      flags |= Permissions.resolveEffective(configs, roleId);
    }
    return flags;
  }

  public static async memberHas(guild: Guild, member: GuildMember, required: bigint): Promise<boolean> {
    if (required === 0n) {
      return true;
    }
    return hasFlags(await Permissions.memberFlags(guild, member), required);
  }

  public static async roleEffectiveFlags(guildId: string, roleId: string): Promise<bigint> {
    const configs = await Permissions.loadGuild(guildId);
    return Permissions.resolveEffective(configs, roleId);
  }

  /**
   * One page of the guild's configured roles, ordered by role id, each with
   * the flags it effectively holds. Postgres selects the page
   * (`LIMIT`/`OFFSET`) and counts the total.
   *
   * Resolution walks a role's ancestry, which reaches outside the page, so
   * the query also returns each page role's ancestor chain (depth-capped in
   * case stored rows form a cycle). The in-memory walk stays
   * {@link Permissions.resolveEffective}, so inheritance is defined once.
   */
  public static async pageConfigs(
    guildId: string,
    page: number,
    pageSize: number
  ): Promise<Page<PaginatedRoleConfig>> {
    return loadPage({
      page,
      pageSize,
      count: async () => {
        const [row] = await db
          .select({ total: sql<number>`count(*)`.mapWith(Number) })
          .from(permissionRolesSchema)
          .where(eq(permissionRolesSchema.guildId, guildId));
        return row?.total ?? 0;
      },
      rows: async (limit, offset) => {
        const result = await db.execute(sql`
          with recursive page_roles as (
            select role_id from permission_roles
            where guild_id = ${guildId}
            order by role_id
            limit ${limit} offset ${offset}
          ), ancestry as (
            select configured.role_id as role_id, configured.flags as flags,
              configured.parent_role_id as parent_role_id,
              configured.role_id as root, array[configured.role_id] as visited
            from permission_roles configured
            join page_roles page on page.role_id = configured.role_id
            where configured.guild_id = ${guildId}
            union all
            select ancestor.role_id, ancestor.flags, ancestor.parent_role_id,
              ancestry.root, ancestry.visited || ancestor.role_id
            from ancestry
            join permission_roles ancestor on ancestor.role_id = ancestry.parent_role_id
            where ancestor.guild_id = ${guildId}
              and not (ancestor.role_id = any(ancestry.visited))
          )
          select role_id, flags, parent_role_id, root from ancestry
        `);
        const chains = new Map<string, Map<string, RoleConfig>>();
        for (const row of result.rows as Array<{
          role_id: string;
          flags: string;
          parent_role_id: string | null;
          root: string;
        }>) {
          const chain = chains.get(row.root) ?? new Map<string, RoleConfig>();
          chain.set(row.role_id, { own: BigInt(row.flags), parent: row.parent_role_id });
          chains.set(row.root, chain);
        }
        const pageRoles: PaginatedRoleConfig[] = [];
        for (const [roleId, chain] of chains) {
          const own = chain.get(roleId);
          if (!own) {
            continue;
          }
          pageRoles.push({
            roleId,
            own: own.own,
            parent: own.parent,
            effective: Permissions.resolveEffective(chain, roleId),
          });
        }
        return pageRoles.sort((a, b) => (a.roleId < b.roleId ? -1 : a.roleId > b.roleId ? 1 : 0));
      },
    });
  }

  public static async roleOwnFlags(guildId: string, roleId: string): Promise<bigint> {
    const configs = await Permissions.loadGuild(guildId);
    return configs.get(roleId)?.own ?? 0n;
  }

  public static async loadGuild(guildId: string): Promise<Map<string, RoleConfig>> {
    return Permissions.CACHE.load(guildKey(guildId), async () => {
      const rows = await db
        .select()
        .from(permissionRolesSchema)
        .where(eq(permissionRolesSchema.guildId, guildId));
      return new Map(rows.map(r => [r.roleId, { own: BigInt(r.flags), parent: r.parentRoleId }]));
    });
  }

  /**
   * Resolve a role's effective flags from an in-memory guild config,
   * walking the parent chain up to the root. Visited-set breaks cycles.
   */
  public static resolveEffective(configs: Map<string, RoleConfig>, roleId: string): bigint {
    const visited = new Set<string>();
    let effective = 0n;
    let current: string | undefined = roleId;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      const node = configs.get(current);
      if (!node) {
        break;
      }
      effective |= node.own;
      current = node.parent ?? undefined;
    }
    if (current !== undefined && visited.has(current) && configs.has(current)) {
      console.warn(`Permission cycle detected at role ${current}`);
    }
    return effective;
  }

  /**
   * Drop a guild's cached config. Every write to a guild's rows goes
   * through here, so inheritance cannot serve a stale map. The cache holds
   * one entry per guild, so there is no per-role case to narrow.
   */
  public static invalidateGuild(guildId: string): void {
    Permissions.CACHE.invalidate(guildKey(guildId));
  }

  private static async assertNoCycle(
    guildId: string,
    roleId: string,
    parentRoleId: string | null
  ): Promise<void> {
    if (parentRoleId === null) {
      return;
    }
    if (parentRoleId === roleId) {
      throw new Error("A role cannot be its own parent.");
    }
    const configs = await Permissions.loadGuild(guildId);
    let current: string | undefined = parentRoleId;
    const visited = new Set<string>();
    while (current !== undefined && !visited.has(current)) {
      if (current === roleId) {
        throw new Error("A role cannot inherit from a descendant of itself (cycle).");
      }
      visited.add(current);
      current = configs.get(current)?.parent ?? undefined;
    }
  }
}

/**
 * Keeps the permission config cache consistent with gateway role events.
 * Only changes to a guild's configured rows matter: a member gaining or
 * losing a role does not change the config, so member events are not
 * subscribed.
 */
export class PermissionsListeners extends EventListener {
  constructor() {
    super();
    EventBus.subscribe(this);
  }

  @EventHandler(RoleUpdatedEvent)
  public async onRoleUpdated(event: RoleUpdatedEvent): Promise<void> {
    await Permissions.clearRole(event.guildData.id, event.roleId);
  }

  @EventHandler(RoleDeletedEvent)
  public async onRoleDeleted(event: RoleDeletedEvent): Promise<void> {
    await Permissions.onRoleDeleted(event.guildData.id, event.roleId);
  }
}

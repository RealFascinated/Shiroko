import { PermissionFlagsBits, type Guild, type GuildMember } from "discord.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { permissionRoles } from "../db/schema";
import { EventBus } from "../event/event-bus";
import { EventHandler } from "../event/event-handler";
import { EventListener } from "../event/event-listener";
import MemberRolesUpdatedEvent from "../event/events/member-roles-updated.event";
import RoleDeletedEvent from "../event/events/role-deleted.event";
import RoleUpdatedEvent from "../event/events/role-updated.event";

/**
 * One bit per bot permission; named after the command it gates. Bits are
 * permanent — once a flag is assigned, its bit is never reused for another
 * meaning (existing rows persist indefinitely).
 *
 * A frozen const object rather than a TS enum: TS enums only support
 * `number` values, and flag bits are `bigint`s (Discord's own model).
 */
export const PermissionFlags = Object.freeze({
  FEATURE_COMMAND: 1n << 1n,
  PERMISSIONS_COMMAND: 1n << 2n,
} as const satisfies Record<string, bigint>);

/**
 * Single source of truth for user-facing, formatted flag names — used both
 * for `/permissions` choice labels and for decoding flags in `/view`.
 */
export const FLAG_DISPLAY_NAMES: ReadonlyArray<{ flag: PermissionFlag; label: string }> = [
  { flag: PermissionFlags.FEATURE_COMMAND, label: "Feature Command" },
  { flag: PermissionFlags.PERMISSIONS_COMMAND, label: "Permissions Command" },
];

export type PermissionFlag = (typeof PermissionFlags)[keyof typeof PermissionFlags];

export function isPermissionFlag(value: unknown): value is PermissionFlag {
  return Object.values(PermissionFlags).includes(value as PermissionFlag);
}

export function flagLabels(flags: bigint): string[] {
  return FLAG_DISPLAY_NAMES.filter(({ flag }) => (flags & flag) === flag).map(({ label }) => label);
}

/** Every known flag OR'd together — the "all permissions" grant. */
export const ALL_FLAGS = FLAG_DISPLAY_NAMES.reduce((all, { flag }) => all | flag, 0n);

export function hasFlags(flags: bigint, required: bigint): boolean {
  return (flags & required) === required;
}

/** Members holding Discord `Administrator` bypass every flag check (owner always does, regardless). */
export const ALLOW_ADMIN_BYPASS = true;

type RoleConfig = { own: bigint; parent: string | null };

/** `guildId:roleId` → configured row (own + parent). Absent = no configured row (defaults to no flags). */
const ROLE_CACHE = new Map<string, RoleConfig>();

/**
 * Role-based bot permissions.
 *
 * Resolution: a role's effective flags are its own flags OR'd with its
 * parent's effective flags (additive inheritance), and a member's flags are
 * the OR across every role they hold. Owner and (optionally) Discord
 * `Administrator` bypass everything. Cache mirrors `GuildFeatures`;
 * invalidated on role events and permission writes.
 */
export default class Permissions {
  /**
   * Sanity check: a `bigint` beyond the loaded window is meaningless.
   */
  public static isKnownFlag(flag: bigint): boolean {
    return FLAG_DISPLAY_NAMES.some(({ flag: known }) => known === flag);
  }

  /**
   * Set a role's own flags and (optionally) its parent, rejecting cycles
   * where `roleId` would appear in its own ancestry. Clears the cache for
   * the role and every role that inherits from it. Returns the new
   * effective flags for the role.
   */
  public static async setRole(
    guildId: string,
    roleId: string,
    ownFlags: bigint,
    parentRoleId: string | null = null
  ): Promise<bigint> {
    await Permissions.assertNoCycle(guildId, roleId, parentRoleId);
    await db
      .insert(permissionRoles)
      .values({
        guildId,
        roleId,
        flags: String(ownFlags),
        parentRoleId,
      })
      .onConflictDoUpdate({
        target: [permissionRoles.guildId, permissionRoles.roleId],
        set: { flags: String(ownFlags), parentRoleId },
      });
    Permissions.clearRoleCascade(guildId, roleId);
    return Permissions.roleEffectiveFlags(guildId, roleId);
  }

  /**
   * Change only a role's parent link (upserting with `0n` own flags if the
   * role has no row yet), clearing the cache for the role and descendants.
   * Returns the role's new effective flags.
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
      .delete(permissionRoles)
      .where(and(eq(permissionRoles.guildId, guildId), eq(permissionRoles.roleId, roleId)));
    Permissions.clearRoleCascade(guildId, roleId);
  }

  /**
   * Move (or clear) a role's parent link — used when a Discord role is
   * deleted. Descendants of the deleted role become standalone. Returns the
   * updated rows.
   */
  public static async onRoleDeleted(guildId: string, roleId: string): Promise<void> {
    await Permissions.clearRole(guildId, roleId);
    await db
      .update(permissionRoles)
      .set({ parentRoleId: null, updatedAt: new Date() })
      .where(and(eq(permissionRoles.guildId, guildId), eq(permissionRoles.parentRoleId, roleId)));
    Permissions.clearRoleCascade(guildId, roleId);
  }

  /**
   * Effective flags for a member: the OR over their roles' effective flags,
   * with owner and (when enabled) `Administrator` bypasses.
   */
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

  /**
   * Whether `member` holds every flag in `required`.
   */
  public static async memberHas(guild: Guild, member: GuildMember, required: bigint): Promise<boolean> {
    if (required === 0n) {
      return true;
    }
    return hasFlags(await Permissions.memberFlags(guild, member), required);
  }

  /**
   * Effective flags for one role (own | ancestors), with cycle safety.
   */
  public static async roleEffectiveFlags(guildId: string, roleId: string): Promise<bigint> {
    const configs = await Permissions.loadGuild(guildId);
    return Permissions.resolveEffective(configs, roleId);
  }

  /**
   * All configured roles in a guild, keyed by role id.
   */
  public static async allConfigs(guildId: string): Promise<Map<string, RoleConfig>> {
    const rows = await db.select().from(permissionRoles).where(eq(permissionRoles.guildId, guildId));
    return new Map(rows.map(r => [r.roleId, { own: BigInt(r.flags), parent: r.parentRoleId }]));
  }

  public static async roleOwnFlags(guildId: string, roleId: string): Promise<bigint> {
    const configs = await Permissions.loadGuild(guildId);
    return configs.get(roleId)?.own ?? 0n;
  }

  /**
   * Load (and cache) the whole guild's permission rows. `null` cache entry
   * means the resolved role has no configured row.
   */
  public static async loadGuild(guildId: string): Promise<Map<string, RoleConfig>> {
    const rows = await db.select().from(permissionRoles).where(eq(permissionRoles.guildId, guildId));
    return new Map(rows.map(r => [r.roleId, { own: BigInt(r.flags), parent: r.parentRoleId }]));
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

  public static clearRoleCascade(guildId: string, roleId: string): void {
    for (const key of ROLE_CACHE.keys()) {
      if (!key.startsWith(`${guildId}:`)) {
        continue;
      }
      const cachedRole = key.slice(guildId.length + 1);
      if (cachedRole === roleId || Permissions.chainContains(guildId, cachedRole, roleId)) {
        ROLE_CACHE.delete(key);
      }
    }
  }

  public static clearGuild(guildId: string): void {
    for (const key of ROLE_CACHE.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        ROLE_CACHE.delete(key);
      }
    }
  }

  public static clearAll(): void {
    ROLE_CACHE.clear();
  }

  /**
   * Walk `roleId`'s ancestry from the cache's resolved configs; return true
   * if `ancestorId` appears in the chain.
   */
  public static chainContains(guildId: string, roleId: string, ancestorId: string): boolean {
    const visited = new Set<string>();
    let current: string | undefined = roleId;
    while (current !== undefined && !visited.has(current)) {
      if (current === ancestorId) {
        return true;
      }
      visited.add(current);
      const config = ROLE_CACHE.get(`${guildId}:${current}`);
      current = config?.parent ?? undefined;
    }
    return false;
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
    const configs = await Permissions.allConfigs(guildId);
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

export type { RoleConfig };

/**
 * Keeps the permission role cache consistent with gateway role/member
 * events. The invalidation hooks the old `Permissions.registerHandlers`
 * attached are now event listeners.
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

  @EventHandler(MemberRolesUpdatedEvent)
  public async onMemberRolesUpdated(event: MemberRolesUpdatedEvent): Promise<void> {
    if (event.oldMember.roles.cache.size !== event.newMember.roles.cache.size) {
      await Permissions.clearGuild(event.newMember.guild.id);
    }
  }
}

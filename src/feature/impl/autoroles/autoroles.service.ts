import { Cache } from "@/cache/cache";
import { Caches } from "@/cache/index";
import { guildKey } from "@/cache/key";
import { db } from "@/db/index";
import { autorolesSchema } from "@/db/schemas/autoroles";
import type { Guild, GuildMember, Role } from "discord.js";
import { and, eq } from "drizzle-orm";

/**
 * Counts from a guild-wide autorole sync. `changed` counts members who
 * received at least one role; `granted` counts the roles handed out.
 */
export interface AutorolesSyncResult {
  scanned: number;
  changed: number;
  granted: number;
  failed: number;
}

/**
 * Progress callback for {@link AutorolesService.syncToGuild}: `scanned` of
 * `total` members have been examined so far.
 */
export type AutorolesSyncProgress = (scanned: number, total: number) => Promise<void>;

export default class AutorolesService {
  /**
   * Per-guild list of configured autorole role IDs. Authoritative: `add` and
   * `remove` invalidate the guild's entry, and guild leave purges it through
   * the cache registry. Role objects are resolved from the guild cache on
   * every read, so a cached list never outlives a role's state.
   */
  private static readonly CACHE = Caches.register(
    new Cache<string[]>({ name: "autoroles", mode: "authoritative", max: 5_000 })
  );

  /**
   * Add a role to the guild's autorole list. Returns `true` if the role
   * was new, `false` if it was already configured.
   */
  public async add(guildId: string, roleId: string): Promise<boolean> {
    const result = await db
      .insert(autorolesSchema)
      .values({ guildId, roleId })
      .onConflictDoNothing({ target: [autorolesSchema.guildId, autorolesSchema.roleId] })
      .returning({ roleId: autorolesSchema.roleId });
    if (result.length > 0) {
      AutorolesService.CACHE.invalidate(guildKey(guildId));
    }
    return result.length > 0;
  }

  /**
   * Remove a role from the guild's autorole list. Returns `true` if a row
   * was removed, `false` if the role was not configured.
   */
  public async remove(guildId: string, roleId: string): Promise<boolean> {
    const result = await db
      .delete(autorolesSchema)
      .where(and(eq(autorolesSchema.guildId, guildId), eq(autorolesSchema.roleId, roleId)))
      .returning({ roleId: autorolesSchema.roleId });
    if (result.length > 0) {
      AutorolesService.CACHE.invalidate(guildKey(guildId));
    }
    return result.length > 0;
  }

  /**
   * All roles configured as autoroles in a guild, with any that no longer
   * exist in the guild cache filtered out. Reads the role ID list from the
   * per-guild cache; role resolution and expiry filtering stay outside it.
   */
  public async list(guild: Guild): Promise<Role[]> {
    const roleIds = await AutorolesService.CACHE.load(guildKey(guild.id), async () => {
      const rows = await db
        .select({ roleId: autorolesSchema.roleId })
        .from(autorolesSchema)
        .where(eq(autorolesSchema.guildId, guild.id));
      return rows.map(r => r.roleId);
    });
    return roleIds.map(id => guild.roles.cache.get(id)).filter((r): r is Role => r !== undefined);
  }

  /**
   * Grant every missing assignable autorole to the guild's human members,
   * covering anyone who joined before a role was configured or whose
   * original grant failed. Roles above the bot's highest role are skipped
   * and bots are ignored, mirroring the join grant. `onProgress` is
   * awaited every 100 members and on the final member. Grant failures are
   * logged, never fatal.
   */
  public async syncToGuild(guild: Guild, onProgress?: AutorolesSyncProgress): Promise<AutorolesSyncResult> {
    const roles = (await this.list(guild)).filter(role => this.isAssignable(role));
    const result: AutorolesSyncResult = { scanned: 0, changed: 0, granted: 0, failed: 0 };
    const members = await guild.members.fetch();
    const total = members.size;
    for (const member of members.values()) {
      result.scanned++;
      if (!member.user.bot) {
        const missing = roles.filter(role => !member.roles.cache.has(role.id));
        if (missing.length > 0) {
          try {
            await member.roles.add(missing);
            result.changed++;
            result.granted += missing.length;
          } catch (error) {
            result.failed++;
            console.error(`Failed to grant autoroles to ${member.id} in ${guild.id}:`, error);
          }
        }
      }
      if (onProgress && (result.scanned % 100 === 0 || result.scanned === total)) {
        await onProgress(result.scanned, total);
      }
    }
    return result;
  }

  /**
   * Grant every valid autorole to a newly joined member. Roles that sit
   * above the bot's highest role are skipped. Grant failures are logged,
   * never fatal.
   */
  public async applyToMember(guild: Guild, member: GuildMember): Promise<void> {
    const roles = (await this.list(guild)).filter(this.isAssignable);
    if (roles.length === 0) {
      return;
    }
    try {
      await member.roles.add(roles);
    } catch (error) {
      console.error(`Failed to grant autoroles to ${member.id} in ${guild.id}:`, error);
    }
  }

  /**
   * Whether a role can be assigned in its guild: it is not @everyone and
   * is not above the bot's highest role position.
   */
  private isAssignable(role: Role): boolean {
    if (role.id === role.guild.id) {
      return false;
    }
    const me = role.guild.members.me;
    if (me && role.position >= me.roles.highest.position) {
      return false;
    }
    return true;
  }
}

export const autorolesService = new AutorolesService();

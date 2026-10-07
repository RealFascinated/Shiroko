import type { Guild, GuildMember, Role } from "discord.js";
import { autorolesSettings } from "./autoroles-settings";

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
   * Add a role to the guild's autorole list. Returns `true` if the role
   * was new, `false` if it was already configured.
   */
  public async add(guildId: string, roleId: string): Promise<boolean> {
    const roleIds = await autorolesSettings.get(guildId, "roleIds");
    if (roleIds.includes(roleId)) {
      return false;
    }
    await autorolesSettings.set(guildId, "roleIds", [...roleIds, roleId]);
    return true;
  }

  /**
   * Remove a role from the guild's autorole list. Returns `true` if a row
   * was removed, `false` if the role was not configured.
   */
  public async remove(guildId: string, roleId: string): Promise<boolean> {
    const roleIds = await autorolesSettings.get(guildId, "roleIds");
    if (!roleIds.includes(roleId)) {
      return false;
    }
    await autorolesSettings.set(
      guildId,
      "roleIds",
      roleIds.filter(id => id !== roleId)
    );
    return true;
  }

  public async list(guild: Guild): Promise<Role[]> {
    const roleIds = await autorolesSettings.get(guild.id, "roleIds");
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
            await member.roles.add(missing, "Autorole");
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

  public async applyToMember(guild: Guild, member: GuildMember): Promise<void> {
    const roles = (await this.list(guild)).filter(this.isAssignable);
    if (roles.length === 0) {
      return;
    }
    try {
      await member.roles.add(roles, "Autorole");
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

import { syncMembers, type MemberSyncProgress, type MemberSyncResult } from "@/lib/member-sync";
import { isAssignableRole } from "@/lib/roles";
import type { Guild, GuildMember, Role } from "discord.js";
import { autorolesSettings } from "./autoroles-settings";

export default class AutorolesService {
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
  public async syncToGuild(guild: Guild, onProgress?: MemberSyncProgress): Promise<MemberSyncResult> {
    const roles = (await this.list(guild)).filter(isAssignableRole);
    return syncMembers(
      guild,
      "Autorole",
      member => roles.filter(role => !member.roles.cache.has(role.id)),
      onProgress
    );
  }

  public async applyToMember(guild: Guild, member: GuildMember): Promise<void> {
    const roles = (await this.list(guild)).filter(isAssignableRole);
    if (roles.length === 0) {
      return;
    }
    try {
      await member.roles.add(roles, "Autorole");
    } catch (error) {
      console.error(`Failed to grant autoroles to ${member.id} in ${guild.id}:`, error);
    }
  }
}

export const autorolesService = new AutorolesService();

import { db } from "@/db/index";
import { autoroles } from "@/db/schemas/autoroles";
import type { Guild, GuildMember, Role } from "discord.js";
import { and, eq } from "drizzle-orm";

export default class AutorolesService {
  /**
   * Add a role to the guild's autorole list. Returns `true` if the role
   * was new, `false` if it was already configured.
   */
  public async add(guildId: string, roleId: string): Promise<boolean> {
    const result = await db
      .insert(autoroles)
      .values({ guildId, roleId })
      .onConflictDoNothing({ target: [autoroles.guildId, autoroles.roleId] })
      .returning({ roleId: autoroles.roleId });
    return result.length > 0;
  }

  /**
   * Remove a role from the guild's autorole list. Returns `true` if a row
   * was removed, `false` if the role was not configured.
   */
  public async remove(guildId: string, roleId: string): Promise<boolean> {
    const result = await db
      .delete(autoroles)
      .where(and(eq(autoroles.guildId, guildId), eq(autoroles.roleId, roleId)))
      .returning({ roleId: autoroles.roleId });
    return result.length > 0;
  }

  /**
   * All roles configured as autoroles in a guild, with any that no longer
   * exist in the guild cache filtered out.
   */
  public async list(guild: Guild): Promise<Role[]> {
    const rows = await db
      .select({ roleId: autoroles.roleId })
      .from(autoroles)
      .where(eq(autoroles.guildId, guild.id));
    return rows
      .map(r => guild.roles.cache.get(r.roleId))
      .filter((r): r is Role => r !== undefined);
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

import type { Guild } from "discord.js";
import Event from "../event";

/**
 * A guild role was deleted.
 */
export default class RoleDeletedEvent extends Event {
  public readonly roleId: string;
  public readonly guildData: Guild;

  constructor(roleId: string, guild: Guild) {
    super({ guild });
    this.roleId = roleId;
    this.guildData = guild;
  }
}

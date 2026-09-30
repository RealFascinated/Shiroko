import type { Role } from "discord.js";
import Event from "../event";

export default class RoleUpdatedEvent extends Event {
  public readonly roleId: string;
  public readonly guildData: Role["guild"];
  public readonly oldRole: Role;
  public readonly newRole: Role;

  constructor(oldRole: Role, newRole: Role) {
    super({ guild: newRole.guild });
    this.roleId = newRole.id;
    this.guildData = newRole.guild;
    this.oldRole = oldRole;
    this.newRole = newRole;
  }
}

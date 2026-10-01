import type { Role } from "discord.js";
import Event from "../event";

export default class RoleCreatedEvent extends Event {
  public readonly roleId: string;
  public readonly role: Role;
  public readonly guildData: Role["guild"];

  constructor(role: Role) {
    super({ guild: role.guild });
    this.roleId = role.id;
    this.role = role;
    this.guildData = role.guild;
  }
}

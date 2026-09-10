import type { GuildMember, PartialGuildMember } from "discord.js";
import Event from "../event";

/**
 * A guild member's roles (or other fields) changed. The old member may be
 * partial (discord.js emits `PartialGuildMember` when the member wasn't
 * cached), so roles are compared via the `roles` cache sizes.
 */
export default class MemberRolesUpdatedEvent extends Event {
  public readonly oldMember: GuildMember | PartialGuildMember;
  public readonly newMember: GuildMember;

  constructor(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    super({
      guild: newMember.guild,
      userId: newMember.id,
    });
    this.oldMember = oldMember;
    this.newMember = newMember;
  }
}

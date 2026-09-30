import type { GuildMember, PartialGuildMember } from "discord.js";
import Event from "../event";

/**
 * A guild member's nickname changed. `nickname` is `null` when the member
 * has none (their username is used instead), so a reset shows as a change
 * to null.
 */
export default class MemberNicknameUpdatedEvent extends Event {
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

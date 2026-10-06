import type { GuildMember, PartialGuildMember } from "discord.js";
import Event from "../event";

/**
 * A member started or stopped boosting the guild. `boosted` says which, so
 * consumers read the direction from the event rather than comparing dates
 * themselves.
 */
export default class MemberBoostUpdatedEvent extends Event {
  public readonly oldMember: GuildMember | PartialGuildMember;
  public readonly newMember: GuildMember;
  public readonly boosted: boolean;

  constructor(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    super({
      guild: newMember.guild,
      userId: newMember.id,
    });
    this.oldMember = oldMember;
    this.newMember = newMember;
    this.boosted = newMember.premiumSinceTimestamp !== null;
  }
}

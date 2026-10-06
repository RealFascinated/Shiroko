import type { GuildMember, PartialGuildMember } from "discord.js";
import Event from "../event";

/**
 * A member's communication timeout was applied, changed, or lifted.
 * `timeoutUntil` is `null` when the member is no longer timed out, which
 * covers both a manual removal and a timeout running its course.
 */
export default class MemberTimeoutUpdatedEvent extends Event {
  public readonly oldMember: GuildMember | PartialGuildMember;
  public readonly newMember: GuildMember;
  public readonly timeoutUntil: Date | null;

  constructor(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
    super({
      guild: newMember.guild,
      userId: newMember.id,
    });
    this.oldMember = oldMember;
    this.newMember = newMember;
    this.timeoutUntil = newMember.communicationDisabledUntil;
  }
}

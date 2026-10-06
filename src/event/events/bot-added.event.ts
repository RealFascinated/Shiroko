import type { GuildMember } from "discord.js";
import Event from "../event";

/**
 * A bot joined a guild. The bridge emits this instead of
 * `MemberGuildJoinEvent` for bot accounts, which the welcome flow must not
 * greet; a `BotAdd` audit entry names whoever added it.
 */
export default class BotAddedEvent extends Event {
  public readonly member: GuildMember;

  constructor(member: GuildMember) {
    super({
      guild: member.guild,
      userId: member.id,
    });
    this.member = member;
  }
}

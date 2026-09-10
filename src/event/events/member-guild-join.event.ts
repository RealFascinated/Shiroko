import type { GuildMember } from "discord.js";
import type GlobalUser from "../../user/global-user";
import Event from "../event";

/**
 * A member joined a guild. Wraps the `GuildMember` with pre-resolved
 * context for invite attribution.
 */
export default class MemberGuildJoinEvent extends Event {
  public readonly member: GuildMember;

  constructor(member: GuildMember, globalUser: GlobalUser | null = null) {
    super({
      guild: member.guild,
      userId: member.id,
      globalUser,
    });
    this.member = member;
  }
}

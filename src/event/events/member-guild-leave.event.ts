import type GlobalUser from "@/user/global-user";
import type { GuildMember, PartialGuildMember } from "discord.js";
import Event from "../event";

/**
 * A member left a guild. Wraps the `GuildMember` with pre-resolved
 * context. The member may be partial, since Discord does not send role
 * data for a member that is no longer in the guild.
 */
export default class MemberGuildLeaveEvent extends Event {
  public readonly member: GuildMember | PartialGuildMember;

  constructor(member: GuildMember | PartialGuildMember, globalUser: GlobalUser | null = null) {
    super({
      guild: member.guild,
      userId: member.id,
      globalUser,
    });
    this.member = member;
  }
}

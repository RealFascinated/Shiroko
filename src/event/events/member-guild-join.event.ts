import type { JoinSource } from "@/feature/impl/invites/join-source";
import type { GuildMember } from "discord.js";
import Event from "../event";

/**
 * A member joined a guild. Wraps the `GuildMember` with pre-resolved
 * context: the invite or vanity URL the join is attributed to.
 */
export default class MemberGuildJoinEvent extends Event {
  public readonly member: GuildMember;
  public readonly source: JoinSource | null;

  constructor(member: GuildMember, source: JoinSource | null) {
    super({
      guild: member.guild,
      userId: member.id,
    });
    this.member = member;
    this.source = source;
  }
}

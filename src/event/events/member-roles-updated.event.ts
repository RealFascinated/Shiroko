import type { Collection, GuildMember, PartialGuildMember, Role } from "discord.js";
import Event from "../event";

/**
 * A guild member's roles changed. Carries the computed added and removed
 * roles so consumers don't have to diff caches; exactly one side may be
 * empty (a swap has both populated).
 */
export default class MemberRolesUpdatedEvent extends Event {
  public readonly oldMember: GuildMember | PartialGuildMember;
  public readonly newMember: GuildMember;
  public readonly added: Collection<string, Role>;
  public readonly removed: Collection<string, Role>;

  constructor(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
    added: Collection<string, Role>,
    removed: Collection<string, Role>
  ) {
    super({
      guild: newMember.guild,
      userId: newMember.id,
    });
    this.oldMember = oldMember;
    this.newMember = newMember;
    this.added = added;
    this.removed = removed;
  }
}

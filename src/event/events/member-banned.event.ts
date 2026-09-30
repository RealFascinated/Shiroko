import type { Guild, GuildBan } from "discord.js";
import Event from "../event";

/**
 * A member was banned from a guild (or unbanned, when `banned` is false).
 * Carries the resolved guild so per-guild logging applies; the ban's own
 * `guild` is always present.
 */
export default class MemberBannedEvent extends Event {
  public readonly guildData: Guild;
  public readonly ban: GuildBan;
  public readonly banned: boolean;

  constructor(ban: GuildBan, banned: boolean) {
    super({ guild: ban.guild, userId: ban.user.id });
    this.guildData = ban.guild;
    this.ban = ban;
    this.banned = banned;
  }
}

import type { Guild, GuildBan } from "discord.js";
import Event from "../event";

/**
 * A member was unbanned from a guild. Carries the resolved guild so
 * per-guild logging applies; the ban's own `guild` is always present.
 */
export default class MemberUnbannedEvent extends Event {
  public readonly guildData: Guild;
  public readonly ban: GuildBan;

  constructor(ban: GuildBan) {
    super({ guild: ban.guild, userId: ban.user.id });
    this.guildData = ban.guild;
    this.ban = ban;
  }
}

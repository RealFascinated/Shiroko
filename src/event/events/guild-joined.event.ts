import type { Guild } from "discord.js";
import Event from "../event";

/**
 * The bot joined a guild.
 */
export default class GuildJoinedEvent extends Event {
  public readonly guildData: Guild;

  constructor(guild: Guild) {
    super({ guild });
    this.guildData = guild;
  }
}

import type { Guild } from "discord.js";
import Event from "../event";

/**
 * The bot left a guild (or was removed). `guildData` is a partial guild
 * (only `id`, `name`, `memberCount` guaranteed on `GuildDelete`).
 */
export default class GuildLeftEvent extends Event {
  public readonly guildData: Guild;

  constructor(guild: Guild) {
    super({ guild });
    this.guildData = guild;
  }
}

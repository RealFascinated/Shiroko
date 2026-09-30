import type { Guild } from "discord.js";
import Event from "../event";

/**
 * A guild's own settings changed (name, icon, banner, splash, verification
 * level, ...). Carries the cached guild before the update and after, so
 * consumers can diff the fields they care about.
 */
export default class GuildUpdatedEvent extends Event {
  public readonly oldGuild: Guild;
  public readonly guildData: Guild;

  constructor(oldGuild: Guild, guild: Guild) {
    super({ guild });
    this.oldGuild = oldGuild;
    this.guildData = guild;
  }
}

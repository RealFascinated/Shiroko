import type { GuildHistorySchema } from "@/db/schemas/guild-history";
import type { Guild } from "discord.js";
import Event from "../event";

export default class ConfigChangeRecordedEvent extends Event {
  public override readonly userId: string | null;
  public readonly guildData: Guild;
  public readonly entry: GuildHistorySchema;

  constructor(options: { guild: Guild; entry: GuildHistorySchema }) {
    super({ guild: options.guild, userId: options.entry.actorId });
    this.userId = options.entry.actorId;
    this.guildData = options.guild;
    this.entry = options.entry;
  }
}

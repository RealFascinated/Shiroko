import type { GuildAuditSchema } from "@/db/schemas/guild-audit";
import type { Guild } from "discord.js";
import Event from "../event";

export default class ConfigChangeRecordedEvent extends Event {
  public override readonly userId: string | null;
  public readonly guildData: Guild;
  public readonly entry: GuildAuditSchema;

  constructor(options: { guild: Guild; entry: GuildAuditSchema }) {
    super({ guild: options.guild, userId: options.entry.actorId });
    this.userId = options.entry.actorId;
    this.guildData = options.guild;
    this.entry = options.entry;
  }
}

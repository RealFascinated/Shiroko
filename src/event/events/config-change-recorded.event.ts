import type { GuildAuditLogSchema } from "@/db/schemas/guild-audit-log";
import type { Guild } from "discord.js";
import Event from "../event";

export default class AuditEntryRecordedEvent extends Event {
  public override readonly userId: string | null;
  public readonly guildData: Guild;
  public readonly entry: GuildAuditLogSchema;

  constructor(options: { guild: Guild; entry: GuildAuditLogSchema }) {
    super({ guild: options.guild, userId: options.entry.actorId });
    this.userId = options.entry.actorId;
    this.guildData = options.guild;
    this.entry = options.entry;
  }
}

import { AuditLogEvent } from "discord.js";
import GuildUpdatedEvent from "@/event/events/guild-updated.event";
import { diffFields } from "@/history/history-kind";
import GuildEventKind from "@/history/guild-event-kind";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { type Fields, updated } from "../drafts";

export default class GuildUpdateKind extends GuildEventKind<GuildUpdatedEvent> {
  public readonly id: string = "guild_update";
  public readonly label: string = "Server updated";
  public readonly eventClass: new (...args: any[]) => GuildUpdatedEvent = GuildUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.GuildUpdate];

  public draft({ oldGuild, guildData }: GuildUpdatedEvent): GuildHistoryDraft | null {
    const fields = (guild: GuildUpdatedEvent["guildData"]): Fields => ({
      name: guild.name,
      icon: guild.icon,
      banner: guild.banner,
      splash: guild.splash,
      description: guild.description,
      ownerId: guild.ownerId,
      vanityCode: guild.vanityURLCode,
      verificationLevel: guild.verificationLevel,
      afkChannelId: guild.afkChannelId,
      systemChannelId: guild.systemChannelId,
    });
    const change = diffFields(fields(oldGuild), fields(guildData));
    return change && { guild: guildData, subjectId: guildData.id, ...change };
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

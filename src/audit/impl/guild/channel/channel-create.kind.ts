import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import ChannelCreatedEvent from "@/event/events/channel-created.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { channelFields } from "./channel-fields";
import ChannelKind from "./channel-kind";
import { created } from "../drafts";

export default class ChannelCreateKind extends ChannelKind<ChannelCreatedEvent> {
  public readonly id: string = "channel_create";
  public readonly label: string = "Channel created";
  public readonly eventClass: EventClass<ChannelCreatedEvent> = ChannelCreatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelCreate];

  public draft(event: ChannelCreatedEvent): GuildAuditDraft | null {
    return created(event.guildData, event.channelId, channelFields(event.channel));
  }
}

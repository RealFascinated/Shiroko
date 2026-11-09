import { AuditLogEvent } from "discord.js";
import ChannelUpdatedEvent from "@/event/events/channel-updated.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { channelFields } from "./channel-fields";
import ChannelKind from "./channel-kind";
import { updated } from "../drafts";

export default class ChannelUpdateKind extends ChannelKind<ChannelUpdatedEvent> {
  public readonly id: string = "channel_update";
  public readonly label: string = "Channel updated";
  public readonly eventClass: new (...args: any[]) => ChannelUpdatedEvent = ChannelUpdatedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelUpdate];

  public draft(event: ChannelUpdatedEvent): GuildAuditDraft | null {
    return updated(
      event.guildData,
      event.channelId,
      channelFields(event.oldChannel),
      channelFields(event.newChannel)
    );
  }
}

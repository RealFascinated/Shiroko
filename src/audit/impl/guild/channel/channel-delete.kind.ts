import type { EventClass } from "@/audit/audit-kind";
import { AuditLogEvent } from "discord.js";
import ChannelDeletedEvent from "@/event/events/channel-deleted.event";
import type { GuildAuditDraft } from "@/audit/guild-audit-kind";
import { channelFields } from "./channel-fields";
import ChannelKind from "./channel-kind";
import { deleted } from "../drafts";

export default class ChannelDeleteKind extends ChannelKind<ChannelDeletedEvent> {
  public readonly id: string = "channel_delete";
  public readonly label: string = "Channel deleted";
  public readonly eventClass: EventClass<ChannelDeletedEvent> = ChannelDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelDelete];

  public draft(event: ChannelDeletedEvent): GuildAuditDraft | null {
    return deleted(event.guildData, event.channelId, channelFields(event.channel));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

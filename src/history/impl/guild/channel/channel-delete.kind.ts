import { AuditLogEvent } from "discord.js";
import ChannelDeletedEvent from "@/event/events/channel-deleted.event";
import type { GuildHistoryDraft } from "@/history/guild-history-kind";
import { channelFields } from "./channel-fields";
import ChannelKind from "./channel-kind";
import { deleted } from "../drafts";

export default class ChannelDeleteKind extends ChannelKind<ChannelDeletedEvent> {
  public readonly id: string = "channel_delete";
  public readonly label: string = "Channel deleted";
  public readonly eventClass: new (...args: any[]) => ChannelDeletedEvent = ChannelDeletedEvent;
  public override readonly auditActions: readonly AuditLogEvent[] = [AuditLogEvent.ChannelDelete];

  public draft(event: ChannelDeletedEvent): GuildHistoryDraft | null {
    return deleted(event.guildData, event.channelId, channelFields(event.channel));
  }

  protected override mention(subjectId: string): string {
    return `\`${subjectId}\``;
  }
}

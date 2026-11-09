import type ChannelCreatedEvent from "@/event/events/channel-created.event";
import type ChannelDeletedEvent from "@/event/events/channel-deleted.event";
import type ChannelUpdatedEvent from "@/event/events/channel-updated.event";
import GuildEventKind from "@/audit/guild-event-kind";

export default abstract class ChannelKind<
  E extends ChannelCreatedEvent | ChannelDeletedEvent | ChannelUpdatedEvent,
> extends GuildEventKind<E> {
  protected override mention(subjectId: string): string {
    return `<#${subjectId}>`;
  }
}

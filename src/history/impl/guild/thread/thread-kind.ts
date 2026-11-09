import type ThreadCreatedEvent from "@/event/events/thread-created.event";
import type ThreadDeletedEvent from "@/event/events/thread-deleted.event";
import type ThreadUpdatedEvent from "@/event/events/thread-updated.event";
import GuildEventKind from "@/history/guild-event-kind";

export default abstract class ThreadKind<
  E extends ThreadCreatedEvent | ThreadDeletedEvent | ThreadUpdatedEvent,
> extends GuildEventKind<E> {
  protected override mention(subjectId: string): string {
    return `<#${subjectId}>`;
  }
}

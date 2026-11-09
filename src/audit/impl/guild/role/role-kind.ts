import type RoleCreatedEvent from "@/event/events/role-created.event";
import type RoleDeletedEvent from "@/event/events/role-deleted.event";
import type RoleUpdatedEvent from "@/event/events/role-updated.event";
import GuildEventKind from "@/audit/guild-event-kind";

export default abstract class RoleKind<
  E extends RoleCreatedEvent | RoleDeletedEvent | RoleUpdatedEvent,
> extends GuildEventKind<E> {
  protected override mention(subjectId: string): string {
    return `<@&${subjectId}>`;
  }
}

import UserDisplayNameUpdatedEvent from "@/event/events/user-display-name-updated.event";
import type { AuditChange, EventClass } from "@/audit/audit-kind";
import UserAuditKind from "@/audit/user-audit-kind";

export default class DisplayNameKind extends UserAuditKind<UserDisplayNameUpdatedEvent> {
  public readonly id: string = "display_name";
  public readonly label: string = "Display name";
  public readonly eventClass: EventClass<UserDisplayNameUpdatedEvent> = UserDisplayNameUpdatedEvent;

  protected change(event: UserDisplayNameUpdatedEvent): AuditChange {
    return { oldValue: event.oldUser.globalName ?? null, newValue: event.newUser.globalName ?? null };
  }
}

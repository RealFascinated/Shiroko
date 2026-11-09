import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import type { AuditChange, EventClass } from "@/audit/audit-kind";
import UserAuditKind from "@/audit/user-audit-kind";

export default class UsernameKind extends UserAuditKind<UserUsernameUpdatedEvent> {
  public readonly id: string = "username";
  public readonly label: string = "Username";
  public readonly eventClass: EventClass<UserUsernameUpdatedEvent> = UserUsernameUpdatedEvent;

  protected change(event: UserUsernameUpdatedEvent): AuditChange {
    return { oldValue: event.oldUser.username ?? null, newValue: event.newUser.username ?? null };
  }
}

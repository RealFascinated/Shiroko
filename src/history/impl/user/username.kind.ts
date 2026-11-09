import UserUsernameUpdatedEvent from "@/event/events/user-username-updated.event";
import type { HistoryChange } from "@/history/history-kind";
import UserHistoryKind from "@/history/user-history-kind";

export default class UsernameKind extends UserHistoryKind<UserUsernameUpdatedEvent> {
  public readonly id: string = "username";
  public readonly label: string = "Username";
  public readonly eventClass: new (...args: any[]) => UserUsernameUpdatedEvent = UserUsernameUpdatedEvent;

  protected change(event: UserUsernameUpdatedEvent): HistoryChange {
    return { oldValue: event.oldUser.username ?? null, newValue: event.newUser.username ?? null };
  }
}
